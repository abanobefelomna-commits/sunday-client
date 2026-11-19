import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'db/tenant/009_church_code_notifications.sql'),
  'utf8',
);
const helper = readFileSync(
  resolve(process.cwd(), 'src/server/church-code-notifications.ts'),
  'utf8',
);
const provisioning = readFileSync(
  resolve(process.cwd(), 'src/server/platform/provisioning.ts'),
  'utf8',
);
const codeRoute = readFileSync(
  resolve(process.cwd(), 'app/api/churches/code/route.ts'),
  'utf8',
);

test('church-code migration is additive and keeps existing notification types', () => {
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)/i);
  assert.doesNotMatch(migration, /TRUNCATE|DELETE\s+FROM/i);

  for (const type of [
    'follow_up_assigned',
    'follow_up_overdue',
    'follow_up_completed',
    'attendance_alert',
    'church_code',
  ]) {
    assert.match(migration, new RegExp(`'${type}'`), `missing notification type ${type}`);
  }

  assert.match(migration, /ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_type_check"/);
  assert.match(migration, /ADD CONSTRAINT "notifications_type_check"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "churchCode" boolean NOT NULL DEFAULT true/);
  assert.match(migration, /'009_church_code_notifications'/);
});

test('church-code helper targets privileged accounts and dedupes per code', () => {
  assert.match(helper, /u\."role" IN \('admin', 'priest'\)/);
  assert.match(helper, /s\."role" IN \('مسؤول', 'أب كاهن'\)/);
  assert.match(helper, /u\."isActive" = true/);
  assert.match(helper, /church-code:\$\{/);
  assert.match(helper, /ON CONFLICT \("userId", "dedupeKey"\)/);
  assert.match(helper, /p\."churchCode" = false/);
});

test('church codes are notified at provisioning and after rotation', () => {
  const provisionIndex = provisioning.indexOf("'create_admin'");
  const notifyIndex = provisioning.indexOf("'notify_church_code'");
  assert.ok(provisionIndex >= 0, 'provisioning must create the administrator');
  assert.ok(notifyIndex > provisionIndex, 'notification step must run after administrator creation');
  assert.match(provisioning, /notifyChurchCodeRecipients\(neon\(database\.connectionString\)/);

  assert.match(codeRoute, /notifyChurchCodeRecipients\(getDb\(\)/);
  const rotateIndex = codeRoute.indexOf('platformTransaction([');
  const notifyRouteIndex = codeRoute.indexOf('notifyChurchCodeRecipients(');
  assert.ok(rotateIndex >= 0 && notifyRouteIndex > rotateIndex, 'rotation must notify after the new code is stored');
});
