import test from 'node:test';
import assert from 'node:assert/strict';
import { neon } from '@neondatabase/serverless';

import { databaseUrl, loadEnv } from '../helpers/env.mjs';

loadEnv();
const url = databaseUrl();
const skip = url ? false : 'DATABASE_URL is not configured';

let client;
function sql() {
  if (!client) client = neon(url);
  return client;
}

const EXPECTED_TABLES = [
  'attendance_sessions',
  'educational_progress',
  'student_notes',
  'follow_up_rules',
  'follow_ups',
  'follow_up_activities',
  'notifications',
  'notification_preferences',
  'audit_logs',
];

test('live database contains every table added by the migration', { skip }, async () => {
  const rows = await sql().query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [EXPECTED_TABLES],
  );
  const found = new Set(rows.map((row) => row.table_name));
  for (const table of EXPECTED_TABLES) {
    assert.equal(found.has(table), true, `missing table ${table}`);
  }
});

test('children support soft removal and a responsible servant', { skip }, async () => {
  const rows = await sql().query(
    `SELECT column_name, is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'children'`,
  );
  const columns = new Map(rows.map((row) => [row.column_name, row]));
  assert.equal(columns.has('deletedAt'), true);
  assert.equal(columns.has('assignedServantId'), true);
  assert.equal(columns.get('deletedAt').is_nullable, 'YES');
});

test('attendance keeps exactly the four supported statuses', { skip }, async () => {
  const column = await sql().query(
    `SELECT udt_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'status'`,
  );
  assert.equal(column.length, 1);
  const labels = await sql().query(
    `SELECT e.enumlabel
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typname = $1
     ORDER BY e.enumsortorder`,
    [column[0].udt_name],
  );
  assert.deepEqual(
    labels.map((row) => row.enumlabel),
    ['present', 'absent', 'late', 'excused'],
  );
});

test('care rules are seeded once with explainable thresholds', { skip }, async () => {
  const rows = await sql().query(
    `SELECT "code", "ruleType", "threshold", "windowDays", "priority", "isActive"
     FROM "follow_up_rules" WHERE "code" = ANY($1) ORDER BY "code"`,
    [['declining_attendance', 'overdue_visitation', 'pending_follow_up', 'repeated_absence']],
  );
  assert.deepEqual(
    rows.map((row) => row.code),
    ['declining_attendance', 'overdue_visitation', 'pending_follow_up', 'repeated_absence'],
  );
  for (const row of rows) {
    assert.equal(row.code, row.ruleType);
    assert.equal(typeof row.threshold, 'number');
    assert.equal(row.windowDays >= 1, true);
    assert.equal(['low', 'medium', 'high'].includes(row.priority), true);
    assert.equal(typeof row.isActive, 'boolean');
  }
});

test('dedupe indexes exist and hold no duplicates', { skip }, async () => {
  const indexes = await sql().query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1)`,
    [['UQ_follow_ups_open_dedupe', 'UQ_notifications_user_dedupe']],
  );
  assert.equal(indexes.length, 2);

  const duplicateCases = await sql().query(
    `SELECT "dedupeKey", COUNT(*)::int AS count
     FROM follow_ups
     WHERE "status" IN ('open', 'in_progress') AND "dedupeKey" IS NOT NULL
     GROUP BY "dedupeKey" HAVING COUNT(*) > 1`,
  );
  assert.deepEqual(duplicateCases, []);

  const duplicateNotifications = await sql().query(
    `SELECT "userId", "dedupeKey", COUNT(*)::int AS count
     FROM notifications WHERE "dedupeKey" IS NOT NULL
     GROUP BY "userId", "dedupeKey" HAVING COUNT(*) > 1`,
  );
  assert.deepEqual(duplicateNotifications, []);
});

test('legacy attendance rows are linked to sessions and no orphan remains', { skip }, async () => {
  const rows = await sql().query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE "sessionId" IS NOT NULL)::int AS linked
     FROM attendance`,
  );
  const [counts] = rows;
  assert.equal(counts.linked, counts.total);

  const orphans = await sql().query(
    `SELECT COUNT(*)::int AS count FROM attendance a
     WHERE a."sessionId" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM attendance_sessions s WHERE s."id" = a."sessionId")`,
  );
  assert.equal(orphans[0].count, 0);
});

test('soft-removed children are excluded from open operational views', { skip }, async () => {
  const rows = await sql().query(
    `SELECT COUNT(*)::int AS count
     FROM follow_ups f
     JOIN children c ON c."id" = f."childId"
     WHERE c."deletedAt" IS NOT NULL AND f."status" IN ('open', 'in_progress')`,
  );
  assert.equal(rows[0].count, 0);
});
