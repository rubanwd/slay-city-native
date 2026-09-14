/**
 * Plural form pickers for the languages the parent console speaks.
 *
 * Kept as two tiny functions rather than an `Intl.PluralRules` wrapper: the
 * dictionaries stay readable (each message spells out its own forms next to the
 * text it belongs to), and the rules below are the whole of what Ukrainian and
 * Russian need for counts.
 */

/** English: one apple, two apples. */
export function pluralEn(count: number, one: string, other: string): string {
  return count === 1 ? one : other;
}

/**
 * Ukrainian and Russian share the same rule: `one` for 1, 21, 31…; `few` for
 * 2–4, 22–24…; `many` for 0, 5–20, 25–30… The teens are the exception that
 * makes the second condition necessary.
 */
export function pluralSlavic(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(count));
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
