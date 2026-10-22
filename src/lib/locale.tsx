import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, matchLocale, studentLocaleFrom, type Locale } from "@slay/core";

import { deleteSecureItem, readSecureItem, writeSecureItem } from "./secure-storage";

/** Same name as the web's cookie: one display preference per device. */
const STORAGE_KEY = LOCALE_COOKIE;

export interface LocalePreference {
  /** The language picked by hand on a profile; null means none was. */
  chosen: Locale | null;
  /** False until the stored choice has been read. */
  ready: boolean;
  /** Stores a choice, or clears it with null (the parent console's "Automatic"). */
  choose: (value: Locale | null) => Promise<void>;
}

const LocaleContext = createContext<LocalePreference>({ chosen: null, ready: true, choose: async () => {} });

/**
 * Holds the device's language choice — the native counterpart of upstream's
 * `slay_locale` cookie and `setLocalePreference` action. Persisted in
 * SecureStore (WP-4.7 AC1), so it survives a restart; it carries no identity,
 * just which language the chrome speaks.
 *
 * A storage failure is never fatal: the app falls back to its defaults and the
 * picker still switches the language for the session.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<Locale | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    readSecureItem(STORAGE_KEY)
      .then((value) => live && setChosen(isLocale(value) ? value : null))
      .catch(() => {})
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  const choose = useCallback(async (value: Locale | null) => {
    setChosen(value);
    try {
      await (value ? writeSecureItem(STORAGE_KEY, value) : deleteSecureItem(STORAGE_KEY));
    } catch {
      // Kept for this session; the next launch falls back to the default.
    }
  }, []);

  const preference = useMemo(() => ({ chosen, ready, choose }), [chosen, ready, choose]);
  return <LocaleContext.Provider value={preference}>{children}</LocaleContext.Provider>;
}

export function useLocalePreference(): LocalePreference {
  return useContext(LocaleContext);
}

/**
 * The language a student's chrome renders in: their saved choice, or English —
 * upstream's `resolveStudentLocale`. Deliberately not the phone's language:
 * which language a phone is set to says nothing about the child holding it.
 * Only the profile and the tab bar follow it; the game itself stays English.
 */
export function useStudentLocale(): Locale {
  return studentLocaleFrom(useLocalePreference().chosen);
}

/**
 * The phone's own language, matched against the ones we speak — what the
 * parent console's "Automatic" follows (upstream reads `Accept-Language`).
 */
export function deviceLocale(): Locale {
  let tag: string | undefined;
  try {
    tag = Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    tag = undefined;
  }
  return matchLocale(tag) ?? DEFAULT_LOCALE;
}
