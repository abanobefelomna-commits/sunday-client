import {
  isLocale,
  localeLabels,
  supportedLocales,
  type Locale,
} from "../components/public-site/messages";

export { isLocale, localeLabels, supportedLocales, type Locale };

/** Cookie read by the server layout and the proxy. It is the source of truth. */
export const LOCALE_COOKIE = "ss_locale";
/** Legacy key kept in sync so older clients keep working across the upgrade. */
export const LOCALE_STORAGE_KEY = "sunday-school-locale";
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function normalizeLocale(value: string | null | undefined): Locale {
  return isLocale(value ?? null) ? (value as Locale) : DEFAULT_LOCALE;
}

export function localeDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** BCP-47 tag used for dates and numbers. English covers all non-Arabic UI. */
export function localeTag(locale: Locale): string {
  return locale === "ar" ? "ar-EG" : "en-US";
}

export function buildLocaleCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}
