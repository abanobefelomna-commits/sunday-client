-- =============================================================================
-- Migration 010: Class-leader integrity and scoped assignment guarantees.
--
-- Safe, additive and idempotent:
--   * no table, column or row is dropped;
--   * orphan references are cleared before constraints are validated;
--   * ambiguous duplicate leadership is reduced to the oldest assignment so
--     the one-class-per-leader invariant can be enforced.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Attendance author references.
-- ---------------------------------------------------------------------------
UPDATE "attendance" a
SET "recordedBy" = NULL
WHERE a."recordedBy" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = a."recordedBy");

DO $$ BEGIN
  ALTER TABLE "attendance"
    ADD CONSTRAINT "FK_attendance_recordedBy"
    FOREIGN KEY ("recordedBy") REFERENCES "users"("id")
    ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "attendance" VALIDATE CONSTRAINT "FK_attendance_recordedBy";

CREATE INDEX IF NOT EXISTS "IDX_attendance_recordedBy"
  ON "attendance" ("recordedBy") WHERE "recordedBy" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Class leadership references.
-- ---------------------------------------------------------------------------
UPDATE "classes" c
SET "leadServantId" = NULL
WHERE c."leadServantId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "servants" s WHERE s."id" = c."leadServantId");

-- A servant may lead at most one class. Keep the oldest assignment when older
-- data contains more than one and release the rest without deleting classes.
WITH ranked AS (
  SELECT "id",
         row_number() OVER (
           PARTITION BY "leadServantId"
           ORDER BY "createdAt" ASC, "id" ASC
         ) AS position
  FROM "classes"
  WHERE "leadServantId" IS NOT NULL
)
UPDATE "classes" c
SET "leadServantId" = NULL
FROM ranked r
WHERE c."id" = r."id" AND r.position > 1;

DO $$ BEGIN
  ALTER TABLE "classes" VALIDATE CONSTRAINT "FK_classes_leadServant";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_classes_leadServantId"
  ON "classes" ("leadServantId")
  WHERE "leadServantId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "IDX_classes_active_grade"
  ON "classes" ("grade")
  WHERE "isActive" = true AND "deletedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- 3. A class leader must be assigned to the class they lead.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "enforce_class_leader_membership"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."leadServantId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "servants_classes" sc
    WHERE sc."servantsId" = NEW."leadServantId"
      AND sc."classesId" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'class leader must be assigned to the class'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "TRG_classes_lead_servant_membership" ON "classes";
CREATE TRIGGER "TRG_classes_lead_servant_membership"
BEFORE INSERT OR UPDATE OF "leadServantId" ON "classes"
FOR EACH ROW EXECUTE FUNCTION "enforce_class_leader_membership"();

-- ---------------------------------------------------------------------------
-- 4. Removing a servant from a class releases leadership and child
--    assignments that only made sense inside that class.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "release_class_leader_on_membership_delete"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "classes"
  SET "leadServantId" = NULL, "updatedAt" = now()
  WHERE "leadServantId" = OLD."servantsId"
    AND "id" = OLD."classesId";

  UPDATE "children"
  SET "assignedServantId" = NULL, "updatedAt" = now()
  WHERE "classId" = OLD."classesId"
    AND "assignedServantId" = OLD."servantsId";

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "TRG_servants_classes_release_leader" ON "servants_classes";
CREATE TRIGGER "TRG_servants_classes_release_leader"
AFTER DELETE ON "servants_classes"
FOR EACH ROW EXECUTE FUNCTION "release_class_leader_on_membership_delete"();

-- ---------------------------------------------------------------------------
-- 5. Privileged roles are not tied to classes; any other role that is not a
--    class leader also releases leadership.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "reconcile_servant_role_scope"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."role"::text IN ('مسؤول', 'أب كاهن') THEN
    DELETE FROM "servants_classes" WHERE "servantsId" = NEW."id";
    UPDATE "classes"
    SET "leadServantId" = NULL, "updatedAt" = now()
    WHERE "leadServantId" = NEW."id";
  ELSIF NEW."role"::text <> 'قائد فصل' THEN
    UPDATE "classes"
    SET "leadServantId" = NULL, "updatedAt" = now()
    WHERE "leadServantId" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "TRG_servants_reconcile_role_scope" ON "servants";
CREATE TRIGGER "TRG_servants_reconcile_role_scope"
AFTER UPDATE OF "role" ON "servants"
FOR EACH ROW EXECUTE FUNCTION "reconcile_servant_role_scope"();

-- ---------------------------------------------------------------------------
-- 6. Supporting indexes for scoped list/detail queries.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "IDX_servants_userId" ON "servants" ("userId");
CREATE INDEX IF NOT EXISTS "IDX_children_class_assigned"
  ON "children" ("classId", "assignedServantId")
  WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "IDX_servant_attendance_class_servant"
  ON "servant_attendance" ("classId", "servantId");

INSERT INTO "tenant_migrations" ("name") VALUES ('010_class_leader_integrity')
ON CONFLICT ("name") DO NOTHING;
