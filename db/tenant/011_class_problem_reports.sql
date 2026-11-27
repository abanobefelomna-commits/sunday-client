-- =============================================================================
-- Migration 011: Class-level problems / requests center
-- A servant reports a problem or request for their class ("مشاكل الفصول"),
-- and responsible users (class leader, admin, priest) follow it up, change
-- its status, add a resolution note, and mark it resolved or closed.
-- Safe, additive, idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "class_problem_reports" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "classId" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "reporterId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "category" varchar(40) NOT NULL,
  "title" varchar(180) NOT NULL,
  "description" text NOT NULL,
  "priority" varchar(12) NOT NULL DEFAULT 'medium',
  "status" varchar(16) NOT NULL DEFAULT 'new',
  "resolutionNote" text,
  "resolvedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "class_problem_reports_status_check"
    CHECK ("status" IN ('new', 'in_progress', 'resolved', 'closed')),
  CONSTRAINT "class_problem_reports_priority_check"
    CHECK ("priority" IN ('low', 'medium', 'high', 'urgent'))
);

CREATE INDEX IF NOT EXISTS "IDX_class_problem_reports_class"
  ON "class_problem_reports" ("classId", "status" DESC);
CREATE INDEX IF NOT EXISTS "IDX_class_problem_reports_status"
  ON "class_problem_reports" ("status");
CREATE INDEX IF NOT EXISTS "IDX_class_problem_reports_reporter"
  ON "class_problem_reports" ("reporterId");

INSERT INTO "tenant_migrations" ("name") VALUES ('011_class_problem_reports')
ON CONFLICT ("name") DO NOTHING;