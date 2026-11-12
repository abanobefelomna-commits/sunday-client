-- =============================================================================
-- Central platform schema (database-per-tenant control plane)
-- Idempotent, additive, non-destructive. Apply with:
--   node scripts/migrate-platform.mjs
-- This database must contain NO children's operational records.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS "platform_migrations" (
  "name" varchar(160) PRIMARY KEY,
  "appliedAt" timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Platform administrators (separate identity from church users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "platform_admins" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" varchar(160) NOT NULL,
  "email" varchar(320) NOT NULL,
  "passwordHash" text NOT NULL,
  "role" varchar(40) NOT NULL DEFAULT 'operations'
    CHECK ("role" IN ('super_admin', 'operations', 'support', 'billing', 'read_only')),
  "isActive" boolean NOT NULL DEFAULT true,
  "lastLoginAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_platform_admins_email"
  ON "platform_admins" (lower("email"));

CREATE TABLE IF NOT EXISTS "platform_refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tokenHash" varchar(64) NOT NULL,
  "adminId" uuid NOT NULL REFERENCES "platform_admins"("id") ON DELETE CASCADE,
  "userAgentHash" varchar(64),
  "ipHash" varchar(64),
  "expiresAt" timestamptz NOT NULL,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_platform_refresh_tokens_hash"
  ON "platform_refresh_tokens" ("tokenHash");
CREATE INDEX IF NOT EXISTS "IDX_platform_refresh_tokens_admin"
  ON "platform_refresh_tokens" ("adminId") WHERE "revokedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- Churches / tenants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "churches" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "slug" varchar(63) NOT NULL UNIQUE,
  "name" varchar(200) NOT NULL,
  "normalizedName" varchar(200) NOT NULL,
  "legalName" varchar(240),
  "country" varchar(2),
  "city" varchar(120),
  "contactName" varchar(160) NOT NULL,
  "contactEmail" varchar(320) NOT NULL,
  "contactPhone" varchar(40),
  "status" varchar(20) NOT NULL DEFAULT 'pending'
    CHECK ("status" IN ('pending', 'provisioning', 'active', 'suspended', 'failed', 'archived')),
  "verificationStatus" varchar(20) NOT NULL DEFAULT 'unverified'
    CHECK ("verificationStatus" IN ('unverified', 'pending', 'verified', 'rejected')),
  "verificationReference" varchar(240),
  "isLifetimeFree" boolean NOT NULL DEFAULT false,
  "lifetimeFreeReason" varchar(500),
  "primaryDomain" varchar(253),
  "customDomain" varchar(253),
  "databaseProvider" varchar(30) NOT NULL DEFAULT 'none'
    CHECK ("databaseProvider" IN ('none', 'postgres', 'neon-project', 'manual')),
  "providerResourceId" varchar(200),
  "databaseName" varchar(63),
  "databaseHost" varchar(253),
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "registrationIpHash" varchar(64),
  "termsAcceptedAt" timestamptz,
  "privacyAcceptedAt" timestamptz,
  "provisionedAt" timestamptz,
  "activatedAt" timestamptz,
  "suspendedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_churches_contact_email_active"
  ON "churches" (lower("contactEmail")) WHERE "status" <> 'archived';
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_churches_name_city_active"
  ON "churches" ("normalizedName", COALESCE("city", '')) WHERE "status" <> 'archived';
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_churches_primary_domain"
  ON "churches" (lower("primaryDomain")) WHERE "primaryDomain" IS NOT NULL AND "status" <> 'archived';
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_churches_custom_domain"
  ON "churches" (lower("customDomain")) WHERE "customDomain" IS NOT NULL AND "status" <> 'archived';
CREATE INDEX IF NOT EXISTS "IDX_churches_status" ON "churches" ("status");
CREATE INDEX IF NOT EXISTS "IDX_churches_created" ON "churches" ("createdAt" DESC);

-- Connection references live in a separate table so church list queries can
-- never accidentally select an encrypted connection string.
CREATE TABLE IF NOT EXISTS "tenant_connections" (
  "churchId" uuid PRIMARY KEY REFERENCES "churches"("id") ON DELETE RESTRICT,
  "provider" varchar(30) NOT NULL,
  "encryptedUrl" text NOT NULL,
  "urlFingerprint" varchar(64) NOT NULL,
  "databaseName" varchar(63),
  "databaseHost" varchar(253),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "rotatedAt" timestamptz
);

-- ---------------------------------------------------------------------------
-- Provisioning jobs (idempotent, retryable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "provisioning_jobs" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "churchId" uuid NOT NULL REFERENCES "churches"("id") ON DELETE CASCADE,
  "idempotencyKey" varchar(120) NOT NULL UNIQUE,
  "provisioningTokenHash" varchar(64) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'queued'
    CHECK ("status" IN ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  "currentStep" varchar(60),
  "stepHistory" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "attempts" integer NOT NULL DEFAULT 0,
  "maxAttempts" integer NOT NULL DEFAULT 5,
  "seedPayload" jsonb,
  "lastErrorCode" varchar(80),
  "lastErrorMessage" text,
  "lockedAt" timestamptz,
  "nextAttemptAt" timestamptz NOT NULL DEFAULT now(),
  "startedAt" timestamptz,
  "finishedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_provisioning_jobs_status"
  ON "provisioning_jobs" ("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "IDX_provisioning_jobs_church"
  ON "provisioning_jobs" ("churchId", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- Platform configuration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" varchar(80) PRIMARY KEY,
  "value" jsonb NOT NULL,
  "updatedBy" uuid REFERENCES "platform_admins"("id") ON DELETE SET NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Feature catalogue and subscription engine (prepared, payments disabled)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "features" (
  "code" varchar(80) PRIMARY KEY,
  "name" varchar(160) NOT NULL,
  "description" text,
  "category" varchar(40) NOT NULL DEFAULT 'core',
  "isCore" boolean NOT NULL DEFAULT false,
  "availableInPreview" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "code" varchar(60) NOT NULL UNIQUE,
  "name" varchar(160) NOT NULL,
  "description" text,
  "monthlyPriceCents" integer CHECK ("monthlyPriceCents" IS NULL OR "monthlyPriceCents" >= 0),
  "annualPriceCents" integer CHECK ("annualPriceCents" IS NULL OR "annualPriceCents" >= 0),
  "currency" varchar(3) NOT NULL DEFAULT 'EGP',
  "isActive" boolean NOT NULL DEFAULT false,
  "isPublic" boolean NOT NULL DEFAULT true,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "plan_features" (
  "planId" uuid NOT NULL REFERENCES "subscription_plans"("id") ON DELETE CASCADE,
  "featureCode" varchar(80) NOT NULL REFERENCES "features"("code") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true,
  "limitValue" jsonb,
  PRIMARY KEY ("planId", "featureCode")
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "churchId" uuid NOT NULL REFERENCES "churches"("id") ON DELETE RESTRICT,
  "planId" uuid NOT NULL REFERENCES "subscription_plans"("id") ON DELETE RESTRICT,
  "status" varchar(20) NOT NULL DEFAULT 'trialing'
    CHECK ("status" IN ('trialing', 'active', 'past_due', 'canceled', 'expired', 'incomplete')),
  "billingCycle" varchar(10) NOT NULL DEFAULT 'monthly'
    CHECK ("billingCycle" IN ('monthly', 'annual')),
  "currentPeriodStart" timestamptz NOT NULL,
  "currentPeriodEnd" timestamptz NOT NULL,
  "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false,
  "priceCents" integer NOT NULL DEFAULT 0 CHECK ("priceCents" >= 0),
  "currency" varchar(3) NOT NULL DEFAULT 'EGP',
  "provider" varchar(30) NOT NULL DEFAULT 'none'
    CHECK ("provider" IN ('none', 'manual', 'stripe', 'paymob')),
  "providerSubscriptionId" varchar(200),
  "providerCustomerId" varchar(200),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subscriptions_one_current"
  ON "subscriptions" ("churchId")
  WHERE "status" IN ('trialing', 'active', 'past_due', 'incomplete');
CREATE INDEX IF NOT EXISTS "IDX_subscriptions_church" ON "subscriptions" ("churchId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "add_ons" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "code" varchar(60) NOT NULL UNIQUE,
  "name" varchar(160) NOT NULL,
  "description" text,
  "featureCode" varchar(80) NOT NULL REFERENCES "features"("code") ON DELETE RESTRICT,
  "priceCents" integer CHECK ("priceCents" IS NULL OR "priceCents" >= 0),
  "billingCycle" varchar(10) NOT NULL DEFAULT 'monthly'
    CHECK ("billingCycle" IN ('monthly', 'annual', 'one_time')),
  "isActive" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "church_add_ons" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "churchId" uuid NOT NULL REFERENCES "churches"("id") ON DELETE CASCADE,
  "addOnId" uuid NOT NULL REFERENCES "add_ons"("id") ON DELETE RESTRICT,
  "status" varchar(20) NOT NULL DEFAULT 'active'
    CHECK ("status" IN ('active', 'canceled', 'expired', 'past_due')),
  "startedAt" timestamptz NOT NULL DEFAULT now(),
  "endsAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_church_add_ons_active"
  ON "church_add_ons" ("churchId", "addOnId") WHERE "status" = 'active';

CREATE TABLE IF NOT EXISTS "church_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "churchId" uuid NOT NULL REFERENCES "churches"("id") ON DELETE CASCADE,
  "featureCode" varchar(80) NOT NULL REFERENCES "features"("code") ON DELETE CASCADE,
  "source" varchar(20) NOT NULL DEFAULT 'override'
    CHECK ("source" IN ('plan', 'addon', 'override', 'preview', 'lifetime_free')),
  "enabled" boolean NOT NULL DEFAULT true,
  "limitValue" jsonb,
  "startsAt" timestamptz NOT NULL DEFAULT now(),
  "endsAt" timestamptz,
  "grantedBy" uuid REFERENCES "platform_admins"("id") ON DELETE SET NULL,
  "reason" varchar(500),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_church_entitlements_source"
  ON "church_entitlements" ("churchId", "featureCode", "source");
CREATE INDEX IF NOT EXISTS "IDX_church_entitlements_church"
  ON "church_entitlements" ("churchId");

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "churchId" uuid NOT NULL REFERENCES "churches"("id") ON DELETE RESTRICT,
  "subscriptionId" uuid REFERENCES "subscriptions"("id") ON DELETE SET NULL,
  "number" varchar(60) NOT NULL UNIQUE,
  "status" varchar(20) NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft', 'open', 'paid', 'void', 'uncollectible', 'refunded')),
  "subtotalCents" integer NOT NULL DEFAULT 0 CHECK ("subtotalCents" >= 0),
  "taxCents" integer NOT NULL DEFAULT 0 CHECK ("taxCents" >= 0),
  "totalCents" integer NOT NULL DEFAULT 0 CHECK ("totalCents" >= 0),
  "currency" varchar(3) NOT NULL DEFAULT 'EGP',
  "dueAt" timestamptz,
  "paidAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "churchId" uuid NOT NULL REFERENCES "churches"("id") ON DELETE RESTRICT,
  "invoiceId" uuid REFERENCES "invoices"("id") ON DELETE SET NULL,
  "provider" varchar(30) NOT NULL,
  "providerPaymentId" varchar(200),
  "idempotencyKey" varchar(200) NOT NULL UNIQUE,
  "amountCents" integer NOT NULL CHECK ("amountCents" >= 0),
  "currency" varchar(3) NOT NULL DEFAULT 'EGP',
  "status" varchar(20) NOT NULL
    CHECK ("status" IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  "failureCode" varchar(80),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payments_provider_id"
  ON "payments" ("provider", "providerPaymentId") WHERE "providerPaymentId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "subscription_events" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "churchId" uuid NOT NULL REFERENCES "churches"("id") ON DELETE CASCADE,
  "subscriptionId" uuid REFERENCES "subscriptions"("id") ON DELETE SET NULL,
  "type" varchar(60) NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_subscription_events_church"
  ON "subscription_events" ("churchId", "createdAt" DESC);

-- Lifetime-free exception is a verified grant, never a public name match.
CREATE TABLE IF NOT EXISTS "lifetime_free_grants" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "churchId" uuid NOT NULL UNIQUE REFERENCES "churches"("id") ON DELETE CASCADE,
  "verificationReference" varchar(240) NOT NULL,
  "verifiedBy" uuid REFERENCES "platform_admins"("id") ON DELETE SET NULL,
  "reason" varchar(500) NOT NULL,
  "grantedAt" timestamptz NOT NULL DEFAULT now(),
  "revokedAt" timestamptz,
  "revokedBy" uuid REFERENCES "platform_admins"("id") ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Platform audit trail (no children data, no secrets)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "platform_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "actorId" uuid REFERENCES "platform_admins"("id") ON DELETE SET NULL,
  "actorType" varchar(20) NOT NULL DEFAULT 'platform_admin'
    CHECK ("actorType" IN ('platform_admin', 'system', 'public', 'cron')),
  "action" varchar(80) NOT NULL,
  "entityType" varchar(60) NOT NULL,
  "entityId" uuid,
  "ipHash" varchar(64),
  "before" jsonb,
  "after" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_platform_audit_logs_created"
  ON "platform_audit_logs" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_platform_audit_logs_entity"
  ON "platform_audit_logs" ("entityType", "entityId");
