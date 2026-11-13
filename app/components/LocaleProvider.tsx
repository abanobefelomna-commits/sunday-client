"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  buildLocaleCookie,
  isLocale,
  localeDirection,
  normalizeLocale,
  type Locale,
} from "../lib/locale";

interface LocaleContextValue {
  locale: Locale;
  direction: "rtl" | "ltr";
  setLocale: (value: string) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function hasLocaleCookie(): boolean {
  return document.cookie
    .split(";")
    .some((part) => part.trim().startsWith(`${LOCALE_COOKIE}=`));
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => normalizeLocale(initialLocale));
  const migratedLegacyLocale = useRef(false);

  const applyLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    const root = document.documentElement;
    root.lang = next;
    root.dir = localeDirection(next);
    // Keep the server-readable cookie in sync immediately, before navigation.
    document.cookie = buildLocaleCookie(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Private browsing can reject storage; the cookie remains authoritative.
    }
  }, []);

  const setLocale = useCallback(
    (value: string) => {
      if (!isLocale(value)) return;
      applyLocale(value);
    },
    [applyLocale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
  }, [locale]);

  useEffect(() => {
    if (migratedLegacyLocale.current) return;
    migratedLegacyLocale.current = true;
    // One-time migration for visitors who selected a language before the cookie
    // existed. The cookie always wins; localStorage is only a compatibility mirror.
    if (hasLocaleCookie()) return;
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored) && stored !== locale) {
        // This one-time state update imports the legacy localStorage preference.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        applyLocale(stored);
      } else {
        document.cookie = buildLocaleCookie(normalizeLocale(initialLocale));
      }
    } catch {
      document.cookie = buildLocaleCookie(locale);
    }
  }, [applyLocale, initialLocale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, direction: localeDirection(locale), setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used inside LocaleProvider");
  }
  return context;
}
