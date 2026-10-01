/**
 * Request-body validation for the AI drafting functions.
 *
 * The wire contract is `snake_case` (it is a wire contract); the parsed value is
 * `camelCase` (it is a domain object). Nothing here trusts a field: the client
 * is a browser or a phone, and `EDGE-FUNCTIONS-PLAN.md` §4.2 deliberately does
 * *not* accept `topic_title` / `topic_description` from it — a forged title is a
 * forged prompt, so the function reads them from `homework_topics` itself.
 *
 * Pure: no Deno, no Supabase, no network. Unit-tested under Node/Vitest.
 */

/** Fields every drafting request carries. */
export interface DraftRequestBase {
  topicId: string;
  extraInstructions: string | null;
  /**
   * Admins only. Replaces the `view-as-teacher` cookie `requireTeacher()` reads
   * through `next/headers`, which has no equivalent in Deno and none at all on a
   * phone. Verified server-side in `teacherAuth.ts`; a non-admin sending it is a
   * 403, never a silent ignore.
   */
  actAsTeacherId: string | null;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Matches the `MAX_FIELD_LEN` the prompt builders already clamp to. */
const MAX_INSTRUCTIONS_LEN = 500;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * An optional free-text field: a string, `null`, or absent. Anything else (a
 * number, an object, an array) is a malformed request rather than something to
 * coerce — coercion is how `[object Object]` ends up inside a prompt. Length is
 * clamped here as well as in the prompt builder so an oversized body is cheap to
 * reject and cheap to log.
 */
export function parseOptionalText(value: unknown): ParseResult<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  return { ok: true, value: trimmed.slice(0, MAX_INSTRUCTIONS_LEN) };
}

/**
 * An optional count, clamped into `[min, max]`. Absent means `fallback`.
 * Non-finite (`NaN`, `Infinity`, a string, `null`) is a malformed request, not
 * `min` — the client computed a number and got it wrong, and silently drafting
 * one word hides the bug.
 *
 * The web UI clamps the same ranges for its number input. That duplication is
 * intentional and unavoidable: the function cannot trust the client, and four
 * lines of `Math.min(Math.max())` are cheaper to re-derive in Deno than to
 * share across a repository boundary (EDGE-FUNCTIONS-PLAN.md §4.5).
 */
export function parseCount(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): ParseResult<number> {
  if (value === undefined || value === null) return { ok: true, value: fallback };
  if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false };
  return { ok: true, value: Math.min(max, Math.max(min, Math.round(value))) };
}

/**
 * Validates the fields shared by `draft-vocabulary` and `draft-grammar`.
 * Per-function counts are parsed by the function's own spec on top of this.
 */
export function parseDraftBase(raw: unknown): ParseResult<DraftRequestBase> {
  if (!isRecord(raw)) return { ok: false };

  if (!isUuid(raw.topic_id)) return { ok: false };

  const extra = parseOptionalText(raw.extra_instructions);
  if (!extra.ok) return { ok: false };

  const actAs = raw.act_as_teacher_id;
  if (actAs !== undefined && actAs !== null && !isUuid(actAs)) return { ok: false };

  return {
    ok: true,
    value: {
      topicId: raw.topic_id,
      extraInstructions: extra.value,
      actAsTeacherId: typeof actAs === "string" ? actAs : null,
    },
  };
}
