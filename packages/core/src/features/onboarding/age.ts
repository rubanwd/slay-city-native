/** Youngest and oldest age a player can enter. Mirrors `profiles_age_check`. */
export const MIN_AGE = 5;
export const MAX_AGE = 90;

export type AgeCheck = { ok: true; age: number | null } | { ok: false; error: string };

/** Parses the optional age field: blank means "not given", otherwise a whole number in range. */
export function parseAge(raw: string): AgeCheck {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, age: null };
  const age = Number(trimmed);
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
    return { ok: false, error: `Age must be between ${MIN_AGE} and ${MAX_AGE}.` };
  }
  return { ok: true, age };
}
