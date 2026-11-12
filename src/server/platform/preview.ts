import {
  platformQuery,
  platformQueryOne,
  platformTransaction,
} from './db';
import {
  addYears,
  derivePreviewStatus as derivePreviewPolicyStatus,
  isIsoDate,
  parsePreviewDate,
  type PlatformMode,
  type PreviewConfig,
  type PreviewStatus,
} from './preview-policy';

export type { PlatformMode, PreviewConfig, PreviewStatus } from './preview-policy';

const DEFAULT_HEADLINE = 'النسخة التجريبية — ابدأ مجانًا';
const DEFAULT_DESCRIPTION =
  'فترة تجريبية مجانية لمدة عامين من تاريخ الإطلاق الرسمي. لا تحتاج بطاقة ائتمان.';

const CACHE_TTL_MS = 30_000;
let previewCache: { value: PreviewConfig; expiresAt: number } | null = null;

function envPreviewConfig(): PreviewConfig {
  const configuredLaunchDate = isIsoDate(process.env.PLATFORM_LAUNCH_DATE)
    ? process.env.PLATFORM_LAUNCH_DATE
    : isIsoDate(process.env.PREVIEW_START_DATE)
      ? process.env.PREVIEW_START_DATE
      : '';
  const expectedEndDate = configuredLaunchDate ? addYears(configuredLaunchDate, 2) : '';
  const configuredEndDate = isIsoDate(process.env.PREVIEW_END_DATE)
    ? process.env.PREVIEW_END_DATE
    : '';
  return {
    mode: process.env.PLATFORM_MODE === 'LIVE' ? 'LIVE' : 'PREVIEW',
    officialLaunchDate: configuredLaunchDate,
    startDate: configuredLaunchDate,
    endDate: configuredEndDate === expectedEndDate ? configuredEndDate : expectedEndDate,
    subscriptionsEnabled: false,
    paymentsEnabled: false,
    headline: DEFAULT_HEADLINE,
    description: DEFAULT_DESCRIPTION,
  };
}

function normalizeConfig(raw: Record<string, unknown>): PreviewConfig {
  const fallback = envPreviewConfig();
  const mode = raw.mode === 'LIVE' ? 'LIVE' : 'PREVIEW';
  const officialLaunchDate = isIsoDate(raw.officialLaunchDate)
    ? raw.officialLaunchDate
    : isIsoDate(raw.startDate)
      ? raw.startDate
      : fallback.officialLaunchDate;
  const startDate = officialLaunchDate;
  const expectedEndDate = startDate ? addYears(startDate, 2) : '';
  const endDate = isIsoDate(raw.endDate) && raw.endDate === expectedEndDate
    ? raw.endDate
    : expectedEndDate || fallback.endDate;
  const paymentsEnabled = raw.paymentsEnabled === true && mode === 'LIVE';
  return {
    mode,
    officialLaunchDate,
    startDate,
    endDate,
    subscriptionsEnabled: raw.subscriptionsEnabled === true && mode === 'LIVE',
    paymentsEnabled,
    headline: typeof raw.headline === 'string' ? raw.headline : fallback.headline,
    description: typeof raw.description === 'string' ? raw.description : fallback.description,
  };
}

export async function getPreviewConfig(): Promise<PreviewConfig> {
  if (previewCache && previewCache.expiresAt > Date.now()) return previewCache.value;
  try {
    const row = await platformQueryOne<{ value: Record<string, unknown> }>(
      `SELECT "value" FROM "platform_settings" WHERE "key" = 'preview' LIMIT 1`,
    );
    const value = normalizeConfig(row?.value ?? {});
    previewCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch {
    console.warn('[preview] Platform settings unavailable; using validated environment configuration.');
    return envPreviewConfig();
  }
}

export function derivePreviewStatus(config: PreviewConfig, now = new Date()): PreviewStatus {
  return derivePreviewPolicyStatus(config, now, {
    headline: DEFAULT_HEADLINE,
    description: DEFAULT_DESCRIPTION,
  });
}

export async function getPreviewStatus(): Promise<PreviewStatus> {
  return derivePreviewStatus(await getPreviewConfig());
}

export async function updatePreviewConfig(
  input: Record<string, unknown>,
  updatedBy: string | null,
): Promise<PreviewConfig> {
  const current = await getPreviewConfig();
  const mode: PlatformMode = input.mode === 'LIVE' ? 'LIVE' : 'PREVIEW';
  const startDate = parsePreviewDate(input.startDate ?? (current.startDate || undefined), 'startDate');
  const officialLaunchDate = parsePreviewDate(
    input.officialLaunchDate ?? (current.officialLaunchDate || startDate),
    'officialLaunchDate',
  );
  if (officialLaunchDate !== startDate) {
    throw new Error('The Preview start date must match the official platform launch date');
  }
  const expectedEndDate = addYears(startDate, 2);
  const endDate = parsePreviewDate(input.endDate ?? expectedEndDate, 'endDate');
  if (endDate !== expectedEndDate) {
    throw new Error('The initial Preview must last exactly two years from the official launch date');
  }

  // Preview mode is deliberately unable to collect money.
  const subscriptionsEnabled = mode === 'PREVIEW' ? false : input.subscriptionsEnabled === true;
  const paymentsEnabled = mode === 'PREVIEW' ? false : input.paymentsEnabled === true;
  if (paymentsEnabled && process.env.ALLOW_PAYMENTS_ACTIVATION !== 'true') {
    throw new Error('Payment activation is disabled by deployment policy');
  }

  const next: PreviewConfig = {
    mode,
    officialLaunchDate,
    startDate,
    endDate,
    subscriptionsEnabled,
    paymentsEnabled,
    headline: typeof input.headline === 'string' ? input.headline.slice(0, 200) : current.headline,
    description:
      typeof input.description === 'string'
        ? input.description.slice(0, 1000)
        : current.description,
  };

  await platformTransaction([
    {
      text: `INSERT INTO "platform_settings" ("key", "value", "updatedBy", "updatedAt")
             VALUES ('preview', $1::jsonb, $2, now())
             ON CONFLICT ("key") DO UPDATE
             SET "value" = EXCLUDED."value", "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = now()`,
      params: [JSON.stringify(next), updatedBy],
    },
  ]);
  previewCache = { value: next, expiresAt: Date.now() + CACHE_TTL_MS };
  return next;
}

export interface PlatformConfig {
  registrationEnabled: boolean;
  provisioningEnabled: boolean;
  supportEmail: string;
  platformName: string;
  termsVersion: string;
  privacyVersion: string;
}

const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  registrationEnabled: true,
  provisioningEnabled: true,
  supportEmail: '',
  platformName: 'مدارس الأحد',
  termsVersion: '',
  privacyVersion: '',
};

export async function getPlatformConfig(): Promise<PlatformConfig> {
  try {
    const row = await platformQueryOne<{ value: Partial<PlatformConfig> }>(
      `SELECT "value" FROM "platform_settings" WHERE "key" = 'platform' LIMIT 1`,
    );
    return { ...DEFAULT_PLATFORM_CONFIG, ...(row?.value ?? {}) };
  } catch {
    return DEFAULT_PLATFORM_CONFIG;
  }
}

export async function getBillingConfig(): Promise<{
  provider: string;
  enabled: boolean;
  checkoutEnabled: boolean;
}> {
  try {
    const row = await platformQueryOne<{
      value: { provider?: string; enabled?: boolean; checkoutEnabled?: boolean };
    }>(`SELECT "value" FROM "platform_settings" WHERE "key" = 'billing' LIMIT 1`);
    return {
      provider: row?.value?.provider || 'none',
      enabled: row?.value?.enabled === true,
      checkoutEnabled: row?.value?.checkoutEnabled === true,
    };
  } catch {
    return { provider: 'none', enabled: false, checkoutEnabled: false };
  }
}

export async function listPlatformSettings(): Promise<Record<string, unknown>> {
  const rows = await platformQuery<{ key: string; value: unknown }>(
    `SELECT "key", "value" FROM "platform_settings" ORDER BY "key"`,
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
