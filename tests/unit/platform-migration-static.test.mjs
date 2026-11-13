import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('platform migration runner never falls back to the tenant database', () => {
  const source = read('scripts/migrate-platform.mjs');

  assert.match(source, /PLATFORM_DATABASE_URL/);
  assert.match(source, /Refusing to fall back to a tenant database/);
  assert.match(source, /isSamePostgresDatabase\(url, tenantUrl\)/);
  assert.match(source, /Refusing to create platform tables inside tenant data/);
  assert.match(source, /--check/);
  assert.match(source, /sql\.transaction/);
  assert.match(source, /REQUIRED_PLATFORM_TABLES/);
  assert.doesNotMatch(source, /DROP\s+(TABLE|DATABASE|SCHEMA)/i);
  assert.doesNotMatch(source, /TRUNCATE/i);
  assert.doesNotMatch(source, /createParentIfNotExists/i);
});

test('platform migration runner is idempotent through recorded history', () => {
  const source = read('scripts/migrate-platform.mjs');

  assert.match(source, /platform_migrations/);
  assert.match(source, /ON CONFLICT \("name"\) DO UPDATE/);
  assert.match(source, /Skipping already applied platform/);
});

test('platform preflight is read-only', () => {
  const source = read('scripts/verify-platform-db.mjs');

  assert.doesNotMatch(
    source,
    /\b(INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM|DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+(TABLE\s+)?"|ALTER\s+TABLE)\b/i,
    'preflight must not contain write or schema-change statements',
  );
  assert.match(source, /information_schema\.tables/);
  assert.match(source, /tenant_identity/);
  assert.match(source, /fingerprintConnectionUrl/);
  assert.match(source, /--deep/);
});

test('the platform schema inventory covers the registry tables', () => {
  const source = read('scripts/lib/platform-schema.mjs');
  const dir = resolve(process.cwd(), 'db/platform');
  const sql = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => read(`db/platform/${name}`))
    .join('\n');

  for (const table of [
    'platform_migrations',
    'churches',
    'tenant_connections',
    'platform_admins',
    'platform_settings',
  ]) {
    assert.match(source, new RegExp(`['"]${table}['"]`), `inventory is missing ${table}`);
    assert.match(
      sql,
      new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`),
      `schemas are missing ${table}`,
    );
  }

  assert.match(source, /REQUIRED_TENANT_COLUMNS/);
  assert.match(source, /nameKey/);
  assert.match(read('db/tenant/004_dynamic_classes.sql'), /ADD COLUMN IF NOT EXISTS "nameKey"/);
});

test('runtime platform resolution has no production tenant fallback', () => {
  const source = read('src/server/platform/config.ts');

  assert.match(source, /PLATFORM_DATABASE_URL_MISSING/);
  assert.match(source, /PLATFORM_DATABASE_URL_SHARED/);
  assert.match(source, /!isProduction\(\)\s*&&\s*\n\s*process\.env\.ALLOW_SHARED_PLATFORM_DATABASE === 'true'/);
  assert.match(source, /isSamePostgresDatabase\(configured, tenantUrl\)/);
});
