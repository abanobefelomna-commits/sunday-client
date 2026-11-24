import test from 'node:test';
import assert from 'node:assert/strict';
import { neon } from '@neondatabase/serverless';

import { databaseUrl, platformDatabaseUrl, loadEnv } from '../helpers/env.mjs';

loadEnv();

const tenantUrl = databaseUrl();
const platformUrl = platformDatabaseUrl();
const skipTenant = tenantUrl ? false : 'DATABASE_URL is not configured';
const skipPlatform = platformUrl ? false : 'PLATFORM_DATABASE_URL is not configured';

const tenant = tenantUrl ? neon(tenantUrl) : null;
const platform = platformUrl ? neon(platformUrl) : null;

const EXISTING_CHURCH_ID = 'c0000000-0000-4000-8000-000000000001';

test('class leader column exists and every legacy leader role has an assignment', { skip: skipTenant }, async () => {
  const columns = await tenant.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'leadServantId'`,
  );
  assert.equal(columns.length, 1, 'classes.leadServantId must exist');

  const [legacy] = await tenant.query(
    `SELECT count(*)::int AS c
     FROM "classes" c
     WHERE c."leadServantId" IS NULL
       AND EXISTS (
         SELECT 1
         FROM "servants" s
         JOIN "servants_classes" sc ON sc."servantsId" = s."id"
         WHERE sc."classesId" = c."id" AND s."role" = 'قائد فصل'
       )`,
  );
  assert.equal(legacy.c, 0, 'legacy class leaders must be preserved through leadServantId');

  const [counts] = await tenant.query(
    `SELECT
       (SELECT count(*)::int FROM "servants") AS servants,
       (SELECT count(*)::int FROM "children") AS children,
       (SELECT count(*)::int FROM "users") AS users`,
  );
  assert.ok(counts.servants >= 12, 'existing servants must remain');
  assert.ok(counts.children >= 39, 'existing children must remain');
  assert.ok(counts.users >= 25, 'existing users must remain');
});

test('auth schema required by registration and email verification is applied', { skip: skipTenant }, async () => {
  const columns = await tenant.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'servantRole'`,
  );
  assert.equal(columns.length, 1, 'users.servantRole must exist for registration and verification');

  const [migration] = await tenant.query(
    `SELECT count(*)::int AS c FROM "tenant_migrations" WHERE "name" = '005_security_hardening'`,
  );
  assert.equal(migration.c, 1, 'security-hardening migration must be recorded');

  const [unlinked] = await tenant.query(
    `SELECT count(*)::int AS c
     FROM "servants" s
     WHERE s."userId" IS NULL
       AND EXISTS (
         SELECT 1 FROM "users" u
         WHERE (
           (NULLIF(btrim(s."email"), '') IS NOT NULL AND lower(btrim(s."email")) = lower(btrim(u."email")))
           OR (NULLIF(btrim(s."phone"), '') IS NOT NULL AND btrim(s."phone") = btrim(u."phone"))
         )
         AND NOT EXISTS (SELECT 1 FROM "servants" linked WHERE linked."userId" = u."id")
       )`,
  );
  assert.equal(unlinked.c, 0, 'unambiguous servant/user matches must be linked');
});

test('servant attendance table enforces one record per servant per date', { skip: skipTenant }, async () => {
  const [table] = await tenant.query(`SELECT to_regclass('public.servant_attendance') AS name`);
  assert.equal(table.name, 'servant_attendance');

  const constraints = await tenant.query(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'servant_attendance'::regclass AND contype = 'u'`,
  );
  assert.ok(
    constraints.some((row) => row.conname === 'UQ_servant_attendance_servant_date'),
    'servant/date uniqueness constraint must exist',
  );

  const columns = await tenant.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'servant_attendance'`,
  );
  const names = new Set(columns.map((row) => row.column_name));
  for (const required of ['servantId', 'classId', 'date', 'status', 'recordedBy']) {
    assert.equal(names.has(required), true, `servant_attendance.${required} must exist`);
  }
});

test('promotion history table exists and preserves source and destination classes', { skip: skipTenant }, async () => {
  const [table] = await tenant.query(`SELECT to_regclass('public.class_promotions') AS name`);
  assert.equal(table.name, 'class_promotions');

  const columns = await tenant.query(
    `SELECT column_name, is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'class_promotions'`,
  );
  const byName = new Map(columns.map((row) => [row.column_name, row.is_nullable]));
  for (const required of ['childId', 'fromClassId', 'toClassId', 'academicYear', 'promotedBy', 'promotedAt']) {
    assert.equal(byName.has(required), true, `class_promotions.${required} must exist`);
  }
  assert.equal(byName.get('childId'), 'NO');
  assert.equal(byName.get('fromClassId'), 'YES', 'deleted source classes must not erase history');
});

test('the Virgin Mary church and its data survive with an active invitation code', { skip: skipPlatform }, async () => {
  const [church] = await platform.query(
    `SELECT "name", "status", "isLifetimeFree"
     FROM "churches" WHERE "id" = $1`,
    [EXISTING_CHURCH_ID],
  );
  assert.ok(church, 'existing church must remain');
  assert.equal(church.name, 'كنيسة السيدة العذراء مريم');
  assert.equal(church.status, 'active');
  assert.equal(church.isLifetimeFree, true);

  const [codes] = await platform.query(
    `SELECT array_agg("purpose" ORDER BY "purpose") AS purposes FROM "church_codes"
     WHERE "churchId" = $1 AND "revoked" = false`,
    [EXISTING_CHURCH_ID],
  );
  assert.deepEqual(
    codes.purposes,
    ['admin', 'join', 'priest'],
    'the church must have one active code for joining, admin registration, and priest registration',
  );

  const duplicates = await platform.query(
    `SELECT "churchId", "purpose" FROM "church_codes"
     WHERE "revoked" = false
     GROUP BY "churchId", "purpose" HAVING count(*) > 1`,
  );
  assert.equal(duplicates.length, 0, 'no church may have two active codes with the same purpose');
});
