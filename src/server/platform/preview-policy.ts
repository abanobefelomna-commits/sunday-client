export type PlatformMode = 'PREVIEW' | 'LIVE';

export interface PreviewConfig {
  mode: PlatformMode;
  officialLaunchDate: string;
  startDate: string;
  endDate: string;
  subscriptionsEnabled: boolean;
  paymentsEnabled: boolean;
  headline?: string;
  description?: string;
}

export interface PreviewStatus {
  mode: PlatformMode;
  phase: 'unconfigured' | 'upcoming' | 'active' | 'ended';
  isActive: boolean;
  startDate: string;
  endDate: string;
  officialLaunchDate: string;
  daysRemaining: number;
  subscriptionsEnabled: boolean;
  paymentsEnabled: boolean;
  freeAccess: boolean;
  headline: string;
  description: string;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && isoDate(parsed) === value;
}

export function addYears(dateIso: string, years: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  const year = date.getUTCFullYear() + years;
  const month = date.getUTCMonth();
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return isoDate(new Date(Date.UTC(year, month, day)));
}

export function parsePreviewDate(value: unknown, field: string): string {
  if (!isIsoDate(value)) throw new Error(`${field} must be a valid ISO date (YYYY-MM-DD)`);
  return value;
}

export function derivePreviewStatus(
  config: PreviewConfig,
  now = new Date(),
  defaultCopy: { headline?: string; description?: string } = {},
): PreviewStatus {
  const today = isoDate(now);
  const datesConfigured =
    isIsoDate(config.officialLaunchDate) &&
    config.startDate === config.officialLaunchDate &&
    config.endDate === addYears(config.officialLaunchDate, 2);
  const phase: PreviewStatus['phase'] = !datesConfigured
    ? 'unconfigured'
    : today < config.startDate
      ? 'upcoming'
      : today > config.endDate
        ? 'ended'
        : 'active';
  const isActive = config.mode === 'PREVIEW' && phase === 'active';
  const end = datesConfigured ? new Date(`${config.endDate}T00:00:00Z`).getTime() : Number.NaN;
  const current = new Date(`${today}T00:00:00Z`).getTime();
  const daysRemaining = Number.isFinite(end)
    ? Math.max(0, Math.ceil((end - current) / 86_400_000))
    : 0;
  const subscriptionsEnabled = config.mode === 'LIVE' && config.subscriptionsEnabled;
  const paymentsEnabled = config.mode === 'LIVE' && config.paymentsEnabled;

  return {
    mode: config.mode,
    phase,
    isActive,
    startDate: config.startDate,
    endDate: config.endDate,
    officialLaunchDate: config.officialLaunchDate,
    daysRemaining,
    subscriptionsEnabled,
    paymentsEnabled,
    freeAccess: isActive || config.mode === 'PREVIEW',
    headline: config.headline || defaultCopy.headline || '',
    description: config.description || defaultCopy.description || '',
  };
}
