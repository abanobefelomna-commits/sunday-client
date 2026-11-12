-- =============================================================================
-- Tenant database baseline (one dedicated PostgreSQL database per church).
-- Reconstructed from the live single-church schema, additive and idempotent.
-- Safe to apply to the existing church database: no DROP / TRUNCATE / DELETE.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

DO $$ BEGIN
  CREATE TYPE "users_role_enum" AS ENUM ('admin', 'servant', 'priest');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "users_grades_enum" AS ENUM ('first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "classes_grade_enum" AS ENUM ('first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "servants_role_enum" AS ENUM ('خادم', 'خادم رئيسي', 'مشرف', 'خادم فقرة عامة', 'قائد فصل', 'مسؤول', 'أب كاهن');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "children_gender_enum" AS ENUM ('male', 'female');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "attendance_status_enum" AS ENUM ('present', 'absent', 'late', 'excused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "visitations_type_enum" AS ENUM ('home_visit', 'phone_call', 'church_meeting', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "visitations_status_enum" AS ENUM ('planned', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" varchar(160) NOT NULL,
  "email" varchar(320) NOT NULL,
  "emailVerified" boolean NOT NULL DEFAULT true,
  "phone" varchar(40) NOT NULL,
  "password" varchar(255) NOT NULL,
  "role" "users_role_enum" NOT NULL DEFAULT 'servant',
  "grades" "users_grades_enum"[] NOT NULL DEFAULT '{}',
  "avatar" varchar(500),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email" ON "users" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_phone" ON "users" ("phone");

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tokenHash" varchar(64) NOT NULL,
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expiresAt" timestamp NOT NULL,
  "revokedAt" timestamptz,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_refresh_tokens_hash" ON "refresh_tokens" ("tokenHash");
CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user" ON "refresh_tokens" ("userId") WHERE "revokedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "otp_codes" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "purpose" varchar(40) NOT NULL DEFAULT 'password_reset',
  "codeHash" varchar(128) NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "consumedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_otp_codes_user_purpose" ON "otp_codes" ("userId", "purpose");

-- ---------------------------------------------------------------------------
-- Classes and servants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "classes" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" varchar(160) NOT NULL,
  "grade" "classes_grade_enum" NOT NULL,
  "description" varchar(500),
  "image" varchar(500),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "academicYear" varchar(20)
);
CREATE INDEX IF NOT EXISTS "IDX_classes_grade" ON "classes" ("grade");

CREATE TABLE IF NOT EXISTS "servants" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" varchar(160) NOT NULL,
  "phone" varchar(40) NOT NULL,
  "email" varchar(320),
  "role" "servants_role_enum" NOT NULL DEFAULT 'خادم',
  "avatar" varchar(500),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_servants_phone" ON "servants" ("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_servants_email" ON "servants" ("email") WHERE "email" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "servants_classes" (
  "servantsId" uuid NOT NULL REFERENCES "servants"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "classesId" uuid NOT NULL REFERENCES "classes"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY ("servantsId", "classesId")
);
CREATE INDEX IF NOT EXISTS "IDX_servants_classes_servant" ON "servants_classes" ("servantsId");
CREATE INDEX IF NOT EXISTS "IDX_servants_classes_class" ON "servants_classes" ("classesId");

-- ---------------------------------------------------------------------------
-- Children
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "children" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" varchar(160) NOT NULL,
  "birthDate" date NOT NULL,
  "gender" "children_gender_enum" NOT NULL,
  "parentPhone" varchar(40),
  "parentName" varchar(160),
  "address" varchar(300),
  "notes" varchar(2000),
  "classId" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "phone" varchar(40),
  "avatar" varchar(500),
  "deletedAt" timestamptz,
  "assignedServantId" uuid REFERENCES "servants"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "IDX_children_class_active" ON "children" ("classId") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "IDX_children_assigned_servant" ON "children" ("assignedServantId") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "IDX_children_name_trgm" ON "children" USING gin ("name" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Attendance
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

CREATE TABLE IF NOT EXISTS "attendance" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "childId" uuid NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "classId" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "status" "attendance_status_enum" NOT NULL DEFAULT 'present',
  "notes" varchar(500),
  "recordedBy" uuid,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "sessionId" uuid REFERENCES "attendance_sessions"("id") ON DELETE SET NULL,
  "updatedBy" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_attendance_child_class_date" UNIQUE ("childId", "classId", "date")
);
CREATE INDEX IF NOT EXISTS "IDX_attendance_class_date" ON "attendance" ("classId", "date");
CREATE INDEX IF NOT EXISTS "IDX_attendance_child_date" ON "attendance" ("childId", "date" DESC);
CREATE INDEX IF NOT EXISTS "IDX_attendance_session" ON "attendance" ("sessionId");

-- ---------------------------------------------------------------------------
-- Care / follow-up
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
  ON "student_notes" ("childId", "createdAt" DESC) WHERE "deletedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "visitations" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "childId" uuid NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "servantId" uuid REFERENCES "servants"("id") ON DELETE SET NULL,
  "date" date NOT NULL,
  "type" "visitations_type_enum" NOT NULL DEFAULT 'home_visit',
  "status" "visitations_status_enum" NOT NULL DEFAULT 'completed',
  "notes" text,
  "followUpDate" date,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_visitations_child_date" ON "visitations" ("childId", "date" DESC);
CREATE INDEX IF NOT EXISTS "IDX_visitations_servant" ON "visitations" ("servantId", "date" DESC);
CREATE INDEX IF NOT EXISTS "IDX_visitations_status_follow_up" ON "visitations" ("status", "followUpDate");

CREATE TABLE IF NOT EXISTS "follow_up_rules" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "code" varchar(60) NOT NULL UNIQUE,
  "name" varchar(160) NOT NULL,
  "description" text,
  "ruleType" varchar(40) NOT NULL
    CHECK ("ruleType" IN ('repeated_absence', 'declining_attendance', 'overdue_visitation', 'pending_follow_up')),
  "threshold" integer NOT NULL CHECK ("threshold" >= 0),
  "windowDays" integer NOT NULL DEFAULT 30 CHECK ("windowDays" >= 1),
  "priority" varchar(10) NOT NULL DEFAULT 'medium' CHECK ("priority" IN ('low', 'medium', 'high')),
  "isActive" boolean NOT NULL DEFAULT true,
  "createdBy" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "follow_ups" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "childId" uuid NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "classId" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "servantId" uuid REFERENCES "servants"("id") ON DELETE SET NULL,
  "ruleId" uuid REFERENCES "follow_up_rules"("id") ON DELETE SET NULL,
  "visitationId" uuid REFERENCES "visitations"("id") ON DELETE SET NULL,
  "status" varchar(20) NOT NULL DEFAULT 'open'
    CHECK ("status" IN ('open', 'in_progress', 'resolved', 'dismissed')),
  "priority" varchar(10) NOT NULL DEFAULT 'medium' CHECK ("priority" IN ('low', 'medium', 'high')),
  "source" varchar(20) NOT NULL DEFAULT 'manual' CHECK ("source" IN ('rule', 'manual', 'visitation')),
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
  ON "follow_ups" ("dedupeKey") WHERE "dedupeKey" IS NOT NULL AND "status" IN ('open', 'in_progress');
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
-- News, notifications, audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "news" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "title" varchar(240),
  "content" text NOT NULL,
  "image" varchar(500),
  "isPinned" boolean NOT NULL DEFAULT false,
  "authorName" varchar(160),
  "authorRole" varchar(60),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "authorId" uuid REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "IDX_news_created" ON "news" ("isPinned" DESC, "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" varchar(40) NOT NULL
    CHECK ("type" IN ('follow_up_assigned', 'follow_up_overdue', 'follow_up_completed', 'attendance_alert')),
  "title" varchar(180) NOT NULL,
  "body" text,
  "entityType" varchar(60),
  "entityId" uuid,
  "dedupeKey" varchar(180),
  "readAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notifications_user_dedupe"
  ON "notifications" ("userId", "dedupeKey") WHERE "dedupeKey" IS NOT NULL;
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
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actor" ON "audit_logs" ("actorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity" ON "audit_logs" ("entityType", "entityId", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- Friday lesson preparation (present in migrations but missing in some live DBs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "friday_preparations" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "attendanceChecked" boolean NOT NULL DEFAULT false,
  "lessonTopic" text NOT NULL,
  "prepDate" date NOT NULL,
  "content" text NOT NULL,
  "submittedAt" timestamptz NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'submitted',
  UNIQUE ("userId", "prepDate")
);

-- ---------------------------------------------------------------------------
-- Legacy migration marker table kept for compatibility with existing tooling
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "migrations" (
  "id" serial PRIMARY KEY,
  "timestamp" bigint NOT NULL,
  "name" varchar(255) NOT NULL
);

-- ---------------------------------------------------------------------------
-- Default care rules (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO "follow_up_rules"
  ("code", "name", "description", "ruleType", "threshold", "windowDays", "priority")
VALUES
  ('repeated_absence', 'غياب متكرر', 'متابعة طفل تغيّب عن الحضور أكثر من الحد المسموح.', 'repeated_absence', 2, 30, 'high'),
  ('declining_attendance', 'تراجع الحضور', 'متابعة طفل انخفض حضوره بشكل ملحوظ خلال الفترة الأخيرة.', 'declining_attendance', 20, 30, 'medium'),
  ('overdue_visitation', 'افتقاد متأخر', 'متابعة طفل مرّ على آخر افتقاد له مدة طويلة.', 'overdue_visitation', 45, 45, 'high'),
  ('pending_follow_up', 'متابعة معلقة', 'حالة متابعة مفتوحة تحتاج إلى إجراء.', 'pending_follow_up', 7, 7, 'medium')
ON CONFLICT ("code") DO NOTHING;
