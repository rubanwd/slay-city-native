import { DEFAULT_LOCALE, type Locale } from "./locales";
import type { Messages } from "./messages";
import { en } from "./messages/en";
import { ru } from "./messages/ru";
import { uk } from "./messages/uk";

export type { Locale } from "./locales";
export type { Messages } from "./messages";
export {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_LABELS,
  LOCALE_SHORT_LABELS,
  LOCALES,
  matchLocale,
} from "./locales";

const MESSAGES: Record<Locale, Messages> = { en, uk, ru };

/**
 * The dictionary for a locale. Safe to call from a Server or a Client
 * Component: it takes a plain string, so a page can resolve the locale
 * server-side and hand the bare code down as a prop, with no context provider
 * and no dictionary crossing the network.
 */
export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
}

/**
 * A count of seconds as hours and minutes in the given language. Anything under
 * a minute rounds down to "0 min" rather than inventing a unit — the dashboard
 * shows totals, and a few stray seconds is not a study session.
 */
export function formatDuration(locale: Locale, seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  return getMessages(locale).common.duration(Math.floor(totalMinutes / 60), totalMinutes % 60);
}

/** A date in the viewer's language, e.g. "8 лип. 2026 р." / "Jul 8, 2026". */
export function formatDate(locale: Locale, iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}
