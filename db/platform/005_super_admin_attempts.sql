-- =============================================================================
-- Migration 005: Durable Super Admin failed-attempt window
--
-- Migration 004 shipped the Super Admin schema and is already recorded as
-- applied on databases provisioned before the durable attempt limiter existed.
-- This migration backfills the table and indexes for those databases. On a
-- fresh database migration 004 already creates them, so every statement here is
-- idempotent and non-destructive.
-- =============================================================================

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
