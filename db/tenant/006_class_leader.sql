-- =============================================================================
-- Migration 006: Class Leader assignment
-- Add a nullable foreign key to reference the servant who is the class leader.
-- Backfill from the existing servant role so existing classes keep their leader.
-- Safe, additive, idempotent. No data loss.
-- =============================================================================

ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "leadServantId" uuid;

-- Add foreign key constraint (not validated to avoid locking existing data)
DO $$ BEGIN
  ALTER TABLE "classes"
    ADD CONSTRAINT "FK_classes_leadServant"
    FOREIGN KEY ("leadServantId") REFERENCES "servants"("id")
    ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill existing class leaders from the legacy role label, without ever
-- deleting or rewriting an existing leader assignment.
UPDATE "classes" c
SET "leadServantId" = (
  SELECT s."id"
  FROM "servants" s
  JOIN "servants_classes" sc ON sc."servantsId" = s."id"
  WHERE sc."classesId" = c."id" AND s."role" = 'قائد فصل'
  ORDER BY s."createdAt" ASC, s."id" ASC
  LIMIT 1
)
WHERE c."leadServantId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "servants" s
    JOIN "servants_classes" sc ON sc."servantsId" = s."id"
    WHERE sc."classesId" = c."id" AND s."role" = 'قائد فصل'
  );

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS "IDX_classes_leadServantId" ON "classes" ("leadServantId");

INSERT INTO "tenant_migrations" ("name") VALUES ('006_class_leader')
ON CONFLICT ("name") DO NOTHING;
