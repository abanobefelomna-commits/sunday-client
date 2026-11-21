-- =============================================================================
-- Migration 004: Super Admin credentials, sessions, and church creation codes
-- Idempotent, additive, non-destructive. Apply with:
--   node scripts/migrate-platform.mjs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Super Admin master credentials (strictly single-account architecture)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "super_admin_credentials" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "isSingleton" boolean NOT NULL DEFAULT true,
  "passwordHash" text NOT NULL,
  "setupCompletedAt" timestamptz NOT NULL DEFAULT now(),
  "lastLoginAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_super_admin_singleton" UNIQUE ("isSingleton")
);

-- ---------------------------------------------------------------------------
-- 2. Super Admin dedicated sessions & refresh tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "super_admin_sessions" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "sessionTokenHash" varchar(64) NOT NULL UNIQUE,
  "refreshTokenHash" varchar(64) NOT NULL UNIQUE,
  "ipHash" varchar(64),
  "userAgentHash" varchar(64),
  "expiresAt" timestamptz NOT NULL,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_super_admin_sessions_token"
  ON "super_admin_sessions" ("sessionTokenHash")
  WHERE "revokedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_super_admin_sessions_refresh"
  ON "super_admin_sessions" ("refreshTokenHash")
  WHERE "revokedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- 2b. Durable failed-attempt window for setup/login (shared across instances)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "super_admin_auth_attempts" (
  "id" bigserial PRIMARY KEY,
  "ipHash" varchar(64) NOT NULL,
  "action" varchar(20) NOT NULL CHECK ("action" IN ('setup', 'login')),
  "success" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_super_admin_auth_attempts_window"
  ON "super_admin_auth_attempts" ("action", "ipHash", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "IDX_super_admin_auth_attempts_created"
  ON "super_admin_auth_attempts" ("createdAt");

-- ---------------------------------------------------------------------------
-- 3. Church Creation Access Codes (managed solely by Super Admin)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "church_creation_codes" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "codeHash" varchar(64) NOT NULL UNIQUE,
  "codePrefix" varchar(12) NOT NULL,
  "note" varchar(255),
  "maxUses" integer NOT NULL DEFAULT 1,
  "usedCount" integer NOT NULL DEFAULT 0,
  "status" varchar(20) NOT NULL DEFAULT 'active'
    CHECK ("status" IN ('active', 'revoked', 'expired', 'depleted')),
  "expiresAt" timestamptz,
  "revokedAt" timestamptz,
  "lastUsedAt" timestamptz,
  "createdBy" varchar(80) NOT NULL DEFAULT 'super_admin',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_church_creation_codes_hash"
  ON "church_creation_codes" ("codeHash");

CREATE INDEX IF NOT EXISTS "IDX_church_creation_codes_status"
  ON "church_creation_codes" ("status");

-- ---------------------------------------------------------------------------
-- 4. Associate Churches with their Creator and Creation Code
-- ---------------------------------------------------------------------------
ALTER TABLE "churches"
  ADD COLUMN IF NOT EXISTS "creationCodeId" uuid REFERENCES "church_creation_codes"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "creatorName" varchar(160),
  ADD COLUMN IF NOT EXISTS "creatorEmail" varchar(320);
