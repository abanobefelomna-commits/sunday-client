-- =============================================================================
-- Migration 003: Church invitation codes
-- Stored centrally because a code is used to locate a church from the public
-- registration flow. Codes never grant administrative privileges.
-- Safe, additive, idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "church_codes" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "churchId" uuid NOT NULL REFERENCES "churches"("id") ON DELETE CASCADE,
  "code" varchar(64) NOT NULL UNIQUE,
  "revoked" boolean NOT NULL DEFAULT false,
  "expiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_church_codes_church"
  ON "church_codes" ("churchId", "revoked");

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_church_codes_active"
  ON "church_codes" ("churchId")
  WHERE "revoked" = false;

-- Backfill a code for every existing church that does not have one yet.
-- The database-generated value is only a bootstrap; authorised admins can
-- regenerate it through the application.
DO $$
DECLARE
  church_record RECORD;
  generated_code text;
BEGIN
  FOR church_record IN
    SELECT c."id"
    FROM "churches" c
    WHERE c."status" <> 'archived'
      AND NOT EXISTS (
        SELECT 1 FROM "church_codes" cc
        WHERE cc."churchId" = c."id" AND cc."revoked" = false
      )
  LOOP
    generated_code := upper(substr(md5(random()::text || clock_timestamp()::text || church_record."id"::text), 1, 12));
    INSERT INTO "church_codes" ("id", "churchId", "code", "revoked", "createdAt", "updatedAt")
    VALUES (uuid_generate_v4(), church_record."id", generated_code, false, now(), now())
    ON CONFLICT ("code") DO NOTHING;
  END LOOP;
END $$;
