import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

const classLeaderMigration = read('db/tenant/006_class_leader.sql');
const attendanceMigration = read('db/tenant/007_servant_attendance.sql');
const promotionMigration = read('db/tenant/008_class_promotions.sql');
const churchCodesMigration = read('db/platform/003_church_codes.sql');

const classDetailRoute = read('app/api/classes/[id]/route.ts');
const attendanceRoute = read('app/api/servants/attendance/route.ts');
const registerRoute = read('app/api/auth/register/route.ts');
const churchCodeRoute = read('app/api/auth/church-code/route.ts');
const churchCodeAdminRoute = read('app/api/churches/code/route.ts');
const promotionRoute = read('app/api/promotion/route.ts');
const bibleWidget = read('app/components/BibleWidget.tsx');
const bundledTenantSchema = read('src/server/tenant/schema.generated.ts');

test('the bundled tenant schema contains every tenant migration on disk', () => {
  const onDisk = readdirSync(resolve(process.cwd(), 'db/tenant'))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const bundled = [...bundledTenantSchema.matchAll(/"name": "([^"]+\.sql)"/g)]
    .map((match) => match[1])
    .sort();

  assert.deepEqual(bundled, onDisk, 'run scripts/bundle-tenant-schema.mjs after adding a migration');

  // New churches must receive every migration the live church has applied.
  for (const name of ['006_class_leader.sql', '007_servant_attendance.sql', '008_class_promotions.sql']) {
    assert.ok(bundled.includes(name), `${name} must be bundled for provisioning`);
  }
  assert.match(bundledTenantSchema, /leadServantId/);
  assert.match(bundledTenantSchema, /servant_attendance/);
  assert.match(bundledTenantSchema, /class_promotions/);
});

test('class leader migration is additive, backfills legacy leaders and keeps history', () => {
  assert.match(classLeaderMigration, /ADD COLUMN IF NOT EXISTS "leadServantId" uuid/);
  assert.match(classLeaderMigration, /FOREIGN KEY \("leadServantId"\) REFERENCES "servants"\("id"\)/);
  assert.match(classLeaderMigration, /ON DELETE SET NULL NOT VALID/);
  assert.match(classLeaderMigration, /WHERE sc\."classesId" = c\."id" AND s\."role" = 'قائد فصل'/);
  assert.match(classLeaderMigration, /WHERE c\."leadServantId" IS NULL/);
  assert.match(classLeaderMigration, /INSERT INTO "tenant_migrations"/);
  assert.doesNotMatch(classLeaderMigration, /\b(DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(classLeaderMigration, /\bDELETE\s+FROM\b/i);
});

test('servant attendance migration is additive and prevents duplicate daily records', () => {
  assert.match(attendanceMigration, /CREATE TABLE IF NOT EXISTS "servant_attendance"/);
  assert.match(attendanceMigration, /CONSTRAINT "UQ_servant_attendance_servant_date" UNIQUE \("servantId", "date"\)/);
  assert.match(attendanceMigration, /"recordedBy" uuid REFERENCES "users"\("id"\)/);
  assert.match(attendanceMigration, /INSERT INTO "tenant_migrations"/);
  assert.doesNotMatch(attendanceMigration, /\b(DROP|TRUNCATE)\b/i);
});

test('promotion migration records history without replacing child or attendance data', () => {
  assert.match(promotionMigration, /CREATE TABLE IF NOT EXISTS "class_promotions"/);
  assert.match(promotionMigration, /"fromClassId" uuid REFERENCES "classes"\("id"\)/);
  assert.match(promotionMigration, /"toClassId" uuid REFERENCES "classes"\("id"\)/);
  assert.match(promotionMigration, /"childId" uuid NOT NULL REFERENCES "children"\("id"\)/);
  assert.match(promotionMigration, /"academicYear" varchar\(20\) NOT NULL/);
  assert.match(promotionMigration, /INSERT INTO "tenant_migrations"/);
  assert.doesNotMatch(promotionMigration, /\b(DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(promotionMigration, /\bDELETE\s+FROM\b/i);
});

test('church invitation codes are central, unique while active, and never imply a role', () => {
  assert.match(churchCodesMigration, /CREATE TABLE IF NOT EXISTS "church_codes"/);
  assert.match(churchCodesMigration, /"churchId" uuid NOT NULL REFERENCES "churches"\("id"\)/);
  assert.match(churchCodesMigration, /"code" varchar\(64\) NOT NULL UNIQUE/);
  assert.match(churchCodesMigration, /CREATE UNIQUE INDEX IF NOT EXISTS "UQ_church_codes_active"/);
  assert.match(churchCodesMigration, /WHERE "revoked" = false/);
  assert.doesNotMatch(churchCodesMigration, /"role"|"userId"|"password"|"permissions"/i);

  assert.match(churchCodeRoute, /FROM "church_codes" cc/);
  assert.match(churchCodeRoute, /cc\."revoked" = false/);
  assert.match(churchCodeRoute, /c\."status" = 'active'/);
  assert.match(churchCodeRoute, /church: \{ id: row\.id, slug: row\.slug, name: row\.name \}/);
  assert.doesNotMatch(churchCodeRoute, /password|permission|role/i);
});

test('class detail returns the assigned leader first and validates leader changes', () => {
  assert.match(classDetailRoute, /"leadServantId", "createdAt", "updatedAt"/);
  assert.match(
    classDetailRoute,
    /ORDER BY \(s\."id" = \$2::uuid\) DESC NULLS LAST/,
  );
  assert.match(classDetailRoute, /\(s\."role" = 'قائد فصل'\) DESC/);
  assert.match(classDetailRoute, /leadServant,/);
  assert.match(classDetailRoute, /قائد الفصل يجب أن يكون خادمًا معيّنًا لهذا الفصل/);
  assert.match(classDetailRoute, /"leadServantId" = CASE WHEN \$9::boolean THEN \$10::uuid/);
});

test('servant attendance API enforces church scope and class-leader authority', () => {
  assert.match(attendanceRoute, /WHERE c\."churchId" = \$1/);
  assert.match(attendanceRoute, /canManageServantAttendance/);
  assert.match(attendanceRoute, /access\.ledClassIds/);
  assert.match(attendanceRoute, /a\."classId" = ANY\(\$8::uuid\[\]\)/);
  assert.match(attendanceRoute, /ON CONFLICT \("servantId", "date"\) DO NOTHING/);
  assert.match(attendanceRoute, /byServant/);
  assert.match(attendanceRoute, /غير معيّن لهذا الفصل/);
  assert.match(attendanceRoute, /withTenant/);
});

test('registration resolves join codes and requires per-church codes for privileged roles', () => {
  assert.match(registerRoute, /platformQueryOne/);
  assert.match(registerRoute, /FROM "church_codes" cc/);
  assert.match(registerRoute, /explicitSlug = codeRow\.slug/);
  assert.match(registerRoute, /ignoreCookie: Boolean\(rawChurchCode\)/);
  assert.match(registerRoute, /cc\."purpose" = 'join'/);
  assert.match(registerRoute, /VALUES \(uuid_generate_v4\(\), \$1, \$2, false, true/);
  assert.match(registerRoute, /rawServantRole === 'class_leader'/);
  assert.match(registerRoute, /rawServantRole === 'admin'/);
  assert.match(registerRoute, /rawServantRole === 'priest'/);
  assert.match(registerRoute, /"purpose" = \$2/);
  assert.match(registerRoute, /requiresEmailVerification: false/);
  assert.match(registerRoute, /issueRefreshToken/);
  assert.doesNotMatch(registerRoute, /sendVerificationEmail|createOtp/);
  assert.doesNotMatch(registerRoute, /body\.role(?:\s|=)/);
});

test('church code administration is privileged and regenerating revokes previous codes', () => {
  assert.match(churchCodeAdminRoute, /if \(!access\.privileged\)/);
  assert.match(churchCodeAdminRoute, /SET "revoked" = true/);
  assert.match(churchCodeAdminRoute, /WHERE "churchId" = \$1 AND "purpose" = 'join' AND "revoked" = false/);
  assert.match(churchCodeAdminRoute, /INSERT INTO "church_codes"/);
  assert.match(churchCodeAdminRoute, /requireTenantContext\(\)/);
});

test('annual promotion is authorized, transactional and keeps historical records', () => {
  assert.match(promotionRoute, /canManagePromotions\(access\)/);
  assert.match(promotionRoute, /UPDATE "children"[\s\S]{0,120}SET "classId" = \$1/);
  assert.match(promotionRoute, /INSERT INTO "class_promotions"/);
  assert.match(promotionRoute, /await transaction\(statements\)/);
  assert.doesNotMatch(promotionRoute, /DELETE\s+FROM\s+"children"/i);
  assert.doesNotMatch(promotionRoute, /DELETE\s+FROM\s+"class_promotions"/i);
  assert.match(promotionRoute, /الترقية السنوية|الترقية/);
});

test('Bible widget supports pointer dragging without swallowing interactive controls', () => {
  assert.match(bibleWidget, /onPointerDown=\{handlePointerDown\}/);
  assert.match(bibleWidget, /onPointerMove=\{handlePointerMove\}/);
  assert.match(bibleWidget, /onPointerUp=\{endDrag\}/);
  assert.match(bibleWidget, /setPointerCapture/);
  assert.match(bibleWidget, /window\.innerWidth - width/);
  assert.match(bibleWidget, /window\.innerHeight - height/);
  assert.match(bibleWidget, /interactive !== event\.currentTarget/);
  assert.match(bibleWidget, /touchAction: "none"/);
  assert.match(bibleWidget, /translate3d/);
});
