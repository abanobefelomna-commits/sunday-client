-- =============================================================================
-- Migration 007: Servant attendance
-- Tracks attendance for servants separately from children.
-- One record per servant per date, as required.
-- Safe, additive, idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "servant_attendance" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "servantId" uuid NOT NULL REFERENCES "servants"("id") ON DELETE CASCADE,
  "classId" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "status" "attendance_status_enum" NOT NULL DEFAULT 'present',
  "notes" varchar(500),
  "recordedBy" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_servant_attendance_servant_date" UNIQUE ("servantId", "date")
);

CREATE INDEX IF NOT EXISTS "IDX_servant_attendance_class_date"
  ON "servant_attendance" ("classId", "date" DESC);
CREATE INDEX IF NOT EXISTS "IDX_servant_attendance_servant_date"
  ON "servant_attendance" ("servantId", "date" DESC);
CREATE INDEX IF NOT EXISTS "IDX_servant_attendance_recordedBy"
  ON "servant_attendance" ("recordedBy");

INSERT INTO "tenant_migrations" ("name") VALUES ('007_servant_attendance')
ON CONFLICT ("name") DO NOTHING;
