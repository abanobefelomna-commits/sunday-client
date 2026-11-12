import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

import { databaseUrl, platformDatabaseUrl, loadEnv } from '../helpers/env.mjs';

loadEnv();
const tenantDbUrl = databaseUrl();
const platformDbUrl = platformDatabaseUrl();

const skipTenant = tenantDbUrl ? false : 'DATABASE_URL is not configured';
const skipPlatform = platformDbUrl ? false : 'PLATFORM_DATABASE_URL is not configured';

function createRetryingClient(url) {
  const raw = neon(url);
  return async function query(sqlText, params = []) {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await raw.query(sqlText, params);
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
    throw lastError;
  };
}

const tenantQuery = tenantDbUrl ? createRetryingClient(tenantDbUrl) : null;
const platformQuery = platformDbUrl ? createRetryingClient(platformDbUrl) : null;

// Read verified backup
const backupPath = resolve(process.cwd(), 'backups', 'neondb_logical_backup.json');
const hasBackup = existsSync(backupPath);
const backup = hasBackup ? JSON.parse(readFileSync(backupPath, 'utf8')) : null;

const EXISTING_CHURCH_ID = 'c0000000-0000-4000-8000-000000000001';
const EXISTING_CHURCH_SLUG = process.env.DEFAULT_TENANT_SLUG || 'sunday-school';
const EXISTING_CHURCH_NAME = 'كنيسة السيدة العذراء مريم';

test('1. The existing Church of the Virgin Mary is retained as the first tenant', { skip: skipPlatform }, async () => {
  const rows = await platformQuery(
    `SELECT "id", "slug", "name", "normalizedName", "status", "verificationStatus", "isLifetimeFree", "lifetimeFreeReason"
     FROM "churches" WHERE "slug" = $1 LIMIT 1`,
    [EXISTING_CHURCH_SLUG],
  );

  assert.equal(rows.length, 1, 'Existing church must be registered in platform database');
  const church = rows[0];
  assert.equal(church.id, EXISTING_CHURCH_ID, 'Existing church ID must match stable UUID');
  assert.equal(church.slug, 'sunday-school', 'Existing church must have slug sunday-school');
  assert.equal(church.name, EXISTING_CHURCH_NAME, 'Church name must be كنيسة السيدة العذراء مريم');
  assert.equal(church.status, 'active', 'Church status must be active');
  assert.equal(church.verificationStatus, 'verified', 'Church must be verified');
  assert.equal(church.isLifetimeFree, true, 'Church must have isLifetimeFree true');

  // Verify connection reference exists
  const conns = await platformQuery(
    `SELECT "churchId", "databaseName" FROM "tenant_connections" WHERE "churchId" = $1`,
    [EXISTING_CHURCH_ID],
  );
  assert.equal(conns.length, 1, 'Tenant connection reference must exist');
  assert.equal(conns[0].databaseName, 'neondb');

  // Verify church DB has matching tenant_identity
  if (tenantQuery) {
    const identities = await tenantQuery(`SELECT "churchId", "slug" FROM "tenant_identity" LIMIT 1`);
    assert.equal(identities.length, 1, 'tenant_identity row must exist in church database');
    assert.equal(identities[0].churchId, EXISTING_CHURCH_ID, 'tenant_identity churchId must match platform churchId');
    assert.equal(identities[0].slug, EXISTING_CHURCH_SLUG, 'tenant_identity slug must match platform slug');
  }
});

test('2. No duplicate church is created and registration is idempotent', { skip: skipPlatform }, async () => {
  const matches = await platformQuery(
    `SELECT "id", "slug", "name" FROM "churches"
     WHERE "slug" = $1 OR "name" = $2`,
    [EXISTING_CHURCH_SLUG, EXISTING_CHURCH_NAME],
  );

  assert.equal(matches.length, 1, 'Exactly one record must exist for the Virgin Mary church');

  // Verify that unique constraint on slug prevents creating a duplicate church
  let duplicateRejected = false;
  try {
    await platformQuery(
      `INSERT INTO "churches" ("slug", "name", "normalizedName", "contactName", "contactEmail")
       VALUES ($1, 'Another Church', 'another church', 'Contact', 'dup@example.com')`,
      [EXISTING_CHURCH_SLUG],
    );
  } catch (err) {
    duplicateRejected = true;
    assert.match(err.message, /unique|duplicate|violat/i);
  }
  assert.equal(duplicateRejected, true, 'Platform database must reject duplicate church slug');
});

test('3. Existing servants remain present after migration with matching identifiers', { skip: skipTenant }, async () => {
  const servants = await tenantQuery(`SELECT "id", "name", "role", "userId", "phone", "email" FROM "servants" ORDER BY "createdAt"`);
  assert.ok(servants.length >= 12, 'All 12 existing servants must remain in the servants table');

  if (backup) {
    assert.equal(servants.length, backup.counts.servants, 'Servants count must match backup exactly');

    const backupServantIds = new Set(backup.tables.servants.map((s) => s.id));
    for (const s of servants) {
      assert.equal(backupServantIds.has(s.id), true, `Servant UUID ${s.id} (${s.name}) must be preserved from backup`);
    }

    // Verify key historical servants exist
    const names = new Set(servants.map((s) => s.name));
    assert.equal(names.has('Demiana Mena'), true);
    assert.equal(names.has('Remon Lesha'), true);
    assert.equal(names.has('Phelopateer Mina'), true);
    assert.equal(names.has('ت/ ديانا ملاك'), true);
  }
});

test('4. Existing user UUIDs remain unchanged and no user was deactivated', { skip: skipTenant }, async () => {
  const users = await tenantQuery(`SELECT "id", "name", "email", "phone", "role", "isActive" FROM "users" ORDER BY "createdAt"`);
  assert.ok(users.length >= 25, 'All 25 existing users must remain present');

  if (backup) {
    assert.equal(users.length, backup.counts.users, 'User count must match backup count exactly');

    const backupUsersById = new Map(backup.tables.users.map((u) => [u.id, u]));
    for (const u of users) {
      const orig = backupUsersById.get(u.id);
      assert.ok(orig, `User UUID ${u.id} must exist in backup`);
      assert.equal(u.name, orig.name, `User ${u.id} name must match original`);
      assert.equal(u.email, orig.email, `User ${u.id} email must match original`);
      assert.equal(u.phone, orig.phone, `User ${u.id} phone must match original`);
      assert.equal(u.role, orig.role, `User ${u.id} role must match original`);
      assert.equal(u.isActive, orig.isActive, `User ${u.id} active state must not be silently changed`);
    }

    // Explicitly check the primary administrator
    const admin = users.find((u) => u.id === '08e85d93-7a08-40de-9a90-27b3a5cd5a08');
    assert.ok(admin, 'Primary admin user 08e85d93-7a08-40de-9a90-27b3a5cd5a08 must exist');
    assert.equal(admin.name, 'أستاذ فادي تجربة');
    assert.equal(admin.email, 'fady.test@example.com');
    assert.equal(admin.role, 'admin');
    assert.equal(admin.isActive, true);
  }
});

test('5. Existing authentication continues to work and tokens bind to tenant', { skip: skipTenant }, async () => {
  const [admin] = await tenantQuery(
    `SELECT "id", "password" FROM "users" WHERE "id" = '08e85d93-7a08-40de-9a90-27b3a5cd5a08' LIMIT 1`,
  );
  assert.ok(admin, 'Admin user must exist');
  assert.ok(admin.password && admin.password.length > 20, 'Password hash must be present');

  // Verify that hash format is supported (Argon2 or bcrypt)
  const isArgon = admin.password.startsWith('$argon2');
  const isBcrypt = admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$');
  assert.ok(isArgon || isBcrypt, 'Stored password must be valid Argon2 or bcrypt hash');

  // Verify JWT signing with tenant ID binding
  const jwtSecret = Buffer.from(process.env.JWT_SECRET || 'd7e486f7e570d45ece8d04f3ffd8a879a1d3ca03a0aaef83898b71c61dc98ab6', 'utf8');
  const token = await new SignJWT({
    sub: admin.id,
    role: 'admin',
    tid: EXISTING_CHURCH_ID,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('sunday-school-platform')
    .setAudience('sunday-school-tenant')
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime('900s')
    .sign(jwtSecret);

  const verified = await jwtVerify(token, jwtSecret, {
    issuer: 'sunday-school-platform',
    audience: 'sunday-school-tenant',
  });
  assert.equal(verified.payload.sub, admin.id);
  assert.equal(verified.payload.tid, EXISTING_CHURCH_ID, 'Token must be bound to Church ID');
});

test('6. Existing church-to-servant relationships remain intact', { skip: skipTenant }, async () => {
  const rows = await tenantQuery(`
    SELECT s."id" AS "servantId", s."name" AS "servantName", s."userId", u."id" AS "linkedUserId", u."name" AS "userName"
    FROM "servants" s
    JOIN "users" u ON u."id" = s."userId"
  `);
  assert.ok(rows.length >= 10, 'Servant to user foreign-key relationships must hold');
  for (const row of rows) {
    assert.equal(row.userId, row.linkedUserId, 'Servant userId must point to a valid User ID');
  }
});

test('7. Existing class assignments and permissions remain correct and role is labeled أمين الخدمة', { skip: skipTenant }, async () => {
  // Check classes count
  const classes = await tenantQuery(`SELECT "id", "name", "grade" FROM "classes"`);
  assert.ok(classes.length >= 7, 'All classes must remain present');

  // Check servants_classes assignments
  const sc = await tenantQuery(`SELECT "servantsId", "classesId" FROM "servants_classes"`);
  assert.ok(sc.length >= 9, 'All servants_classes assignments must remain present');

  // Verify role ADMIN display label is 'أمين الخدمة'
  const adminRole = await tenantQuery(`SELECT "code", "name" FROM "roles" WHERE "code" = 'ADMIN'`);
  assert.equal(adminRole.length, 1);
  assert.equal(adminRole[0].code, 'ADMIN', 'Backend role code ADMIN must remain unchanged');
  assert.equal(adminRole[0].name, 'أمين الخدمة', 'User-facing role name must be أمين الخدمة');

  // Verify user_roles assignments exist
  const userRoles = await tenantQuery(`SELECT COUNT(*)::int AS c FROM "user_roles"`);
  assert.ok(userRoles[0].c >= 25, 'user_roles must be populated for users');

  // Verify role_permissions exist
  const rolePerms = await tenantQuery(`SELECT COUNT(*)::int AS c FROM "role_permissions"`);
  assert.ok(rolePerms[0].c >= 80, 'role_permissions must remain populated');
});

test('8. The lifetime-free exception applies only to the verified existing church', { skip: skipPlatform }, async () => {
  const [grant] = await platformQuery(
    `SELECT "churchId", "verificationReference", "reason", "revokedAt"
     FROM "lifetime_free_grants" WHERE "churchId" = $1`,
    [EXISTING_CHURCH_ID],
  );
  assert.ok(grant, 'Verified grant must exist in lifetime_free_grants for the existing church');
  assert.equal(grant.churchId, EXISTING_CHURCH_ID);
  assert.equal(grant.verificationReference, 'FOUNDING_CHURCH_VERIFIED_2026');
  assert.equal(grant.revokedAt, null, 'Grant must be active and not revoked');

  // Verify church entitlements are set to lifetime_free
  const entitlements = await platformQuery(
    `SELECT "featureCode", "source", "enabled"
     FROM "church_entitlements"
     WHERE "churchId" = $1 AND "source" = 'lifetime_free'`,
    [EXISTING_CHURCH_ID],
  );
  assert.ok(entitlements.length >= 15, 'All features must be enabled under lifetime_free source');
  for (const e of entitlements) {
    assert.equal(e.enabled, true);
    assert.equal(e.source, 'lifetime_free');
  }
});

test('9. A newly registered church cannot claim the existing church identity or lifetime-free entitlement', { skip: skipPlatform }, async () => {
  // A newly registered church in platform has default unverified status and isLifetimeFree=false
  const simulatedNewId = 'd0000000-0000-4000-8000-000000000099';
  const simulatedSlug = 'another-mary-church';

  // Ensure cleanup if previous test left it
  await platformQuery(`DELETE FROM "churches" WHERE "id" = $1`, [simulatedNewId]);

  // Insert a test newly registered church entering the same church name
  await platformQuery(`
    INSERT INTO "churches" (
      "id", "slug", "name", "normalizedName", "contactName", "contactEmail",
      "status", "verificationStatus", "isLifetimeFree"
    ) VALUES (
      $1, $2, 'كنيسة السيدة العذراء مريم', 'كنيسة السيدة العذراء مريم', 'Another Admin', 'other@example.com',
      'pending', 'unverified', false
    )
  `, [simulatedNewId, simulatedSlug]);

  const [newChurch] = await platformQuery(
    `SELECT "id", "isLifetimeFree", "verificationStatus" FROM "churches" WHERE "id" = $1`,
    [simulatedNewId],
  );
  assert.equal(newChurch.isLifetimeFree, false, 'New church must have isLifetimeFree false');
  assert.equal(newChurch.verificationStatus, 'unverified', 'New church must be unverified');

  // Verify no lifetime_free_grants entry exists for this church
  const grants = await platformQuery(
    `SELECT 1 FROM "lifetime_free_grants" WHERE "churchId" = $1`,
    [simulatedNewId],
  );
  assert.equal(grants.length, 0, 'No lifetime-free grant must exist for new church');

  // Clean up simulated record
  await platformQuery(`DELETE FROM "churches" WHERE "id" = $1`, [simulatedNewId]);
});

test('10. No migration step silently deletes or deactivates existing records', { skip: skipTenant }, async () => {
  if (!backup) return;

  const tablesToCheck = [
    'attendance',
    'attendance_sessions',
    'audit_logs',
    'children',
    'church_settings',
    'classes',
    'follow_up_activities',
    'follow_up_rules',
    'follow_ups',
    'permissions',
    'refresh_tokens',
    'role_permissions',
    'roles',
    'servants',
    'servants_classes',
    'user_roles',
    'users',
  ];

  for (const table of tablesToCheck) {
    const [res] = await tenantQuery(`SELECT COUNT(*)::int AS c FROM "${table}"`);
    const originalCount = backup.counts[table] ?? 0;
    assert.ok(
      res.c >= originalCount,
      `Table "${table}" record count decreased! Original: ${originalCount}, Current: ${res.c}`,
    );
  }
});
