/**
 * Shared, framework-free validation helpers for route handlers.
 * Keeping these pure makes them directly unit-testable.
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.floor((to - from) / 86_400_000);
}

export type Pagination = { page: number; limit: number; offset: number };

export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { limit?: number; maxLimit?: number } = {},
): Pagination {
  const rawPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const rawLimit = Number.parseInt(searchParams.get('limit') || String(defaults.limit ?? 20), 10);
  const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
  const maxLimit = defaults.maxLimit ?? 100;
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(maxLimit, rawLimit)) : (defaults.limit ?? 20);
  return { page, limit, offset: (page - 1) * limit };
}

export type DateRange = { from: string; to: string };

export function parseDateRange(
  searchParams: URLSearchParams,
  options: { defaultDays?: number; maxDays?: number; now?: Date } = {},
): DateRange {
  const now = options.now ?? new Date();
  const today = todayIso(now);
  const defaultDays = options.defaultDays ?? 90;
  const maxDays = options.maxDays ?? 366;

  const rawTo = searchParams.get('to');
  const rawFrom = searchParams.get('from');
  const to = isIsoDate(rawTo) ? rawTo : today;
  const from = isIsoDate(rawFrom) ? rawFrom : addDays(to, -(defaultDays - 1));

  if (from > to) {
    throw new ValidationError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
  }
  if (daysBetween(from, to) > maxDays) {
    throw new ValidationError(`أقصى مدة للفلترة هي ${maxDays} يومًا`);
  }
  return { from, to };
}

export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

export function requiredText(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} مطلوب`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${field} أطول من الحد المسموح (${maxLength} حرف)`);
  }
  return trimmed;
}

export function optionalText(value: unknown, maxLength = 2000): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const FOLLOW_UP_STATUSES = ['open', 'in_progress', 'resolved', 'dismissed'] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const FOLLOW_UP_PRIORITIES = ['low', 'medium', 'high'] as const;
export type FollowUpPriority = (typeof FOLLOW_UP_PRIORITIES)[number];

export const NOTE_VISIBILITIES = ['class', 'leaders', 'private'] as const;
export type NoteVisibility = (typeof NOTE_VISIBILITIES)[number];

export const ACTIVITY_TYPES = ['note', 'call', 'message', 'visit', 'status_change', 'resolution', 'assignment'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const PROGRESS_LEVELS = ['beginner', 'growing', 'proficient', 'advanced'] as const;
export type ProgressLevel = (typeof PROGRESS_LEVELS)[number];
