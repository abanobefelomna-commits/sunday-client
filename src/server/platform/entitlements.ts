import { platformQuery, platformQueryOne } from './db';
import { getPreviewStatus, type PreviewStatus } from './preview';

export interface FeatureRecord {
  code: string;
  name: string;
  description: string | null;
  category: string;
  isCore: boolean;
  availableInPreview: boolean;
}

export interface FeatureEntitlement extends FeatureRecord {
  enabled: boolean;
  source: 'preview' | 'plan' | 'addon' | 'override' | 'lifetime_free' | 'none';
  limitValue: unknown;
}

export interface EntitlementSnapshot {
  churchId: string;
  planCode: string | null;
  subscriptionStatus: string | null;
  isLifetimeFree: boolean;
  preview: PreviewStatus;
  features: FeatureEntitlement[];
}

export class FeatureNotAvailableError extends Error {
  status = 403;
  code = 'FEATURE_NOT_AVAILABLE';
  feature: string;
  constructor(feature: string) {
    super('This feature is not available for this church');
    this.feature = feature;
  }
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: EntitlementSnapshot; expiresAt: number }>();

export function invalidateEntitlementCache(churchId?: string): void {
  if (!churchId) cache.clear();
  else cache.delete(churchId);
}

const SOURCE_PRIORITY: Record<FeatureEntitlement['source'], number> = {
  none: 0,
  preview: 1,
  plan: 2,
  addon: 3,
  override: 4,
  lifetime_free: 5,
};

export async function getEntitlementSnapshot(churchId: string): Promise<EntitlementSnapshot> {
  const cached = cache.get(churchId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const preview = await getPreviewStatus();
  const [church, features, subscription, planFeatures, explicit, grant] = await Promise.all([
    platformQueryOne<{
      id: string;
      isLifetimeFree: boolean;
      verificationStatus: string;
    }>(
      `SELECT "id", "isLifetimeFree", "verificationStatus" FROM "churches" WHERE "id" = $1 LIMIT 1`,
      [churchId],
    ),
    platformQuery<FeatureRecord>(
      `SELECT "code", "name", "description", "category", "isCore", "availableInPreview"
       FROM "features" ORDER BY "isCore" DESC, "category", "code"`,
    ),
    platformQueryOne<{
      status: string;
      planCode: string;
    }>(
      `SELECT s."status", p."code" AS "planCode"
       FROM "subscriptions" s
       JOIN "subscription_plans" p ON p."id" = s."planId"
       WHERE s."churchId" = $1 AND s."status" IN ('trialing', 'active', 'past_due')
       ORDER BY s."createdAt" DESC LIMIT 1`,
      [churchId],
    ),
    platformQuery<{ featureCode: string; limitValue: unknown }>(
      `SELECT pf."featureCode", pf."limitValue"
       FROM "plan_features" pf
       JOIN "subscriptions" s ON s."planId" = pf."planId"
       WHERE s."churchId" = $1 AND s."status" IN ('trialing', 'active', 'past_due') AND pf."enabled" = true`,
      [churchId],
    ),
    platformQuery<{
      featureCode: string;
      source: FeatureEntitlement['source'];
      enabled: boolean;
      limitValue: unknown;
    }>(
      `SELECT "featureCode", "source", "enabled", "limitValue"
       FROM "church_entitlements"
       WHERE "churchId" = $1
         AND ("startsAt" IS NULL OR "startsAt" <= now())
         AND ("endsAt" IS NULL OR "endsAt" > now())`,
      [churchId],
    ),
    platformQueryOne<{ id: string; revokedAt: string | null }>(
      `SELECT "id", "revokedAt" FROM "lifetime_free_grants" WHERE "churchId" = $1 LIMIT 1`,
      [churchId],
    ),
  ]);

  const validLifetimeFree =
    !!church?.isLifetimeFree &&
    church.verificationStatus === 'verified' &&
    !!grant &&
    !grant.revokedAt;
  const freePreview = preview.freeAccess;

  const resolved = new Map<string, { enabled: boolean; source: FeatureEntitlement['source']; limitValue: unknown }>();
  const set = (code: string, enabled: boolean, source: FeatureEntitlement['source'], limitValue: unknown = null) => {
    const current = resolved.get(code);
    if (current && SOURCE_PRIORITY[current.source] > SOURCE_PRIORITY[source]) return;
    if (current && current.source === source && current.enabled) return;
    resolved.set(code, { enabled, source, limitValue });
  };

  if (freePreview) {
    for (const feature of features) {
      if (feature.availableInPreview) set(feature.code, true, 'preview');
    }
  }
  if (validLifetimeFree) {
    for (const feature of features) set(feature.code, true, 'lifetime_free');
  }
  if (subscription) {
    for (const feature of planFeatures) {
      set(feature.featureCode, true, 'plan', feature.limitValue);
    }
  }
  for (const row of explicit) {
    if (row.source === 'plan' || row.source === 'preview' || row.source === 'lifetime_free') {
      set(row.featureCode, row.enabled, row.source, row.limitValue);
    } else {
      set(row.featureCode, row.enabled, row.source, row.limitValue);
    }
  }

  const snapshot: EntitlementSnapshot = {
    churchId,
    planCode: subscription?.planCode ?? (freePreview ? 'preview' : null),
    subscriptionStatus: subscription?.status ?? (freePreview ? 'preview' : null),
    isLifetimeFree: validLifetimeFree,
    preview,
    features: features.map((feature) => {
      const value = resolved.get(feature.code);
      return {
        ...feature,
        enabled: value?.enabled ?? false,
        source: value?.source ?? 'none',
        limitValue: value?.limitValue ?? null,
      };
    }),
  };
  cache.set(churchId, { value: snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
  return snapshot;
}

export async function isFeatureEnabled(churchId: string, featureCode: string): Promise<boolean> {
  const snapshot = await getEntitlementSnapshot(churchId);
  return snapshot.features.some((feature) => feature.code === featureCode && feature.enabled);
}

export async function requireFeature(churchId: string, featureCode: string): Promise<void> {
  if (!(await isFeatureEnabled(churchId, featureCode))) {
    throw new FeatureNotAvailableError(featureCode);
  }
}

export async function grantPreviewEntitlements(churchId: string): Promise<void> {
  await platformQuery(
    `INSERT INTO "church_entitlements" ("churchId", "featureCode", "source", "enabled", "reason")
     SELECT $1, f."code", 'preview', true, 'Preview programme entitlement'
     FROM "features" f WHERE f."availableInPreview" = true
     ON CONFLICT ("churchId", "featureCode", "source") DO UPDATE
     SET "enabled" = true`,
    [churchId],
  );
  invalidateEntitlementCache(churchId);
}

export async function grantLifetimeFree(input: {
  churchId: string;
  verificationReference: string;
  reason: string;
  verifiedBy: string | null;
}): Promise<void> {
  const church = await platformQueryOne<{ verificationStatus: string; name: string }>(
    `SELECT "verificationStatus", "name" FROM "churches" WHERE "id" = $1 LIMIT 1`,
    [input.churchId],
  );
  if (!church) throw new Error('Church not found');
  if (church.verificationStatus !== 'verified') {
    throw new Error('The church identity must be verified before granting lifetime-free access');
  }
  if (!input.verificationReference.trim()) {
    throw new Error('A verification reference is required');
  }
  await platformQuery(
    `INSERT INTO "lifetime_free_grants"
       ("churchId", "verificationReference", "verifiedBy", "reason")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("churchId") DO UPDATE
     SET "verificationReference" = EXCLUDED."verificationReference",
         "verifiedBy" = EXCLUDED."verifiedBy",
         "reason" = EXCLUDED."reason",
         "revokedAt" = NULL`,
    [input.churchId, input.verificationReference, input.verifiedBy, input.reason],
  );
  await platformQuery(
    `UPDATE "churches"
     SET "isLifetimeFree" = true, "lifetimeFreeReason" = $2, "updatedAt" = now()
     WHERE "id" = $1`,
    [input.churchId, input.reason],
  );
  await platformQuery(
    `INSERT INTO "church_entitlements" ("churchId", "featureCode", "source", "enabled", "grantedBy", "reason")
     SELECT $1, f."code", 'lifetime_free', true, $2, $3 FROM "features" f
     ON CONFLICT ("churchId", "featureCode", "source") DO UPDATE
     SET "enabled" = true, "grantedBy" = EXCLUDED."grantedBy"`,
    [input.churchId, input.verifiedBy, input.reason],
  );
  invalidateEntitlementCache(input.churchId);
}

export async function revokeLifetimeFree(churchId: string, revokedBy: string | null): Promise<void> {
  await platformQuery(
    `UPDATE "lifetime_free_grants" SET "revokedAt" = now(), "revokedBy" = $2
     WHERE "churchId" = $1 AND "revokedAt" IS NULL`,
    [churchId, revokedBy],
  );
  await platformQuery(
    `UPDATE "churches" SET "isLifetimeFree" = false, "lifetimeFreeReason" = NULL, "updatedAt" = now()
     WHERE "id" = $1`,
    [churchId],
  );
  await platformQuery(
    `UPDATE "church_entitlements" SET "enabled" = false
     WHERE "churchId" = $1 AND "source" = 'lifetime_free'`,
    [churchId],
  );
  invalidateEntitlementCache(churchId);
}
