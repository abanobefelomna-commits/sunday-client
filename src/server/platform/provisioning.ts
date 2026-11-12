import { neon } from '@neondatabase/serverless';
import { platformQuery, platformQueryOne } from './db';
import { getPreviewConfig } from './preview';
import {
  encryptSecret,
  fingerprintConnectionUrl,
  sha256Hex,
  safeEqual,
} from './crypto';
import { getProvisioningProvider } from './config';
import {
  ManualDatabaseProvider,
  NeonProjectProvider,
  PostgresAdminProvider,
  type TenantDatabaseProvider,
  type TenantDatabaseResult,
} from './providers';
import { TENANT_MIGRATIONS } from '../tenant/schema.generated';
import { splitStatements } from '../sql';
import { grantPreviewEntitlements, invalidateEntitlementCache } from './entitlements';
import { recordPlatformAudit, sanitizeErrorMessage } from './audit';

export interface ProvisioningJobRow {
  id: string;
  churchId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  currentStep: string | null;
  attempts: number;
  maxAttempts: number;
  seedPayload: Record<string, unknown> | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  provisioningTokenHash: string;
  churchSlug: string;
  churchName: string;
  churchStatus: string;
  providerResourceId: string | null;
  settings: Record<string, unknown> | null;
}

const STEP_LABELS: Record<string, string> = {
  queued: 'في الانتظار',
  validate: 'التحقق من الطلب',
  create_database: 'إنشاء قاعدة بيانات الكنيسة',
  apply_migrations: 'تجهيز هيكل البيانات',
  seed_identity: 'تسجيل هوية الكنيسة',
  create_admin: 'إنشاء حساب أمين الخدمة',
  record_connection: 'تأمين الاتصال بقاعدة البيانات',
  grant_entitlements: 'تفعيل مزايا النسخة التجريبية',
  activate: 'تفعيل الكنيسة',
  done: 'تم بنجاح',
};

const STEP_ORDER = [
  'create_database',
  'apply_migrations',
  'seed_identity',
  'create_admin',
  'record_connection',
  'grant_entitlements',
  'activate',
];

export function getProvider(): TenantDatabaseProvider {
  switch (getProvisioningProvider()) {
    case 'neon-project':
      return new NeonProjectProvider();
    case 'manual':
      return new ManualDatabaseProvider();
    default:
      return new PostgresAdminProvider();
  }
}

export async function runTenantMigrations(connectionString: string): Promise<void> {
  const sql = neon(connectionString);
  for (const file of TENANT_MIGRATIONS) {
    for (const statement of splitStatements(file.sql)) {
      await sql.query(statement);
    }
  }
  await sql.query(
    `INSERT INTO "tenant_migrations" ("name") VALUES ('bundle')
     ON CONFLICT ("name") DO UPDATE SET "appliedAt" = now()`,
  );
}

export async function testTenantConnection(connectionString: string): Promise<void> {
  const sql = neon(connectionString);
  await sql.query('SELECT 1');
}

async function setJobStep(jobId: string, step: string, detail?: Record<string, unknown>): Promise<void> {
  const entry = JSON.stringify({ step, at: new Date().toISOString(), ...(detail ?? {}) });
  await platformQuery(
    `UPDATE "provisioning_jobs"
     SET "currentStep" = $2,
         "stepHistory" = "stepHistory" || $3::jsonb,
         "updatedAt" = now()
     WHERE "id" = $1`,
    [jobId, step, `[${entry}]`],
  );
}

async function loadJob(jobId: string): Promise<ProvisioningJobRow | null> {
  return platformQueryOne<ProvisioningJobRow>(
    `SELECT j."id", j."churchId", j."status", j."currentStep", j."attempts", j."maxAttempts",
            j."seedPayload", j."lastErrorCode", j."lastErrorMessage", j."provisioningTokenHash",
            c."slug" AS "churchSlug", c."name" AS "churchName", c."status" AS "churchStatus",
            c."providerResourceId", c."settings"
     FROM "provisioning_jobs" j
     JOIN "churches" c ON c."id" = j."churchId"
     WHERE j."id" = $1 LIMIT 1`,
    [jobId],
  );
}

async function claimJob(jobId: string): Promise<ProvisioningJobRow | null> {
  const claimed = await platformQueryOne<ProvisioningJobRow>(
    `UPDATE "provisioning_jobs"
     SET "status" = 'running',
         "attempts" = "attempts" + 1,
         "startedAt" = COALESCE("startedAt", now()),
         "lockedAt" = now(),
         "nextAttemptAt" = now(),
         "updatedAt" = now()
     WHERE "id" = $1
       AND (
         ("status" IN ('queued', 'failed') AND "attempts" < "maxAttempts" AND "nextAttemptAt" <= now())
         OR ("status" = 'running' AND "lockedAt" < now() - interval '15 minutes' AND "attempts" < "maxAttempts")
       )
     RETURNING "id", "churchId", "status", "currentStep", "attempts", "maxAttempts",
               "seedPayload", "lastErrorCode", "lastErrorMessage", "provisioningTokenHash",
               NULL::text AS "churchSlug", NULL::text AS "churchName", NULL::text AS "churchStatus",
               NULL::text AS "providerResourceId", NULL::jsonb AS "settings"`,
    [jobId],
  );
  if (!claimed) return null;
  return loadJob(jobId);
}

async function seedTenantIdentity(input: {
  connectionString: string;
  churchId: string;
  slug: string;
  name: string;
  timezone: string;
}): Promise<void> {
  const sql = neon(input.connectionString);
  await sql.query(
    `INSERT INTO "tenant_identity" ("churchId", "slug", "provisionedAt", "schemaVersion")
     VALUES ($1, $2, now(), '1')
     ON CONFLICT ("churchId") DO UPDATE
     SET "slug" = EXCLUDED."slug", "schemaVersion" = EXCLUDED."schemaVersion"`,
    [input.churchId, input.slug],
  );
  await sql.query(
    `INSERT INTO "church_settings" ("key", "value", "updatedAt")
     VALUES ('site.name', to_jsonb($1::text), now())
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()`,
    [input.name],
  );
  await sql.query(
    `INSERT INTO "church_settings" ("key", "value", "updatedAt")
     VALUES ('site.timezone', to_jsonb($1::text), now())
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()`,
    [input.timezone],
  );
  await sql.query(
    `INSERT INTO "church_settings" ("key", "value", "updatedAt")
     VALUES ('church.slug', to_jsonb($1::text), now())
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()`,
    [input.slug],
  );
}

async function seedChurchAdministrator(input: {
  connectionString: string;
  churchId: string;
  seed: Record<string, unknown> | null;
}): Promise<void> {
  if (!input.seed || input.seed.createAdmin !== true) return;
  const name = typeof input.seed.adminName === 'string' ? input.seed.adminName.trim() : '';
  const email = typeof input.seed.adminEmail === 'string' ? input.seed.adminEmail.trim().toLowerCase() : '';
  const phone = typeof input.seed.adminPhone === 'string' ? input.seed.adminPhone.trim() : '';
  const passwordHash = typeof input.seed.adminPasswordHash === 'string' ? input.seed.adminPasswordHash : '';
  if (!name || !email || !phone || passwordHash.length < 20) {
    throw Object.assign(new Error('Initial administrator data is incomplete'), { code: 'ADMIN_SEED_INVALID' });
  }

  const sql = neon(input.connectionString);
  const existing = await sql.query(
    `SELECT "id" FROM "users" WHERE lower("email") = $1 OR "phone" = $2 LIMIT 1`,
    [email, phone],
  );

  let userId: string;
  if (existing.length > 0) {
    userId = (existing[0] as { id: string }).id;
    await sql.query(
      `UPDATE "users" SET "role" = 'admin', "isActive" = true, "updatedAt" = now() WHERE "id" = $1`,
      [userId],
    );
  } else {
    const inserted = await sql.query(
      `INSERT INTO "users"
         ("id", "name", "email", "emailVerified", "phone", "password", "role", "grades", "isActive", "createdAt", "updatedAt")
       VALUES (uuid_generate_v4(), $1, $2, true, $3, $4, 'admin', '{}', true, now(), now())
       RETURNING "id"`,
      [name, email, phone, passwordHash],
    );
    userId = (inserted[0] as { id: string }).id;
  }

  await sql.query(
    `INSERT INTO "servants" ("id", "name", "phone", "email", "role", "userId", "createdAt", "updatedAt")
     VALUES (uuid_generate_v4(), $1, $2, $3, 'مسؤول', $4, now(), now())
     ON CONFLICT ("phone") DO UPDATE
     SET "userId" = EXCLUDED."userId", "role" = 'مسؤول', "updatedAt" = now()`,
    [name, phone, email, userId],
  );
  await sql.query(
    `INSERT INTO "user_roles" ("userId", "roleId")
     SELECT $1, "id" FROM "roles" WHERE "code" = 'ADMIN'
     ON CONFLICT DO NOTHING`,
    [userId],
  );
}

async function upsertConnection(input: {
  churchId: string;
  database: TenantDatabaseResult;
}): Promise<void> {
  const encryptedUrl = encryptSecret(input.database.connectionString);
  const fingerprint = fingerprintConnectionUrl(input.database.connectionString);
  await platformQuery(
    `INSERT INTO "tenant_connections"
       ("churchId", "provider", "encryptedUrl", "urlFingerprint", "databaseName", "databaseHost", "createdAt", "rotatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())
     ON CONFLICT ("churchId") DO UPDATE
     SET "provider" = EXCLUDED."provider",
         "encryptedUrl" = EXCLUDED."encryptedUrl",
         "urlFingerprint" = EXCLUDED."urlFingerprint",
         "databaseName" = EXCLUDED."databaseName",
         "databaseHost" = EXCLUDED."databaseHost",
         "rotatedAt" = now()`,
    [
      input.churchId,
      input.database.provider,
      encryptedUrl,
      fingerprint,
      input.database.databaseName,
      input.database.databaseHost,
    ],
  );
}

export interface ProvisionResult {
  ok: boolean;
  status: 'succeeded' | 'failed' | 'already_succeeded' | 'not_claimable';
  jobId: string;
  churchId: string;
  error?: { code: string; message: string };
}

export async function provisionChurch(jobId: string, actor?: {
  type?: 'platform_admin' | 'system' | 'public' | 'cron';
  id?: string | null;
  ip?: string | null;
}): Promise<ProvisionResult> {
  const current = await loadJob(jobId);
  if (!current) {
    return {
      ok: false,
      status: 'not_claimable',
      jobId,
      churchId: '',
      error: { code: 'JOB_NOT_FOUND', message: 'Provisioning job not found' },
    };
  }
  if (current.status === 'succeeded' && current.churchStatus === 'active') {
    return { ok: true, status: 'already_succeeded', jobId, churchId: current.churchId };
  }

  const job = await claimJob(jobId);
  if (!job) {
    return {
      ok: false,
      status: 'not_claimable',
      jobId,
      churchId: current.churchId,
      error: { code: 'JOB_NOT_CLAIMABLE', message: 'Job is running or has exhausted its retries' },
    };
  }

  let database: TenantDatabaseResult | null = null;
  try {
    await platformQuery(
      `UPDATE "churches" SET "status" = 'provisioning', "updatedAt" = now()
       WHERE "id" = $1 AND "status" <> 'active'`,
      [job.churchId],
    );

    await setJobStep(job.id, 'validate');
    const preview = await getPreviewConfig();
    if (preview.mode === 'PREVIEW' && (!preview.officialLaunchDate || !preview.startDate || !preview.endDate)) {
      throw Object.assign(new Error('Official Preview dates are not configured'), {
        code: 'PREVIEW_CONFIG_UNSET',
      });
    }
    const provider = getProvider();

    await setJobStep(job.id, 'create_database');
    database = await provider.ensureDatabase({
      churchId: job.churchId,
      slug: job.churchSlug,
      existingResourceId: job.providerResourceId,
    });
    await platformQuery(
      `UPDATE "churches"
       SET "databaseProvider" = $2, "providerResourceId" = $3,
           "databaseName" = $4, "databaseHost" = $5, "updatedAt" = now()
       WHERE "id" = $1`,
      [job.churchId, database.provider, database.resourceId, database.databaseName, database.databaseHost],
    );

    await setJobStep(job.id, 'apply_migrations');
    await runTenantMigrations(database.connectionString);

    await setJobStep(job.id, 'seed_identity');
    await seedTenantIdentity({
      connectionString: database.connectionString,
      churchId: job.churchId,
      slug: job.churchSlug,
      name: job.churchName,
      timezone:
        typeof job.settings?.timezone === 'string' ? job.settings.timezone : 'Africa/Cairo',
    });

    await setJobStep(job.id, 'create_admin');
    await seedChurchAdministrator({
      connectionString: database.connectionString,
      churchId: job.churchId,
      seed: job.seedPayload,
    });

    await setJobStep(job.id, 'record_connection');
    await upsertConnection({ churchId: job.churchId, database });
    const identity = await neon(database.connectionString).query(
      `SELECT "churchId" FROM "tenant_identity" LIMIT 1`,
    );
    if (!identity[0] || (identity[0] as { churchId: string }).churchId !== job.churchId) {
      throw Object.assign(new Error('Tenant identity verification failed'), {
        code: 'TENANT_IDENTITY_MISMATCH',
      });
    }

    await setJobStep(job.id, 'grant_entitlements');
    await grantPreviewEntitlements(job.churchId);
    const plan = await platformQueryOne<{ id: string }>(
      `SELECT "id" FROM "subscription_plans" WHERE "code" = 'preview' LIMIT 1`,
    );
    if (plan && preview.mode === 'PREVIEW') {
      await platformQuery(
        `INSERT INTO "subscriptions"
           ("id", "churchId", "planId", "status", "billingCycle", "currentPeriodStart", "currentPeriodEnd",
            "priceCents", "currency", "provider", "createdAt", "updatedAt")
         SELECT uuid_generate_v4(), $1, $2, 'trialing', 'monthly', $3::timestamptz, $4::timestamptz,
                0, 'EGP', 'none', now(), now()
         WHERE NOT EXISTS (
           SELECT 1 FROM "subscriptions"
           WHERE "churchId" = $1 AND "status" IN ('trialing', 'active', 'past_due', 'incomplete')
         )`,
        [job.churchId, plan.id, `${preview.startDate}T00:00:00Z`, `${preview.endDate}T23:59:59Z`],
      );
      await platformQuery(
        `INSERT INTO "subscription_events" ("id", "churchId", "type", "payload")
         VALUES (uuid_generate_v4(), $1, 'preview_started', $2::jsonb)`,
        [job.churchId, JSON.stringify({ plan: 'preview', startDate: preview.startDate, endDate: preview.endDate })],
      );
    }

    await setJobStep(job.id, 'activate');
    await platformQuery(
      `UPDATE "churches"
       SET "status" = 'active', "provisionedAt" = COALESCE("provisionedAt", now()),
           "activatedAt" = now(), "updatedAt" = now()
       WHERE "id" = $1`,
      [job.churchId],
    );
    await platformQuery(
      `UPDATE "provisioning_jobs"
       SET "status" = 'succeeded', "currentStep" = 'done', "finishedAt" = now(),
           "lockedAt" = NULL, "seedPayload" = NULL, "lastErrorCode" = NULL,
           "lastErrorMessage" = NULL, "updatedAt" = now()
       WHERE "id" = $1`,
      [job.id],
    );
    invalidateEntitlementCache(job.churchId);
    await recordPlatformAudit({
      actorId: actor?.id ?? null,
      actorType: actor?.type ?? 'system',
      action: 'church.provisioned',
      entityType: 'church',
      entityId: job.churchId,
      ip: actor?.ip ?? null,
      after: { slug: job.churchSlug, databaseProvider: database.provider },
    });
    return { ok: true, status: 'succeeded', jobId: job.id, churchId: job.churchId };
  } catch (error) {
    const safe = sanitizeErrorMessage(error);
    const backoffSeconds = Math.min(60 * Math.max(1, job.attempts), 900);
    await platformQuery(
      `UPDATE "provisioning_jobs"
       SET "status" = 'failed', "lastErrorCode" = $2, "lastErrorMessage" = $3,
           "lockedAt" = NULL, "nextAttemptAt" = now() + ($4 || ' seconds')::interval,
           "updatedAt" = now()
       WHERE "id" = $1`,
      [job.id, safe.code, safe.message, String(backoffSeconds)],
    );
    await platformQuery(
      `UPDATE "churches" SET "status" = 'failed', "updatedAt" = now()
       WHERE "id" = $1 AND "status" <> 'active'`,
      [job.churchId],
    );
    await recordPlatformAudit({
      actorId: actor?.id ?? null,
      actorType: actor?.type ?? 'system',
      action: 'church.provisioning_failed',
      entityType: 'church',
      entityId: job.churchId,
      ip: actor?.ip ?? null,
      after: { errorCode: safe.code, attempt: job.attempts },
    });
    return {
      ok: false,
      status: 'failed',
      jobId: job.id,
      churchId: job.churchId,
      error: safe,
    };
  }
}

export async function getProvisioningStatus(jobId: string, token?: string | null): Promise<{
  jobId: string;
  status: ProvisioningJobRow['status'];
  currentStep: string | null;
  progress: number;
  attempts: number;
  maxAttempts: number;
  church: { name: string; slug: string; status: string };
  error: { code: string; message: string } | null;
  canRetry: boolean;
  loginPath: string | null;
} | null> {
  const job = await loadJob(jobId);
  if (!job) return null;
  if (token) {
    if (!safeEqual(sha256Hex(token), job.provisioningTokenHash)) return null;
  } else {
    return null;
  }
  const index = job.currentStep ? STEP_ORDER.indexOf(job.currentStep) : -1;
  const progress =
    job.status === 'succeeded' ? 100 : Math.max(5, Math.round(((index + 1) / STEP_ORDER.length) * 100));
  return {
    jobId: job.id,
    status: job.status,
    currentStep: job.currentStep,
    progress,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    church: { name: job.churchName, slug: job.churchSlug, status: job.churchStatus },
    error:
      job.status === 'failed' && job.lastErrorCode
        ? { code: job.lastErrorCode, message: job.lastErrorMessage || 'Provisioning failed' }
        : null,
    canRetry: job.status === 'failed' && job.attempts < job.maxAttempts,
    loginPath: job.status === 'succeeded' ? `/login?church=${encodeURIComponent(job.churchSlug)}` : null,
  };
}

export async function processPendingProvisioningJobs(limit = 5): Promise<ProvisionResult[]> {
  const jobs = await platformQuery<{ id: string }>(
    `SELECT "id" FROM "provisioning_jobs"
     WHERE "status" IN ('queued', 'failed')
       AND "attempts" < "maxAttempts"
       AND "nextAttemptAt" <= now()
     ORDER BY "createdAt" ASC
     LIMIT $1`,
    [Math.max(1, Math.min(limit, 50))],
  );
  const results: ProvisionResult[] = [];
  for (const job of jobs) {
    results.push(await provisionChurch(job.id, { type: 'cron' }));
  }
  return results;
}

export async function attachTenantDatabase(input: {
  churchId: string;
  connectionString: string;
  provider?: TenantDatabaseResult['provider'];
  verifyOnly?: boolean;
}): Promise<{ tables: string[] }> {
  if (!/^postgres(ql)?:\/\//i.test(input.connectionString)) {
    throw Object.assign(new Error('A PostgreSQL connection string is required'), {
      code: 'INVALID_CONNECTION_STRING',
    });
  }
  await testTenantConnection(input.connectionString);
  await runTenantMigrations(input.connectionString);
  const sql = neon(input.connectionString);
  const tables = (await sql.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
  )) as Array<{ table_name: string }>;

  const fingerprint = fingerprintConnectionUrl(input.connectionString);
  const linked = await platformQueryOne<{ churchId: string }>(
    `SELECT "churchId" FROM "tenant_connections" WHERE "urlFingerprint" = $1 AND "churchId" <> $2 LIMIT 1`,
    [fingerprint, input.churchId],
  );
  if (linked) {
    throw Object.assign(new Error('This database is already linked to another church'), {
      code: 'TENANT_DATABASE_ALREADY_LINKED',
    });
  }

  if (input.verifyOnly) return { tables: tables.map((row) => row.table_name) };

  const url = new URL(input.connectionString);
  await upsertConnection({
    churchId: input.churchId,
    database: {
      provider: input.provider ?? 'manual',
      connectionString: input.connectionString,
      databaseName: url.pathname.replace(/^\//, '') || 'postgres',
      databaseHost: url.hostname,
      resourceId: null,
      created: false,
    },
  });
  await platformQuery(
    `UPDATE "churches"
     SET "databaseProvider" = $2, "databaseName" = $3, "databaseHost" = $4,
         "status" = 'active', "provisionedAt" = COALESCE("provisionedAt", now()),
         "activatedAt" = COALESCE("activatedAt", now()), "updatedAt" = now()
     WHERE "id" = $1`,
    [input.churchId, input.provider ?? 'manual', url.pathname.replace(/^\//, ''), url.hostname],
  );
  await grantPreviewEntitlements(input.churchId);
  invalidateEntitlementCache(input.churchId);
  return { tables: tables.map((row) => row.table_name) };
}

export function publicStepLabel(step: string | null): string {
  return (step && STEP_LABELS[step]) || 'جاري التجهيز';
}
