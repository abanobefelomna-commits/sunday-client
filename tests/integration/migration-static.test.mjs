import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(process.cwd(), 'db/migrations/20261108_smart_student_journey.sql'),
  'utf8',
);

test('migration is additive and idempotent', () => {
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS "pg_trgm"/);
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)/i);
  assert.doesNotMatch(sql, /TRUNCATE/i);

  for (const table of [
    'attendance_sessions',
    'educational_progress',
    'student_notes',
    'follow_up_rules',
    'follow_ups',
    'follow_up_activities',
    'notifications',
    'notification_preferences',
    'audit_logs',
  ]) {
    assert.match(
      sql,
      new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`),
      `missing idempotent create for ${table}`,
    );
  }

  assert.match(sql, /ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "deletedAt"/);
  assert.match(sql, /ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "assignedServantId"/);
  assert.match(sql, /ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "sessionId"/);
  assert.match(sql, /ON CONFLICT \("code"\) DO NOTHING/);
});

test('migration preserves the four attendance statuses through the existing enum', () => {
  assert.doesNotMatch(sql, /ALTER TYPE .*attendance/i);
  assert.doesNotMatch(sql, /ADD VALUE/i);
});

test('migration backfills attendance sessions without deleting legacy rows', () => {
  assert.match(sql, /INSERT INTO "attendance_sessions" \("classId", "date"\)/);
  assert.match(sql, /SELECT DISTINCT a\."classId", a\."date" FROM "attendance" a/);
  assert.match(sql, /ON CONFLICT \("classId", "date"\) DO NOTHING/);
  assert.match(sql, /UPDATE "attendance" a\s+SET "sessionId" = s\."id"/);
  assert.doesNotMatch(sql, /DELETE FROM "attendance"/i);
});

test('migration defines dedupe and scope indexes', () => {
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS "UQ_follow_ups_open_dedupe"/);
  assert.match(sql, /WHERE "dedupeKey" IS NOT NULL AND "status" IN \('open', 'in_progress'\)/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notifications_user_dedupe"/);
  assert.match(sql, /ON "notifications" \("userId", "dedupeKey"\)/);
  assert.match(sql, /IDX_children_class_active/);
  assert.match(sql, /IDX_audit_logs_entity/);
});

test('migration seeds explainable factual care rules only', () => {
  const seeds = [
    'repeated_absence',
    'declining_attendance',
    'overdue_visitation',
    'pending_follow_up',
  ];
  for (const code of seeds) {
    assert.match(sql, new RegExp(`\\('${code}'`), `missing seed ${code}`);
  }
  assert.doesNotMatch(sql, /نفسي|سلوكي|شخصية|تصنيف/i);
  assert.match(sql, /CHECK \("level" IN \('beginner', 'growing', 'proficient', 'advanced'\)\)/);
  assert.match(sql, /CHECK \("visibility" IN \('class', 'leaders', 'private'\)\)/);
});
