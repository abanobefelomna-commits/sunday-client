import type { Locale } from './locale';

export const ATTENDANCE_LABELS: Record<string, string> = {
  present: 'حاضر',
  absent: 'غائب',
  late: 'متأخر',
  excused: 'غياب بعذر',
};

export const FOLLOW_UP_STATUS_LABELS: Record<string, string> = {
  open: 'مفتوحة',
  in_progress: 'قيد المتابعة',
  resolved: 'تم حلها',
  dismissed: 'مستبعدة',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
};

export const LEVEL_LABELS: Record<string, string> = {
  beginner: 'مبتدئ',
  growing: 'ينمو',
  proficient: 'متمكن',
  advanced: 'متقدم',
};

export const VISIBILITY_LABELS: Record<string, string> = {
  class: 'الفصل',
  leaders: 'القيادة',
  private: 'خاصة',
};

export const VISIT_TYPE_LABELS: Record<string, string> = {
  home_visit: 'افتقاد منزلي',
  phone_call: 'اتصال هاتفي',
  church_visit: 'افتقاد بالكنيسة',
};

export const VISIT_STATUS_LABELS: Record<string, string> = {
  planned: 'مجدول',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

/**
 * Service roles are stored in Arabic in the database, so the value stays as
 * data while the label is resolved through the active dictionary.
 */
export const SERVICE_ROLE_KEYS: Record<string, string> = {
  'خادم': 'servants.roleServant',
  'خادم فقرة عامة': 'servants.roleGeneral',
  'قائد فصل': 'servants.roleClassLeader',
  'مسؤول': 'servants.roleAdmin',
  'أب كاهن': 'servants.rolePriest',
  'خادم رئيسي': 'servants.roleChief',
  'مشرف': 'servants.roleSupervisor',
};

export function attendanceTone(status: string): string {
  switch (status) {
    case 'present':
      return 'ok';
    case 'late':
      return 'warn';
    case 'excused':
      return 'violet';
    case 'absent':
      return 'danger';
    default:
      return 'muted';
  }
}

export function followUpTone(status: string): string {
  switch (status) {
    case 'open':
      return 'danger';
    case 'in_progress':
      return 'warn';
    case 'resolved':
      return 'ok';
    case 'dismissed':
      return 'muted';
    default:
      return 'muted';
  }
}

export function priorityTone(priority: string): string {
  switch (priority) {
    case 'high':
      return 'danger';
    case 'medium':
      return 'warn';
    case 'low':
      return 'ok';
    default:
      return 'muted';
  }
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftIso(iso: string, days: number): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatShortDate(value?: string | Date | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Locale-aware date formatting used by the authenticated UI. */
export function formatDateFor(
  value: string | Date | null | undefined,
  locale: Locale,
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortDateFor(
  value: string | Date | null | undefined,
  locale: Locale,
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatDateTimeFor(
  value: string | Date | null | undefined,
  locale: Locale,
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function relativeTime(value?: string | Date | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  const day = 86_400_000;
  if (diff < 60_000) return 'الآن';
  if (diff < 3_600_000) return `منذ ${Math.floor(diff / 60_000)} دقيقة`;
  if (diff < day) return `منذ ${Math.floor(diff / 3_600_000)} ساعة`;
  if (diff < 7 * day) return `منذ ${Math.floor(diff / day)} يوم`;
  return formatDate(date);
}

/**
 * Locale-aware relative time used by the authenticated UI. Every non-Arabic
 * locale falls back to English formatting while keeping its own direction.
 */
export function relativeTimeFor(
  value: string | Date | null | undefined,
  locale: Locale,
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const tag = locale === 'ar' ? 'ar-EG' : 'en-US';
  const diff = Date.now() - date.getTime();
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  if (diff < minute) return rtf.format(0, 'second');
  if (diff < hour) return rtf.format(-Math.floor(diff / minute), 'minute');
  if (diff < day) return rtf.format(-Math.floor(diff / hour), 'hour');
  if (diff < 7 * day) return rtf.format(-Math.floor(diff / day), 'day');
  return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function ageFromBirthDate(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const date = new Date(`${birthDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < date.getUTCMonth() ||
    (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name.replace(/^أ\.\s*/, '').trim().charAt(0) || '?';
}

export function percent(value?: number | null): string {
  return value === null || value === undefined ? '—' : `${value}%`;
}

export function numberAr(value?: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('ar-EG').format(value);
}
