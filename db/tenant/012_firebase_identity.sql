-- =============================================================================
-- Migration 012: Firebase Authentication identity link
-- A Firebase Auth UID identifies the credential only. The tenant user row stays
-- authoritative for role, servant role, class scope, activation and profile, so
-- no identity or authorisation copy is kept in Firestore.
-- Safe, additive, idempotent.
-- =============================================================================

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firebaseUid" varchar(128);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_firebaseUid"
  ON "users" ("firebaseUid") WHERE "firebaseUid" IS NOT NULL;

INSERT INTO "tenant_migrations" ("name") VALUES ('012_firebase_identity')
ON CONFLICT ("name") DO NOTHING;
