#!/usr/bin/env node
/**
 * Safely registers the existing Church of the Virgin Mary (كنيسة السيدة العذراء مريم)
 * as the first tenant in the multi-church platform database, preserving:
 * - Existing church identity
 * - Lifetime-free exception
 * - All 25 registered users and 12 servants
 * - All primary keys, UUIDs, classes, children, attendance, and care records
 * - No destructive actions, drops, or deletions.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCipheriv, randomBytes, createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

function loadEnv(file = '.env') {
  let source;
  try { source = readFileSync(resolve(process.cwd(), file), 'utf8'); } catch { return; }
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1) : rawValue;
  }
}
loadEnv();

const EXISTING_CHURCH_ID = 'c0000000-0000-4000-8000-000000000001';
const EXISTING_CHURCH_SLUG = process.env.DEFAULT_TENANT_SLUG || 'sunday-school';
const EXISTING_CHURCH_NAME = 'كنيسة السيدة العذراء مريم';
const VERIFICATION_REFERENCE = 'FOUNDING_CHURCH_VERIFIED_2026';
const LIFETIME_FREE_REASON = 'الكنيسة المؤسسة لخدمة مدارس الأحد — استثناء مجاني مدى الحياة موثق';

const dbUrl = process.env.DATABASE_URL;
const platformUrl = process.env.PLATFORM_DATABASE_URL;
const tenantKeyRaw = process.env.TENANT_SECRET_KEY;

if (!dbUrl) throw new Error('DATABASE_URL is required');
if (!platformUrl) throw new Error('PLATFORM_DATABASE_URL is required');
if (!tenantKeyRaw) throw new Error('TENANT_SECRET_KEY is required');

const tenantKey = Buffer.from(tenantKeyRaw, 'base64');
if (tenantKey.length !== 32) throw new Error('TENANT_SECRET_KEY must be 32 bytes base64');

// 1. Verify backup exists
const backupFile = resolve(process.cwd(), 'backups', 'neondb_logical_backup.json');
if (!existsSync(backupFile)) {
  throw new Error(`Mandatory safeguard: backup file not found at ${backupFile}. Run node scripts/backup-logical.mjs first.`);
}
const backupData = JSON.parse(readFileSync(backupFile, 'utf8'));
console.log(`Verified backup loaded from ${backupFile} (timestamp: ${backupData.timestamp})`);

const tenantSql = neon(dbUrl);
const platformSql = neon(platformUrl);

// 2. Inspect source database and verify operational records
console.log('\n--- 1. Inspecting Source Church Database (neondb) ---');
const users = await tenantSql.query('SELECT "id", "name", "email", "phone", "role" FROM "users" ORDER BY "createdAt"');
console.log(`Found ${users.length} registered users in source database.`);
if (users.length !== backupData.counts.users) {
  throw new Error(`User count mismatch with backup: found ${users.length}, backup has ${backupData.counts.users}`);
}

const adminUser = users.find(u => u.role === 'admin') || users[0];
console.log(`Primary Administrator: ${adminUser.name} (${adminUser.email}, ${adminUser.phone})`);

const servants = await tenantSql.query('SELECT "id", "name", "role", "userId" FROM "servants"');
console.log(`Found ${servants.length} registered servants.`);

const classes = await tenantSql.query('SELECT "id", "name", "grade" FROM "classes"');
console.log(`Found ${classes.length} classes.`);

const children = await tenantSql.query('SELECT COUNT(*)::int AS c FROM "children"');
console.log(`Found ${children[0].c} children records.`);

// 3. Update church administrator display name in roles table (neondb)
console.log('\n--- 2. Ensuring Church Administrator Role Display Name is "أمين الخدمة" ---');
await tenantSql.query(`
  UPDATE "roles"
  SET "name" = 'أمين الخدمة'
  WHERE "code" = 'ADMIN'
`);
const updatedRole = await tenantSql.query(`SELECT "id", "code", "name" FROM "roles" WHERE "code" = 'ADMIN'`);
console.log(`ADMIN role name in church DB: "${updatedRole[0]?.name}"`);

// 4. Register church in central platform database
console.log('\n--- 3. Registering Existing Church in Central Platform Database ---');

function encryptSecret(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tenantKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

function fingerprintUrl(url) {
  try {
    const parsed = new URL(url);
    return createHash('sha256').update(`${parsed.protocol}//${parsed.hostname}:${parsed.port}${parsed.pathname}`).digest('hex');
  } catch {
    return createHash('sha256').update(url).digest('hex');
  }
}

const dbParsed = new URL(dbUrl);
const dbHost = dbParsed.hostname;
const dbName = dbParsed.pathname.replace(/^\//, '');

// Upsert church into platform churches table
await platformSql.query(`
  INSERT INTO "churches" (
    "id", "slug", "name", "normalizedName", "legalName",
    "country", "city", "contactName", "contactEmail", "contactPhone",
    "status", "verificationStatus", "verificationReference",
    "isLifetimeFree", "lifetimeFreeReason", "databaseProvider",
    "databaseName", "databaseHost", "settings",
    "termsAcceptedAt", "privacyAcceptedAt", "provisionedAt", "activatedAt",
    "createdAt", "updatedAt"
  ) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, $10,
    'active', 'verified', $11,
    true, $12, 'postgres',
    $13, $14, '{"timezone": "Africa/Cairo"}'::jsonb,
    now(), now(), now(), now(),
    now(), now()
  )
  ON CONFLICT ("id") DO UPDATE SET
    "slug" = EXCLUDED."slug",
    "name" = EXCLUDED."name",
    "normalizedName" = EXCLUDED."normalizedName",
    "legalName" = EXCLUDED."legalName",
    "status" = 'active',
    "verificationStatus" = 'verified',
    "verificationReference" = EXCLUDED."verificationReference",
    "isLifetimeFree" = true,
    "lifetimeFreeReason" = EXCLUDED."lifetimeFreeReason",
    "databaseProvider" = EXCLUDED."databaseProvider",
    "databaseName" = EXCLUDED."databaseName",
    "databaseHost" = EXCLUDED."databaseHost",
    "updatedAt" = now()
`, [
  EXISTING_CHURCH_ID,
  EXISTING_CHURCH_SLUG,
  EXISTING_CHURCH_NAME,
  EXISTING_CHURCH_NAME,
  EXISTING_CHURCH_NAME,
  'EG',
  'القاهرة',
  adminUser.name,
  adminUser.email,
  adminUser.phone,
  VERIFICATION_REFERENCE,
  LIFETIME_FREE_REASON,
  dbName,
  dbHost,
]);
console.log(`Church registered: ${EXISTING_CHURCH_NAME} (ID: ${EXISTING_CHURCH_ID}, slug: ${EXISTING_CHURCH_SLUG})`);

// 5. Tenant connection in platform
const encryptedUrl = encryptSecret(dbUrl);
const urlFingerprint = fingerprintUrl(dbUrl);

await platformSql.query(`
  INSERT INTO "tenant_connections" (
    "churchId", "provider", "encryptedUrl", "urlFingerprint", "databaseName", "databaseHost", "createdAt"
  ) VALUES (
    $1, 'postgres', $2, $3, $4, $5, now()
  )
  ON CONFLICT ("churchId") DO UPDATE SET
    "encryptedUrl" = EXCLUDED."encryptedUrl",
    "urlFingerprint" = EXCLUDED."urlFingerprint",
    "databaseName" = EXCLUDED."databaseName",
    "databaseHost" = EXCLUDED."databaseHost",
    "rotatedAt" = now()
`, [
  EXISTING_CHURCH_ID,
  encryptedUrl,
  urlFingerprint,
  dbName,
  dbHost,
]);
console.log(`Tenant connection secured for ${EXISTING_CHURCH_ID}`);

// 6. Lifetime-free grant record
await platformSql.query(`
  INSERT INTO "lifetime_free_grants" (
    "churchId", "verificationReference", "reason", "grantedAt"
  ) VALUES (
    $1, $2, $3, now()
  )
  ON CONFLICT ("churchId") DO UPDATE SET
    "verificationReference" = EXCLUDED."verificationReference",
    "reason" = EXCLUDED."reason",
    "revokedAt" = null
`, [
  EXISTING_CHURCH_ID,
  VERIFICATION_REFERENCE,
  LIFETIME_FREE_REASON,
]);
console.log(`Lifetime-free grant recorded in platform.`);

// 7. Seed full feature entitlements for lifetime-free church
const features = await platformSql.query('SELECT "code" FROM "features"');
for (const f of features) {
  await platformSql.query(`
    INSERT INTO "church_entitlements" (
      "churchId", "featureCode", "source", "enabled", "startsAt", "reason", "createdAt"
    ) VALUES (
      $1, $2, 'lifetime_free', true, now(), 'Founding church lifetime-free entitlement', now()
    )
    ON CONFLICT ("churchId", "featureCode", "source") DO UPDATE SET
      "enabled" = true,
      "endsAt" = null
  `, [EXISTING_CHURCH_ID, f.code]);
}
console.log(`Granted ${features.length} feature entitlements under lifetime-free source.`);

// 8. Establish tenant identity in tenant database (neondb)
console.log('\n--- 4. Recording Tenant Identity in Church Database ---');
await tenantSql.query(`
  INSERT INTO "tenant_identity" ("churchId", "slug", "provisionedAt", "schemaVersion")
  VALUES ($1, $2, now(), '1')
  ON CONFLICT ("churchId") DO UPDATE SET
    "slug" = EXCLUDED."slug"
`, [EXISTING_CHURCH_ID, EXISTING_CHURCH_SLUG]);
console.log(`Tenant identity bound to ${EXISTING_CHURCH_ID} in church DB.`);

// 9. Post-migration data validation: verify no records lost
console.log('\n--- 5. Post-Registration Safeguard Count Verification ---');
const tables = await tenantSql.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  ORDER BY table_name
`);

let validationPassed = true;
const afterCounts = {};
for (const { table_name } of tables) {
  const [res] = await tenantSql.query(`SELECT COUNT(*)::int AS c FROM "${table_name}"`);
  afterCounts[table_name] = res.c;
  const before = backupData.counts[table_name];
  if (before !== undefined && res.c < before) {
    console.error(`CRITICAL: Table ${table_name} count decreased! Before: ${before}, After: ${res.c}`);
    validationPassed = false;
  }
}

if (!validationPassed) {
  throw new Error('Data validation failed: one or more tables lost records!');
}

console.log('Record count verification passed for all tables!');
console.log(`Users: ${afterCounts.users} (preserved)`);
console.log(`Servants: ${afterCounts.servants} (preserved)`);
console.log(`Classes: ${afterCounts.classes} (preserved)`);
console.log(`Children: ${afterCounts.children} (preserved)`);
console.log(`Attendance: ${afterCounts.attendance} (preserved)`);
console.log(`Tenant identity: ${afterCounts.tenant_identity} (active)`);

console.log('\nExisting Church Registration COMPLETED SAFELY.');
