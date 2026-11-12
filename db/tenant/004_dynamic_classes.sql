-- =============================================================================
-- Migration 004: Dynamic Church-Specific Class Management
-- Safe, additive, idempotent migration.
-- Preserves all existing classes, UUIDs, assignments, children, attendance,
-- and history.
-- =============================================================================

ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "sortOrder" integer NOT NULL DEFAULT 0;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "churchId" uuid;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp without time zone;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "nameKey" varchar(160);

ALTER TABLE "classes" ALTER COLUMN "grade" TYPE varchar(60) USING "grade"::text;

UPDATE "classes"
SET "churchId" = (SELECT "churchId" FROM "tenant_identity" LIMIT 1)
WHERE "churchId" IS NULL AND EXISTS (SELECT 1 FROM "tenant_identity");

WITH unique_class_names AS (
  SELECT "churchId", lower(trim("name")) AS "nameKey"
  FROM "classes"
  WHERE "churchId" IS NOT NULL AND "deletedAt" IS NULL
  GROUP BY "churchId", lower(trim("name"))
  HAVING COUNT(*) = 1
)
UPDATE "classes" AS c
SET "nameKey" = unique_class_names."nameKey"
FROM unique_class_names
WHERE c."churchId" = unique_class_names."churchId"
  AND lower(trim(c."name")) = unique_class_names."nameKey"
  AND c."nameKey" IS NULL;

UPDATE "classes" SET "sortOrder" = 1 WHERE "grade" = 'first' AND "sortOrder" = 0;
UPDATE "classes" SET "sortOrder" = 2 WHERE "grade" = 'second' AND "sortOrder" = 0;
UPDATE "classes" SET "sortOrder" = 3 WHERE "grade" = 'third' AND "sortOrder" = 0;
UPDATE "classes" SET "sortOrder" = 4 WHERE "grade" = 'fourth' AND "sortOrder" = 0;
UPDATE "classes" SET "sortOrder" = 5 WHERE "grade" = 'fifth' AND "sortOrder" = 0;
UPDATE "classes" SET "sortOrder" = 6 WHERE "grade" = 'sixth' AND "sortOrder" = 0;
UPDATE "classes" SET "sortOrder" = 7 WHERE "grade" = 'general' AND "sortOrder" = 0;

CREATE INDEX IF NOT EXISTS "IDX_classes_isActive" ON "classes" ("isActive");
CREATE INDEX IF NOT EXISTS "IDX_classes_sortOrder" ON "classes" ("sortOrder", "createdAt");
CREATE INDEX IF NOT EXISTS "IDX_classes_churchId" ON "classes" ("churchId");
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_classes_tenant_name_key"
ON "classes" ("churchId", "nameKey")
WHERE "churchId" IS NOT NULL AND "nameKey" IS NOT NULL AND "deletedAt" IS NULL;

DO $$ BEGIN
  ALTER TABLE "classes"
    ADD CONSTRAINT "FK_classes_tenant_identity"
    FOREIGN KEY ("churchId") REFERENCES "tenant_identity" ("churchId")
    ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "tenant_migrations" ("name") VALUES ('004_dynamic_classes')
ON CONFLICT ("name") DO NOTHING;
