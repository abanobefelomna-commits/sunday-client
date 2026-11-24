-- =============================================================================
-- Migration 006: Purpose-scoped church codes
--
-- A church now has three independent active codes:
--   join   - shared with servants and class leaders to find the church
--   admin  - held by the Super Admin and required to self-register as مسؤول
--   priest - held by the Super Admin and required to self-register as أب كاهن
--
-- The role codes never grant a role on their own: registration must also resolve
-- an active church and the requested role must match the code purpose.
-- Additive and idempotent. Existing codes become join codes.
-- =============================================================================

ALTER TABLE "church_codes"
  ADD COLUMN IF NOT EXISTS "purpose" varchar(20) NOT NULL DEFAULT 'join';

DO $$ BEGIN
  ALTER TABLE "church_codes"
    ADD CONSTRAINT "CHK_church_codes_purpose"
    CHECK ("purpose" IN ('join', 'admin', 'priest'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One active code per purpose per church. The previous index allowed only one
-- active code in total.
DROP INDEX IF EXISTS "UQ_church_codes_active";
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_church_codes_active_purpose"
  ON "church_codes" ("churchId", "purpose")
  WHERE "revoked" = false;

CREATE INDEX IF NOT EXISTS "IDX_church_codes_purpose"
  ON "church_codes" ("churchId", "purpose", "revoked");

-- Backfill role codes for every existing church. Join codes already exist.
DO $$
DECLARE
  church_record RECORD;
  purpose_value text;
  generated_code text;
BEGIN
  FOR church_record IN
    SELECT c."id" FROM "churches" c WHERE c."status" <> 'archived'
  LOOP
    FOREACH purpose_value IN ARRAY ARRAY['admin', 'priest']::text[]
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM "church_codes" cc
        WHERE cc."churchId" = church_record."id"
          AND cc."purpose" = purpose_value
          AND cc."revoked" = false
      ) THEN
        LOOP
          SELECT string_agg(
                   substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                          1 + (get_byte(gen_random_bytes(1), 0) % 32), 1),
                   '' ORDER BY position
                 )
            INTO generated_code
          FROM generate_series(1, 10) AS positions(position);
          generated_code := substr(generated_code, 1, 5) || '-' || substr(generated_code, 6, 5);
          BEGIN
            INSERT INTO "church_codes"
              ("id", "churchId", "code", "purpose", "revoked", "createdAt", "updatedAt")
            VALUES
              (uuid_generate_v4(), church_record."id", generated_code, purpose_value, false, now(), now());
            EXIT;
          EXCEPTION WHEN unique_violation THEN
            NULL;
          END;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END $$;
