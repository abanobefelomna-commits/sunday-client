-- =============================================================================
-- Migration 013: Offline attendance sync idempotency log
-- Records processed client operationId UUIDs so retries, reconnects, and
-- interrupted responses never duplicate attendance writes, audit logs, or alerts.
-- Safe, additive, idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "attendance_sync_operations" (
  "operationId" uuid PRIMARY KEY,
  "churchId" uuid NOT NULL,
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "classId" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "childId" uuid NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "status" "attendance_status_enum" NOT NULL,
  "processedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_attendance_sync_ops_user_processed"
  ON "attendance_sync_operations" ("userId", "processedAt" DESC);

CREATE INDEX IF NOT EXISTS "IDX_attendance_sync_ops_class_date"
  ON "attendance_sync_operations" ("classId", "date");

INSERT INTO "tenant_migrations" ("name") VALUES ('013_attendance_sync_idempotency')
ON CONFLICT ("name") DO NOTHING;
