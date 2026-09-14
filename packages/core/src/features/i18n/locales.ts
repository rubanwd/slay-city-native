/**
 * The languages the adult-facing screens speak, and how one is chosen.
 *
 * Only the parent console is translated today: a parent is an adult who never
 * asked to learn English, so the interface meets them in their own language.
 * The student game stays English on purpose — the English *is* the lesson.
 *
 * Authored content (district, location and mission names, homework topic
 * titles, teacher notes) is never translated: it lives in the database in one
 * language and is shown verbatim everywhere.
 */

/** Languages offered, in the order the picker lists them. */
export const LOCALES = ["en", "uk", "ru"] as const;

export type Locale = (typeof LOCALES)[number];

/** Used when nothing else matches — the language the content is authored in. */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * What the game speaks to a student who has never picked a language.
 *
 * English, the language the game is authored in — a student who wants their
 * own language switches to it on their profile. Deliberately a fixed language
 * rather than the browser's: which language a phone happens to be set to says
 * nothing about the child holding it, and a student who never touches the
 * setting should get the same game everywhere. The parent console does follow
 * the browser — an adult's `Accept-Language` is a real signal.
 */
export const STUDENT_DEFAULT_LOCALE: Locale = "en";

/**
 * The language a student's screens render in: their own saved choice if they
 * made one, {@link STUDENT_DEFAULT_LOCALE} otherwise.
 *
 * Split from the cookie plumbing in {@link file://./server.ts} so the rule
 * itself can be unit tested.
 */
export function studentLocaleFrom(chosen: unknown): Locale {
  return isLocale(chosen) ? chosen : STUDENT_DEFAULT_LOCALE;
}

/** Each language named in itself, the way language pickers should read. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  uk: "Українська",
  ru: "Русский",
};

/** Short code shown on the compact picker chips. */
export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  uk: "УК",
  ru: "РУ",
};

/** Cookie holding a manual choice. Absent means "follow the browser". */
export const LOCALE_COOKIE = "slay_locale";

/** A year — the choice is a preference, not a session detail. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Narrows unknown input (a cookie, a form field) to a supported locale. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * The best supported language for an `Accept-Language` header, or null when the
 * browser asks for nothing we speak (the caller then falls back to
 * {@link DEFAULT_LOCALE}).
 *
 * Entries are ranked by their q-value, highest first, and each is matched on its
 * primary subtag — `uk-UA`, `uk` and `UK` all mean Ukrainian. A malformed or
 * out-of-range q is treated as 0 so a broken entry can never outrank a good one.
 */
export function matchLocale(acceptLanguage: string | null | undefined): Locale | null {
  if (!acceptLanguage) return null;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const parsed = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      const quality = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
      return { primary: tag.trim().split("-")[0].toLowerCase(), quality };
    })
    .filter((entry) => entry.primary.length > 0 && entry.quality > 0)
    // A stable sort keeps equal-quality entries in header order, which is the
    // order the browser meant them to be tried in.
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ranked) {
    if (isLocale(entry.primary)) return entry.primary;
  }
  return null;
}
