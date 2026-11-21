import { randomBytes, randomUUID } from 'node:crypto';
import { platformQuery, platformQueryOne } from './db.ts';
import { hashPassword, normalizeEmail, validatePasswordStrength } from '../auth.ts';
import { getPreviewStatus, getPlatformConfig } from './preview.ts';
import { grantPreviewEntitlements, grantLifetimeFree, invalidateEntitlementCache } from './entitlements.ts';
import { attachTenantDatabase } from './provisioning.ts';
import { recordPlatformAudit } from './audit.ts';
import { hashIp, randomToken, sha256Hex } from './crypto.ts';

export interface ChurchRegistrationInput {
  churchName: string;
  slug?: string;
  legalName?: string;
  country?: string;
  city?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  creationCode?: string;
  timezone?: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  ip?: string | null;
}

export interface RegisteredChurch {
  churchId: string;
  slug: string;
  name: string;
  jobId: string;
  provisioningToken: string;
}

const RESERVED_SLUGS = new Set([
  'www', 'api', 'app', 'admin', 'platform', 'mail', 'login', 'register', 'onboarding',
  'support', 'status', 'docs', 'blog', 'help', 'terms', 'privacy', 'contact', 'faq',
  'dashboard', 'settings', 'auth', 'churches', 'church', 'static', 'assets',
]);

export class RegistrationError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'REGISTRATION_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function normalizeChurchName(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidSlug(slug: string): boolean {
  return (
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/.test(slug) &&
    !RESERVED_SLUGS.has(slug) &&
    !slug.includes('--')
  );
}

export function slugifyChurchName(name: string): string {
  const ascii = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const base = ascii || `church-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)}`;
  if (isValidSlug(base)) return base;
  const safe = base.replace(/^-+|-+$/g, '').slice(0, 55) || 'church';
  return `${safe}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4)}`;
}

/**
 * Human-friendly church invitation code.
 * Uses an alphabet without easily confused characters (0/O, 1/I/l).
 * The code is stored centrally and can only be used to register an ordinary
 * servant account — it never grants administrative privileges.
 */
export function generateChurchCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  let code = '';
  for (let i = 0; i < 10; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 320;
}

function validPhone(phone: string): boolean {
  return /^[0-9+\-()\s]{6,30}$/.test(phone);
}

export async function registerChurch(input: ChurchRegistrationInput): Promise<RegisteredChurch> {
  const platform = await getPlatformConfig();
  if (!platform.registrationEnabled) {
    throw new RegistrationError('التسجيل متوقف مؤقتًا.', 403, 'REGISTRATION_DISABLED');
  }

  const churchName = input.churchName?.trim();
  const contactName = input.contactName?.trim();
  const contactEmail = normalizeEmail(input.contactEmail || '');
  const adminName = input.adminName?.trim();
  const adminEmail = normalizeEmail(input.adminEmail || '');
  const adminPhone = input.adminPhone?.trim();
  const city = input.city?.trim().slice(0, 120) || null;

  if (!churchName || churchName.length < 2 || churchName.length > 200) {
    throw new RegistrationError('اسم الكنيسة مطلوب (٢ إلى ٢٠٠ حرف).');
  }
  if (!contactName || contactName.length > 160) throw new RegistrationError('اسم مسؤول التواصل مطلوب.');
  if (!validEmail(contactEmail)) throw new RegistrationError('بريد التواصل غير صالح.');
  if (input.contactPhone && !validPhone(input.contactPhone)) {
    throw new RegistrationError('رقم هاتف التواصل غير صالح.');
  }
  if (!adminName || adminName.length > 160) throw new RegistrationError('اسم أمين الخدمة مطلوب.');
  if (!validEmail(adminEmail)) throw new RegistrationError('بريد أمين الخدمة غير صالح.');
  if (!validPhone(adminPhone)) throw new RegistrationError('رقم هاتف أمين الخدمة غير صالح.');
  const passwordError = validatePasswordStrength(input.adminPassword);
  if (passwordError) throw new RegistrationError(passwordError);
  if (!input.acceptTerms || !input.acceptPrivacy) {
    throw new RegistrationError('يجب الموافقة على شروط الخدمة وسياسة الخصوصية.');
  }

  const requestedSlug = (input.slug || '').trim().toLowerCase();
  const slug = requestedSlug || slugifyChurchName(churchName);
  if (!isValidSlug(slug)) {
    throw new RegistrationError(
      'الرابط المختصر يجب أن يكون حروفًا إنجليزية صغيرة وأرقامًا وشرطات، من ٢ إلى ٦٣ حرفًا.',
      400,
      'INVALID_SLUG',
    );
  }

  const normalizedName = normalizeChurchName(churchName);
  if (!normalizedName) throw new RegistrationError('اسم الكنيسة غير صالح.');

  const duplicate = await platformQueryOne<{
    slug: string | null;
    email: string | null;
    name: string | null;
  }>(
    `SELECT
       (SELECT "slug" FROM "churches" WHERE "slug" = $1 AND "status" <> 'archived' LIMIT 1) AS "slug",
       (SELECT "slug" FROM "churches" WHERE lower("contactEmail") = $2 AND "status" <> 'archived' LIMIT 1) AS "email",
       (SELECT "slug" FROM "churches" WHERE "normalizedName" = $3 AND COALESCE("city", '') = COALESCE($4, '') AND "status" <> 'archived' LIMIT 1) AS "name"`,
    [slug, contactEmail, normalizedName, city],
  );
  if (duplicate?.slug) throw new RegistrationError('هذا الرابط المختصر مستخدم بالفعل.', 409, 'SLUG_TAKEN');
  if (duplicate?.email) throw new RegistrationError('يوجد طلب تسجيل بالفعل لهذا البريد.', 409, 'EMAIL_TAKEN');
  if (duplicate?.name) throw new RegistrationError('يوجد طلب تسجيل بالفعل لهذه الكنيسة.', 409, 'CHURCH_TAKEN');

  const rawCreationCode = typeof input.creationCode === 'string' ? input.creationCode.trim() : '';
  if (!rawCreationCode) {
    throw new RegistrationError(
      'رمز إنشاء الكنيسة مطلوب لإتمام التسجيل.',
      403,
      'CREATION_CODE_REQUIRED',
    );
  }

  const codeHash = sha256Hex(rawCreationCode.toUpperCase().replace(/\s+/g, ''));
  const validCode = await platformQueryOne<{ id: string }>(
    `SELECT "id" FROM "church_creation_codes"
     WHERE "codeHash" = $1
       AND "status" = 'active'
       AND "revokedAt" IS NULL
       AND ("expiresAt" IS NULL OR "expiresAt" > now())
       AND "usedCount" < "maxUses"
     LIMIT 1`,
    [codeHash],
  );

  if (!validCode) {
    throw new RegistrationError(
      'رمز إنشاء الكنيسة غير صالح أو منتهي الصلاحية أو مستنفد.',
      403,
      'INVALID_CREATION_CODE',
    );
  }

  const passwordHash = await hashPassword(input.adminPassword);
  const provisioningToken = randomToken(32);
  const tokenHash = sha256Hex(provisioningToken);
  const jobId = randomUUID();
  const churchId = randomUUID();
  const idempotencyKey = randomUUID();
  const churchCode = generateChurchCode();

  try {
    // Single atomic statement: the code is consumed only if the church row is
    // actually created, and concurrent attempts on the final use cannot both
    // succeed.
    const created = await platformQuery<{ id: string }>(
      `WITH consumed AS (
         UPDATE "church_creation_codes"
         SET "usedCount" = "usedCount" + 1,
             "lastUsedAt" = now(),
             "status" = CASE WHEN "usedCount" + 1 >= "maxUses" THEN 'depleted' ELSE 'active' END,
             "updatedAt" = now()
         WHERE "id" = $20
           AND "status" = 'active'
           AND "revokedAt" IS NULL
           AND ("expiresAt" IS NULL OR "expiresAt" > now())
           AND "usedCount" < "maxUses"
         RETURNING "id"
       ),
       new_church AS (
         INSERT INTO "churches"
           ("id", "slug", "name", "normalizedName", "legalName", "country", "city",
            "contactName", "contactEmail", "contactPhone", "status", "verificationStatus",
            "settings", "registrationIpHash", "termsAcceptedAt", "privacyAcceptedAt",
            "creationCodeId", "creatorName", "creatorEmail", "createdAt", "updatedAt")
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', 'unverified',
                $11::jsonb, $12, now(), now(), consumed."id", $13, $14, now(), now()
         FROM consumed
         RETURNING "id"
       ),
       new_job AS (
         INSERT INTO "provisioning_jobs"
           ("id", "churchId", "idempotencyKey", "provisioningTokenHash", "status", "currentStep",
            "seedPayload", "createdAt", "updatedAt")
         SELECT $15, "id", $16, $17, 'queued', 'queued', $18::jsonb, now(), now()
         FROM new_church
         RETURNING "id"
       ),
       new_code AS (
         INSERT INTO "church_codes"
           ("id", "churchId", "code", "revoked", "createdAt", "updatedAt")
         SELECT uuid_generate_v4(), "id", $19, false, now(), now()
         FROM new_church
         RETURNING "id"
       )
       SELECT "id" FROM new_church`,
      [
        churchId,
        slug,
        churchName,
        normalizedName,
        input.legalName?.trim().slice(0, 240) || null,
        input.country?.trim().slice(0, 2).toUpperCase() || null,
        city,
        contactName,
        contactEmail,
        input.contactPhone?.trim() || null,
        JSON.stringify({ timezone: input.timezone || 'Africa/Cairo' }),
        hashIp(input.ip ?? null),
        adminName,
        adminEmail,
        jobId,
        idempotencyKey,
        tokenHash,
        JSON.stringify({
          createAdmin: true,
          adminName,
          adminEmail,
          adminPhone,
          adminPasswordHash: passwordHash,
        }),
        churchCode,
        validCode.id,
      ],
    );

    if (created.length === 0) {
      throw new RegistrationError(
        'رمز إنشاء الكنيسة غير صالح أو منتهي الصلاحية أو مستنفد.',
        403,
        'INVALID_CREATION_CODE',
      );
    }
  } catch (error) {
    if (error instanceof RegistrationError) throw error;
    const code = (error as { code?: string }).code;
    if (code === '23505') {
      throw new RegistrationError('يوجد طلب تسجيل مطابق بالفعل.', 409, 'DUPLICATE_REGISTRATION');
    }
    throw error;
  }

  await recordPlatformAudit({
    actorType: 'public',
    action: 'church.registered',
    entityType: 'church',
    entityId: churchId,
    ip: input.ip ?? null,
    after: { slug, city, preview: (await getPreviewStatus()).mode },
  });

  return { churchId, slug, name: churchName, jobId, provisioningToken };
}

export interface ChurchListFilters {
  search?: string | null;
  status?: string | null;
  page: number;
  limit: number;
}

export async function listChurches(filters: ChurchListFilters): Promise<{
  data: Array<Record<string, unknown>>;
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  const search = filters.search?.trim() || null;
  const status = filters.status?.trim() || null;
  const offset = (filters.page - 1) * filters.limit;
  const rows = await platformQuery(
    `SELECT c."id", c."slug", c."name", c."legalName", c."country", c."city",
            c."contactName", c."contactEmail", c."contactPhone", c."status",
            c."verificationStatus", c."isLifetimeFree", c."primaryDomain", c."customDomain",
            c."databaseProvider", c."databaseName", c."databaseHost",
            c."creationCodeId", c."creatorName", c."creatorEmail", ccc."codePrefix" AS "creationCodePrefix",
            c."provisionedAt", c."activatedAt", c."suspendedAt", c."createdAt", c."updatedAt",
            (SELECT j."status" FROM "provisioning_jobs" j WHERE j."churchId" = c."id"
             ORDER BY j."createdAt" DESC LIMIT 1) AS "provisioningStatus",
            (SELECT j."currentStep" FROM "provisioning_jobs" j WHERE j."churchId" = c."id"
             ORDER BY j."createdAt" DESC LIMIT 1) AS "provisioningStep",
            (SELECT j."lastErrorCode" FROM "provisioning_jobs" j WHERE j."churchId" = c."id"
             ORDER BY j."createdAt" DESC LIMIT 1) AS "provisioningErrorCode"
     FROM "churches" c
     LEFT JOIN "church_creation_codes" ccc ON ccc."id" = c."creationCodeId"
     WHERE ($1::text IS NULL OR c."name" ILIKE '%' || $1 || '%' OR c."slug" ILIKE '%' || $1 || '%'
            OR c."contactEmail" ILIKE '%' || $1 || '%')
       AND ($2::text IS NULL OR c."status" = $2)
       AND c."status" <> 'archived'
     ORDER BY c."createdAt" DESC
     LIMIT $3 OFFSET $4`,
    [search, status, filters.limit, offset],
  );
  const count = await platformQueryOne<{ total: number }>(
    `SELECT COUNT(*)::int AS "total" FROM "churches" c
     WHERE ($1::text IS NULL OR c."name" ILIKE '%' || $1 || '%' OR c."slug" ILIKE '%' || $1 || '%'
            OR c."contactEmail" ILIKE '%' || $1 || '%')
       AND ($2::text IS NULL OR c."status" = $2)
       AND c."status" <> 'archived'`,
    [search, status],
  );
  const total = count?.total ?? 0;
  return {
    data: rows,
    meta: {
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

export async function getChurchDetail(churchId: string): Promise<Record<string, unknown> | null> {
  return platformQueryOne(
    `SELECT c."id", c."slug", c."name", c."legalName", c."country", c."city",
            c."contactName", c."contactEmail", c."contactPhone", c."status",
            c."verificationStatus", c."verificationReference", c."isLifetimeFree",
            c."lifetimeFreeReason", c."primaryDomain", c."customDomain", c."databaseProvider",
            c."databaseName", c."databaseHost", c."providerResourceId", c."settings",
            c."provisionedAt", c."activatedAt", c."suspendedAt", c."createdAt", c."updatedAt",
            tc."urlFingerprint", tc."rotatedAt"
     FROM "churches" c
     LEFT JOIN "tenant_connections" tc ON tc."churchId" = c."id"
     WHERE c."id" = $1 LIMIT 1`,
    [churchId],
  );
}

export async function setChurchStatus(input: {
  churchId: string;
  status: 'active' | 'suspended';
  actorId: string | null;
  actorType?: 'platform_admin' | 'system';
  ip?: string | null;
  reason?: string;
}): Promise<void> {
  const church = await platformQueryOne<{
    status: string;
    provisionedAt: string | null;
  }>(
    `SELECT "status", "provisionedAt" FROM "churches" WHERE "id" = $1 LIMIT 1`,
    [input.churchId],
  );
  if (!church) throw new RegistrationError('الكنيسة غير موجودة.', 404, 'CHURCH_NOT_FOUND');

  if (input.status === 'active') {
    const connection = await platformQueryOne<{ churchId: string }>(
      `SELECT "churchId" FROM "tenant_connections" WHERE "churchId" = $1 LIMIT 1`,
      [input.churchId],
    );
    if (!connection || !church.provisionedAt) {
      throw new RegistrationError(
        'لا يمكن تفعيل الكنيسة قبل نجاح تجهيز قاعدة بياناتها.',
        409,
        'CHURCH_NOT_PROVISIONED',
      );
    }
  }

  await platformQuery(
    `UPDATE "churches"
     SET "status" = $2::text,
         "suspendedAt" = CASE WHEN $2 = 'suspended' THEN now() ELSE NULL END,
         "activatedAt" = CASE WHEN $2 = 'active' THEN COALESCE("activatedAt", now()) ELSE "activatedAt" END,
         "updatedAt" = now()
     WHERE "id" = $1`,
    [input.churchId, input.status],
  );
  const { invalidateTenantCache } = await import('../tenant/resolve');
  invalidateTenantCache(input.churchId);
  invalidateEntitlementCache(input.churchId);
  await recordPlatformAudit({
    actorId: input.actorId,
    actorType: input.actorType ?? 'platform_admin',
    action: input.status === 'active' ? 'church.activated' : 'church.suspended',
    entityType: 'church',
    entityId: input.churchId,
    ip: input.ip ?? null,
    before: { status: church.status },
    after: { status: input.status, reason: input.reason ?? null },
  });
}

export async function setChurchVerification(input: {
  churchId: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  verificationReference?: string | null;
  actorId: string | null;
  ip?: string | null;
}): Promise<void> {
  await platformQuery(
    `UPDATE "churches"
     SET "verificationStatus" = $2, "verificationReference" = $3, "updatedAt" = now()
     WHERE "id" = $1`,
    [input.churchId, input.verificationStatus, input.verificationReference?.slice(0, 240) || null],
  );
  await recordPlatformAudit({
    actorId: input.actorId,
    action: 'church.verification_changed',
    entityType: 'church',
    entityId: input.churchId,
    ip: input.ip ?? null,
    after: { verificationStatus: input.verificationStatus },
  });
}

export async function getPlatformStats(): Promise<{
  churches: { total: number; active: number; pending: number; suspended: number; failed: number };
  preview: Awaited<ReturnType<typeof getPreviewStatus>>;
  recentRegistrations: number;
  lifetimeFreeChurches: number;
  provisioning: { queued: number; running: number; failed: number };
}> {
  const [counts, recent, lifetime, provisioning, preview] = await Promise.all([
    platformQuery<{ status: string; count: number }>(
      `SELECT "status", COUNT(*)::int AS "count" FROM "churches" WHERE "status" <> 'archived' GROUP BY "status"`,
    ),
    platformQueryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS "count" FROM "churches" WHERE "createdAt" > now() - interval '30 days'`,
    ),
    platformQueryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS "count" FROM "churches" WHERE "isLifetimeFree" = true AND "status" = 'active'`,
    ),
    platformQuery<{ status: string; count: number }>(
      `SELECT "status", COUNT(*)::int AS "count" FROM "provisioning_jobs" GROUP BY "status"`,
    ),
    getPreviewStatus(),
  ]);
  const byStatus = new Map(counts.map((row) => [row.status, row.count]));
  const byProvisioning = new Map(provisioning.map((row) => [row.status, row.count]));
  return {
    churches: {
      total: counts.reduce((sum, row) => sum + row.count, 0),
      active: byStatus.get('active') ?? 0,
      pending: byStatus.get('pending') ?? 0,
      suspended: byStatus.get('suspended') ?? 0,
      failed: byStatus.get('failed') ?? 0,
    },
    preview,
    recentRegistrations: recent?.count ?? 0,
    lifetimeFreeChurches: lifetime?.count ?? 0,
    provisioning: {
      queued: byProvisioning.get('queued') ?? 0,
      running: byProvisioning.get('running') ?? 0,
      failed: byProvisioning.get('failed') ?? 0,
    },
  };
}

/**
 * One-time migration helper for the original single-church deployment.
 * It never copies or deletes church data: the existing database is linked
 * as the first tenant and receives additive RBAC/auth migrations.
 */
export async function registerExistingChurch(input: {
  slug: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  city?: string;
  primaryDomain?: string;
  connectionString: string;
  verificationReference?: string;
  lifetimeFree?: boolean;
  actorId?: string | null;
  ip?: string | null;
}): Promise<{ churchId: string; slug: string; tables: string[] }> {
  if (!isValidSlug(input.slug)) {
    throw new RegistrationError('Invalid church slug', 400, 'INVALID_SLUG');
  }
  const existing = await platformQueryOne<{ id: string; slug: string }>(
    `SELECT "id", "slug" FROM "churches" WHERE "slug" = $1 LIMIT 1`,
    [input.slug],
  );

  let churchId: string;
  if (existing) {
    churchId = existing.id;
    await platformQuery(
      `UPDATE "churches"
       SET "name" = $2, "normalizedName" = $3, "city" = COALESCE($4, "city"),
           "primaryDomain" = COALESCE($5, "primaryDomain"), "updatedAt" = now()
       WHERE "id" = $1`,
      [churchId, input.name, normalizeChurchName(input.name), input.city || null, input.primaryDomain || null],
    );
  } else {
    churchId = randomUUID();
    await platformQuery(
      `INSERT INTO "churches"
        ("id", "slug", "name", "normalizedName", "city", "contactName", "contactEmail",
         "contactPhone", "status", "verificationStatus", "primaryDomain", "settings",
         "termsAcceptedAt", "privacyAcceptedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, '{}'::jsonb,
               now(), now(), now(), now())`,
      [
        churchId,
        input.slug,
        input.name,
        normalizeChurchName(input.name),
        input.city || null,
        input.contactName,
        normalizeEmail(input.contactEmail),
        input.contactPhone || null,
        input.verificationReference ? 'verified' : 'unverified',
        input.primaryDomain || null,
      ],
    );
  }

  if (input.verificationReference) {
    await platformQuery(
      `UPDATE "churches" SET "verificationStatus" = 'verified', "verificationReference" = $2, "updatedAt" = now()
       WHERE "id" = $1`,
      [churchId, input.verificationReference],
    );
  }

  const result = await attachTenantDatabase({
    churchId,
    connectionString: input.connectionString,
    provider: 'manual',
  });

  if (input.lifetimeFree && input.verificationReference) {
    await grantLifetimeFree({
      churchId,
      verificationReference: input.verificationReference,
      reason: 'Verified lifetime-free exception for the original church.',
      verifiedBy: input.actorId ?? null,
    });
  } else {
    await grantPreviewEntitlements(churchId);
  }

  await recordPlatformAudit({
    actorId: input.actorId ?? null,
    actorType: input.actorId ? 'platform_admin' : 'system',
    action: 'church.existing_imported',
    entityType: 'church',
    entityId: churchId,
    ip: input.ip ?? null,
    after: { slug: input.slug, lifetimeFree: input.lifetimeFree === true },
  });

  return { churchId, slug: input.slug, tables: result.tables };
}
