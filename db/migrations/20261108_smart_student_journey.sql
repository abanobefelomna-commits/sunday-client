-- Smart Student Journey & Care Management System
-- Additive, idempotent migration. Safe to re-run.
-- Preserves all existing rows and hard/soft removal behaviour.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---------------------------------------------------------------------------
-- 1. Soft removal for students (preserves historical attendance / care data)
-- ---------------------------------------------------------------------------
ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz;
ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "assignedServantId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FK_children_assigned_servant'
  ) THEN
    ALTER TABLE "children"
      ADD CONSTRAINT "FK_children_assigned_servant"
      FOREIGN KEY ("assignedServantId") REFERENCES "servants"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_children_class_active"
  ON "children" ("classId") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "IDX_children_assigned_servant"
  ON "children" ("assignedServantId") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "IDX_children_name_trgm"
  ON "children" USING gin ("name" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 2. Attendance sessions + audit columns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "attendance_sessions" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "classId" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "notes" varchar(500),
  "createdBy" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_attendance_sessions_class_date" UNIQUE ("classId", "date")
);

ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "sessionId" uuid;
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "updatedBy" uuid;
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FK_attendance_session'
  ) THEN
    ALTER TABLE "attendance"
      ADD CONSTRAINT "FK_attendance_session"
      FOREIGN KEY ("sessionId") REFERENCES "attendance_sessions"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FK_attendance_updated_by'
  ) THEN
    ALTER TABLE "attendance"
      ADD CONSTRAINT "FK_attendance_updated_by"
      FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_attendance_class_date" ON "attendance" ("classId", "date");
CREATE INDEX IF NOT EXISTS "IDX_attendance_child_date" ON "attendance" ("childId", "date" DESC);
CREATE INDEX IF NOT EXISTS "IDX_attendance_session" ON "attendance" ("sessionId");

-- Backfill one session per existing (class, date) pair and link rows.
INSERT INTO "attendance_sessions" ("classId", "date")
SELECT DISTINCT a."classId", a."date" FROM "attendance" a
ON CONFLICT ("classId", "date") DO NOTHING;

UPDATE "attendance" a
SET "sessionId" = s."id",
    "updatedBy" = COALESCE(a."updatedBy", a."recordedBy"),
    "updatedAt" = COALESCE(a."updatedAt", a."createdAt")
FROM "attendance_sessions" s
WHERE s."classId" = a."classId"
  AND s."date" = a."date"
  AND a."sessionId" IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Educational progress (explicitly educational, never psychological)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "educational_progress" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "childId" uuid NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "subject" varchar(120) NOT NULL,
  "level" varchar(20) NOT NULL DEFAULT 'growing'
    CHECK ("level" IN ('beginner', 'growing', 'proficient', 'advanced')),
  "score" numeric(5,2) CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100)),
  "notes" text,
  "assessedBy" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "assessedAt" date NOT NULL DEFAULT CURRENT_DATE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_educational_progress_child"
  ON "educational_progress" ("childId", "assessedAt" DESC);

-- ---------------------------------------------------------------------------
-- 4. Authorized student notes + soft removal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "student_notes" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "childId" uuid NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "authorId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "visibility" varchar(20) NOT NULL DEFAULT 'class'
    CHECK ("visibility" IN ('class', 'leaders', 'private')),
  "body" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz
);
CREATE INDEX IF NOT EXISTS "IDX_student_notes_child"
  ON "student_notes" ("childId", "createdAt" DESC)
  WHERE "deletedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Configurable follow-up rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "follow_up_rules" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "code" varchar(60) NOT NULL UNIQUE,
  "name" varchar(160) NOT NULL,
  "description" text,
  "ruleType" varchar(40) NOT NULL
    CHECK ("ruleType" IN ('repeated_absence', 'declining_attendance', 'overdue_visitation', 'pending_follow_up')),
  "threshold" integer NOT NULL CHECK ("threshold" >= 0),
  "windowDays" integer NOT NULL DEFAULT 30 CHECK ("windowDays" >= 1),
  "priority" varchar(10) NOT NULL DEFAULT 'medium'
    CHECK ("priority" IN ('low', 'medium', 'high')),
  "isActive" boolean NOT NULL DEFAULT true,
  "createdBy" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "follow_up_rules"
  ("code", "name", "description", "ruleType", "threshold", "windowDays", "priority")
VALUES
  ('repeated_absence', 'تكرار الغياب', 'فتح متابعة عند تكرار الغياب خلال نافذة زمنية محددة.', 'repeated_absence', 2, 30, 'high'),
  ('declining_attendance', 'انخفاض نسبة الحضور', 'فتح متابعة عند انخفاض نسبة الحضور بمقدار نقاط محدد مقارنة بالفترة السابقة.', 'declining_attendance', 20, 30, 'medium'),
  ('overdue_visitation', 'افتقاد متأخر', 'فتح متابعة عند مرور مدة محددة دون افتقاد مكتمل أو عند وجود افتقاد مجدول متأخر.', 'overdue_visitation', 45, 45, 'high'),
  ('pending_follow_up', 'متابعة معلّقة', 'تنبيه المسؤول عند وجود متابعة مفتوحة بلا نشاط لمدة محددة.', 'pending_follow_up', 7, 7, 'medium')
ON CONFLICT ("code") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Follow-up cases + activity history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "follow_ups" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "childId" uuid NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "classId" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "servantId" uuid REFERENCES "servants"("id") ON DELETE SET NULL,
  "ruleId" uuid REFERENCES "follow_up_rules"("id") ON DELETE SET NULL,
  "visitationId" uuid REFERENCES "visitations"("id") ON DELETE SET NULL,
  "status" varchar(20) NOT NULL DEFAULT 'open'
    CHECK ("status" IN ('open', 'in_progress', 'resolved', 'dismissed')),
  "priority" varchar(10) NOT NULL DEFAULT 'medium'
    CHECK ("priority" IN ('low', 'medium', 'high')),
  "source" varchar(20) NOT NULL DEFAULT 'manual'
    CHECK ("source" IN ('rule', 'manual', 'visitation')),
  "reason" text NOT NULL,
  "dedupeKey" varchar(180),
  "dueDate" date,
  "resolvedAt" timestamptz,
  "resolutionNotes" text,
  "createdBy" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_follow_ups_open_dedupe"
  ON "follow_ups" ("dedupeKey")
  WHERE "dedupeKey" IS NOT NULL AND "status" IN ('open', 'in_progress');
CREATE INDEX IF NOT EXISTS "IDX_follow_ups_child" ON "follow_ups" ("childId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_follow_ups_status_due" ON "follow_ups" ("status", "dueDate");
CREATE INDEX IF NOT EXISTS "IDX_follow_ups_servant" ON "follow_ups" ("servantId", "status");
CREATE INDEX IF NOT EXISTS "IDX_follow_ups_class" ON "follow_ups" ("classId", "status");

CREATE TABLE IF NOT EXISTS "follow_up_activities" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "followUpId" uuid NOT NULL REFERENCES "follow_ups"("id") ON DELETE CASCADE,
  "childId" uuid NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "type" varchar(20) NOT NULL DEFAULT 'note'
    CHECK ("type" IN ('note', 'call', 'message', 'visit', 'status_change', 'resolution', 'assignment')),
  "title" varchar(180) NOT NULL,
  "notes" text,
  "createdBy" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "occurredAt" timestamptz NOT NULL DEFAULT now(),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_follow_up_activities_case"
  ON "follow_up_activities" ("followUpId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_follow_up_activities_child"
  ON "follow_up_activities" ("childId", "occurredAt" DESC);

-- ---------------------------------------------------------------------------
-- 7. Notifications and per-user preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" varchar(40) NOT NULL
    CHECK ("type" IN ('follow_up_assigned', 'follow_up_overdue', 'follow_up_completed', 'attendance_alert')),
  "title" varchar(180) NOT NULL,
  "body" text,
  "entityType" varchar(40),
  "entityId" uuid,
  "dedupeKey" varchar(200),
  "readAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notifications_user_dedupe"
  ON "notifications" ("userId", "dedupeKey")
  WHERE "dedupeKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IDX_notifications_user_unread"
  ON "notifications" ("userId", "readAt", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "userId" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "followUpAssigned" boolean NOT NULL DEFAULT true,
  "followUpOverdue" boolean NOT NULL DEFAULT true,
  "followUpCompleted" boolean NOT NULL DEFAULT true,
  "attendanceAlert" boolean NOT NULL DEFAULT true,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 8. Audit log for sensitive modifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "actorId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" varchar(80) NOT NULL,
  "entityType" varchar(60) NOT NULL,
  "entityId" uuid,
  "before" jsonb,
  "after" jsonb,
  "ip" varchar(80),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity"
  ON "audit_logs" ("entityType", "entityId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actor"
  ON "audit_logs" ("actorId", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- 9. Visitation support indexes (existing feature remains intact)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "IDX_visitations_child_date"
  ON "visitations" ("childId", "date" DESC);
CREATE INDEX IF NOT EXISTS "IDX_visitations_status_follow_up"
  ON "visitations" ("status", "followUpDate");
CREATE INDEX IF NOT EXISTS "IDX_visitations_servant"
  ON "visitations" ("servantId", "date" DESC);
