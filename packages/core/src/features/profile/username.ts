/**
 * The one place that decides what a username may look like. Shared by signup
 * (`createProfile`) and the profile screen's rename card (`changeMyUsername`)
 * so both accept exactly the same names.
 *
 * Players write their real first name here — "Анастасія", "Marie-Claire",
 * "O'Brien" — so the rules are deliberately generous: any script's letters,
 * digits, spaces, and the handful of punctuation marks that show up inside
 * names. What stays out is anything that could impersonate another player or
 * break a layout: control characters, emoji, and symbols like `@ / < >`.
 */

/** Shortest allowed name, in characters. */
export const USERNAME_MIN_LENGTH = 2;
/**
 * Longest allowed name. Long enough for a full "Firstname Lastname" — the
 * previous 20 silently truncated names like "Anastasia Volodymyrivna" — while
 * still fitting the profile header and the teacher's student list.
 */
export const USERNAME_MAX_LENGTH = 32;

/**
 * Letters (any alphabet), combining marks, digits, spaces, and the punctuation
 * that occurs inside real names: `_ - ' ’ .`
 */
const ALLOWED_CHARS = /^[\p{L}\p{M}\p{N} _\-'’.]+$/u;

/** At least one letter or digit, so `"..."` or `"--"` can't become a name. */
const HAS_ALPHANUMERIC = /[\p{L}\p{N}]/u;

/** Why a username was rejected. The UI turns these into localized text. */
export type UsernameProblem =
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "needs_letter"
  | "taken"
  | "unknown";

export type UsernameCheck =
  | { ok: true; username: string }
  | { ok: false; problem: Exclude<UsernameProblem, "taken" | "unknown"> };

/**
 * The strings `ProfileUsernameCard` needs. Every role that can rename itself
 * (student, teacher, parent) has its own copy of these under its own message
 * namespace — same shape, so the same card renders all three — because each
 * namespace already carries its own translations independently (see
 * `Messages`).
 */
export interface UsernameCardMessages {
  usernameTitle: string;
  usernameChange: string;
  usernameCancel: string;
  usernameSave: string;
  usernameSaving: string;
  usernameSaved: string;
  usernameHint: string;
  usernameErrors: Record<UsernameProblem, string>;
}

/**
 * Trims the edges and collapses runs of whitespace, so "  Anna   Maria " and
 * "Anna Maria" are stored as the same name. Any whitespace character (tab,
 * non-breaking space, …) becomes a plain space first.
 */
export function normalizeUsername(raw: string): string {
  return raw.replace(/\s+/gu, " ").trim();
}

/**
 * Normalizes and validates a username. Length is counted in code points, not
 * UTF-16 units, so a name made of astral-plane letters isn't penalized.
 */
export function checkUsername(raw: string): UsernameCheck {
  const username = normalizeUsername(raw);
  const length = Array.from(username).length;

  if (length < USERNAME_MIN_LENGTH) return { ok: false, problem: "too_short" };
  if (length > USERNAME_MAX_LENGTH) return { ok: false, problem: "too_long" };
  if (!ALLOWED_CHARS.test(username)) return { ok: false, problem: "invalid_chars" };
  if (!HAS_ALPHANUMERIC.test(username)) return { ok: false, problem: "needs_letter" };

  return { ok: true, username };
}

/**
 * English wording for a rejection. Used by signup, which is English-only; the
 * student profile screen localizes the same problems through `Messages`.
 */
export function usernameProblemMessage(problem: UsernameProblem): string {
  switch (problem) {
    case "too_short":
      return `Username must be at least ${USERNAME_MIN_LENGTH} characters.`;
    case "too_long":
      return `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`;
    case "invalid_chars":
      return "Username can only contain letters, numbers, spaces, and _ - ' .";
    case "needs_letter":
      return "Username must contain at least one letter or number.";
    case "taken":
      return "That username is already taken.";
    case "unknown":
      return "Couldn't save that username. Please try again.";
  }
}
