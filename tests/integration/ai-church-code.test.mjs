import test from 'node:test';
import assert from 'node:assert/strict';
import { neon } from '@neondatabase/serverless';

import { databaseUrl, platformDatabaseUrl, loadEnv } from '../helpers/env.mjs';
import { notifyChurchCodeRecipients } from '../../src/server/church-code-notifications.ts';
import { buildAiDataContext } from '../../src/server/ai/context.ts';
import { runWithTenant } from '../../src/server/tenant/context.ts';

loadEnv();

const tenantUrl = databaseUrl();
const platformUrl = platformDatabaseUrl();
const skipTenant = tenantUrl ? false : 'DATABASE_URL is not configured';
const skipPlatform = platformUrl ? false : 'PLATFORM_DATABASE_URL is not configured';

const tenant = tenantUrl ? neon(tenantUrl) : null;
const platform = platformUrl ? neon(platformUrl) : null;

const CHURCH_ID = 'c0000000-0000-4000-8000-000000000001';

function tenantContext() {
  return {
    churchId: CHURCH_ID,
    slug: 'sunday-school',
    name: 'Church of the Virgin Mary',
    status: 'active',
    verificationStatus: 'verified',
    isLifetimeFree: true,
    connectionString: tenantUrl,
    databaseName: null,
    databaseHost: null,
    timezone: 'Africa/Cairo',
  };
}

test('church-code notification schema is applied', { skip: skipTenant }, async () => {
  const [migration] = await tenant.query(
    `SELECT count(*)::int AS c FROM "tenant_migrations" WHERE "name" = '009_church_code_notifications'`,
  );
  assert.equal(migration.c, 1, 'migration 009 must be recorded');

  const [constraint] = await tenant.query(
    `SELECT pg_get_constraintdef(oid) AS def
     FROM pg_constraint WHERE conname = 'notifications_type_check'`,
  );
  assert.match(constraint.def, /church_code/);

  const [column] = await tenant.query(
    `SELECT count(*)::int AS c FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'churchCode'`,
  );
  assert.equal(column.c, 1, 'notification_preferences.churchCode must exist');
});

test(
  'active church code reaches privileged users exactly once',
  { skip: skipTenant || skipPlatform },
  async () => {
    const [active] = await platform.query(
      `SELECT "code", "churchId" FROM "church_codes"
       WHERE "churchId" = $1 AND "revoked" = false
       ORDER BY "createdAt" DESC LIMIT 1`,
      [CHURCH_ID],
    );
    assert.ok(active?.code, 'the live church must have an active invite code');

    const input = {
      code: active.code,
      churchName: 'كنيسة العذراء مريم',
      churchId: CHURCH_ID,
    };

    // The backfill already created these rows; a repeated call must not duplicate.
    const first = await notifyChurchCodeRecipients(tenant, input);
    const second = await notifyChurchCodeRecipients(tenant, input);
    assert.equal(second, 0, 'the same code must not notify twice');

    const [admin] = await tenant.query(
      `SELECT u."id" FROM "users" u WHERE u."role" = 'admin' AND u."isActive" = true LIMIT 1`,
    );
    assert.ok(admin?.id, 'an active admin must exist');

    const [delivered] = await tenant.query(
      `SELECT count(*)::int AS c FROM "notifications"
       WHERE "userId" = $1 AND "type" = 'church_code' AND "dedupeKey" = $2`,
      [admin.id, `church-code:${active.code}`],
    );
    assert.equal(delivered.c, 1, 'the admin must receive the church code notification');

    const [body] = await tenant.query(
      `SELECT "title", "body" FROM "notifications"
       WHERE "userId" = $1 AND "dedupeKey" = $2 LIMIT 1`,
      [admin.id, `church-code:${active.code}`],
    );
    assert.match(body.title, /رمز دعوة/);
    assert.ok(body.body.includes(active.code), 'the notification body must contain the code');

    const plainServants = await tenant.query(
      `SELECT u."id" FROM "users" u
       JOIN "servants" s ON s."userId" = u."id"
       WHERE s."role" = 'خادم' AND u."isActive" = true`,
    );
    for (const servant of plainServants) {
      const [row] = await tenant.query(
        `SELECT count(*)::int AS c FROM "notifications"
         WHERE "userId" = $1 AND "dedupeKey" = $2`,
        [servant.id, `church-code:${active.code}`],
      );
      assert.equal(row.c, 0, 'plain servants must not receive the church code by default');
    }

    assert.equal(typeof first, 'number');
  },
);

test('AI data context is scoped to the caller classes', { skip: skipTenant }, async () => {
  const classes = await tenant.query(
    `SELECT "id", "name" FROM "classes" WHERE "isActive" = true ORDER BY "sortOrder", "name"`,
  );
  assert.ok(classes.length >= 2, 'the live church must have at least two active classes');

  const [firstClass, secondClass] = classes;

  const privilegedContext = await runWithTenant(tenantContext(), () =>
    buildAiDataContext({
      privileged: true,
      classIds: [],
      userId: 'test-admin',
      role: 'admin',
      servantId: null,
      servantRole: null,
    }),
  );
  assert.match(privilegedContext, /كل الفصول وكل الأطفال/);
  assert.ok(privilegedContext.includes(firstClass.name));
  assert.ok(privilegedContext.includes(secondClass.name));

  const scopedContext = await runWithTenant(tenantContext(), () =>
    buildAiDataContext({
      privileged: false,
      classIds: [firstClass.id],
      userId: 'test-servant',
      role: 'servant',
      servantId: null,
      servantRole: 'خادم',
    }),
  );
  assert.match(scopedContext, /الفصل أو الفصول المرتبطة بحسابك فقط/);
  assert.ok(scopedContext.includes(firstClass.name));
  assert.ok(!scopedContext.includes(secondClass.name), 'other classes must not leak into servant context');

  const emptyContext = await runWithTenant(tenantContext(), () =>
    buildAiDataContext({
      privileged: false,
      classIds: [],
      userId: 'test-unlinked',
      role: 'servant',
      servantId: null,
      servantRole: 'خادم',
    }),
  );
  assert.match(emptyContext, /لا يوجد فصل مرتبط بحسابك/);
});
