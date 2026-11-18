-- =============================================================================
-- Migration 005: security hardening.
-- Safe, additive, idempotent. Never drops data or changes existing UUIDs.
-- =============================================================================

-- Preserve the member's chosen service label until email verification completes.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "servantRole" varchar(40);

-- ---------------------------------------------------------------------------
-- Class read scope.
-- Legacy databases already have a tenant identity row, so they keep the broad
-- read behaviour they had before this migration. Brand-new tenant databases
-- run this migration before identity seeding; provisioning writes an explicit
-- `false` afterwards.
-- ---------------------------------------------------------------------------
INSERT INTO "church_settings" ("key", "value")
SELECT 'access.readAllClasses', 'true'::jsonb
WHERE EXISTS (SELECT 1 FROM "tenant_identity")
ON CONFLICT ("key") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Link servant rows to user accounts only when the match is unambiguous.
-- A servant must match exactly one user, and that user must match exactly one
-- servant. Rows that are already linked are never reassigned.
-- ---------------------------------------------------------------------------
WITH matches AS (
  SELECT s."id" AS "servantId", u."id" AS "userId"
  FROM "servants" s
  JOIN "users" u ON (
    (
      NULLIF(btrim(s."email"), '') IS NOT NULL
      AND lower(btrim(s."email")) = lower(btrim(u."email"))
    )
    OR (
      NULLIF(btrim(s."phone"), '') IS NOT NULL
      AND btrim(s."phone") = btrim(u."phone")
    )
  )
  WHERE s."userId" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "servants" linked WHERE linked."userId" = u."id"
    )
),
unique_servants AS (
  SELECT "servantId"
  FROM matches
  GROUP BY "servantId"
  HAVING COUNT(*) = 1
),
unique_users AS (
  SELECT "userId"
  FROM matches
  GROUP BY "userId"
  HAVING COUNT(*) = 1
),
safe_matches AS (
  SELECT m."servantId", m."userId"
  FROM matches m
  JOIN unique_servants us ON us."servantId" = m."servantId"
  JOIN unique_users uu ON uu."userId" = m."userId"
)
UPDATE "servants" s
SET "userId" = safe_matches."userId"
FROM safe_matches
WHERE s."id" = safe_matches."servantId"
  AND s."userId" IS NULL;

-- Active verification lookups resolve the newest unconsumed code.
CREATE INDEX IF NOT EXISTS "IDX_otp_codes_active_lookup"
ON "otp_codes" ("userId", "purpose", "createdAt" DESC)
WHERE "consumedAt" IS NULL;

INSERT INTO "tenant_migrations" ("name") VALUES ('005_security_hardening')
ON CONFLICT ("name") DO NOTHING;
