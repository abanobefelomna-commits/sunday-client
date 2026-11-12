import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_CLASSES } from '../../src/server/class-defaults.ts';

const migration = readFileSync(resolve(process.cwd(), 'db/tenant/004_dynamic_classes.sql'), 'utf8');
const provisioning = readFileSync(resolve(process.cwd(), 'src/server/platform/provisioning.ts'), 'utf8');
const classesRoute = readFileSync(resolve(process.cwd(), 'app/api/classes/route.ts'), 'utf8');
const classDetailRoute = readFileSync(resolve(process.cwd(), 'app/api/classes/[id]/route.ts'), 'utf8');

test('new church class defaults are data, ordered, and distinct', () => {
  assert.deepEqual(
    DEFAULT_CLASSES.map(({ name }) => name),
    ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'General Group'],
  );
  assert.equal(new Set(DEFAULT_CLASSES.map(({ grade }) => grade)).size, 7);
  assert.deepEqual(DEFAULT_CLASSES.map(({ sortOrder }) => sortOrder), [1, 2, 3, 4, 5, 6, 7]);
});

test('dynamic class migration is additive and preserves class identities and history', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "isActive"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "sortOrder"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "churchId"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "nameKey"/);
  assert.match(migration, /ALTER COLUMN "grade" TYPE varchar\(60\) USING "grade"::text/);
  assert.match(migration, /FOREIGN KEY \("churchId"\) REFERENCES "tenant_identity" \("churchId"\)/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "UQ_classes_tenant_name_key"/);
  assert.match(migration, /INSERT INTO "tenant_migrations" \("name"\) VALUES \('004_dynamic_classes'\)/);
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\s+"classes"/i);
  assert.doesNotMatch(migration, /UPDATE\s+"classes"\s+SET\s+"id"/i);
});

test('class routes scope class records to the resolved church and refuse hard deletion', () => {
  assert.match(classesRoute, /c\."churchId" = \$1/);
  assert.match(classesRoute, /WHERE "churchId" = \$1/);
  assert.match(classDetailRoute, /"id" = \$1 AND "churchId" = \$2/);
  assert.match(classDetailRoute, /لا يمكن حذف الفصول/);
  assert.doesNotMatch(classDetailRoute, /DELETE\s+FROM\s+"classes"/i);
});

test('provisioning seeds default classes after the church identity exists', () => {
  const identityWrite = provisioning.indexOf('INSERT INTO "tenant_identity"');
  const classSeed = provisioning.indexOf('INSERT INTO "classes"', identityWrite);
  assert.notEqual(identityWrite, -1);
  assert.ok(classSeed > identityWrite);
  assert.match(provisioning.slice(classSeed, classSeed + 800), /ON CONFLICT DO NOTHING/);
});
