-- =============================================================================
-- Tenant-aware authentication hardening. Additive and idempotent.
-- =============================================================================

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "churchId" uuid;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "audience" varchar(20) NOT NULL DEFAULT 'tenant';
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "userAgentHash" varchar(64);
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "ipHash" varchar(64);
CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_tenant"
  ON "refresh_tokens" ("churchId", "userId") WHERE "revokedAt" IS NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" timestamptz;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordChangedAt" timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email_ci" ON "users" (lower("email"));
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_phone_active" ON "users" ("phone") WHERE "isActive" = true;

-- Link servant rows to user accounts when unambiguous. Never merges or deletes.
ALTER TABLE "servants" ADD COLUMN IF NOT EXISTS "userId" uuid REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "IDX_servants_user" ON "servants" ("userId");
UPDATE "servants" s
SET "userId" = u."id"
FROM "users" u
WHERE s."userId" IS NULL
  AND (s."phone" = u."phone" OR (s."email" IS NOT NULL AND lower(s."email") = lower(u."email")))
  AND NOT EXISTS (
    SELECT 1 FROM "servants" s2 WHERE s2."userId" = u."id" AND s2."id" <> s."id"
  );

INSERT INTO "tenant_migrations" ("name") VALUES ('003_tenant_auth')
ON CONFLICT ("name") DO NOTHING;
