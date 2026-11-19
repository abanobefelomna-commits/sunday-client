-- =============================================================================
-- Migration 008: Annual class promotions
-- Records every child promotion while preserving the child's previous class
-- history and all attendance records.
-- Safe, additive, idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "class_promotions" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "childId" uuid NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "fromClassId" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "toClassId" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "academicYear" varchar(20) NOT NULL,
  "promotedBy" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "promotedAt" timestamptz NOT NULL DEFAULT now(),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_class_promotions_child"
  ON "class_promotions" ("childId", "promotedAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_class_promotions_year"
  ON "class_promotions" ("academicYear", "promotedAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_class_promotions_from"
  ON "class_promotions" ("fromClassId", "promotedAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_class_promotions_to"
  ON "class_promotions" ("toClassId", "promotedAt" DESC);

INSERT INTO "tenant_migrations" ("name") VALUES ('008_class_promotions')
ON CONFLICT ("name") DO NOTHING;
