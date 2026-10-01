/**
 * The quota claim that runs immediately before every billed call.
 *
 * All the arithmetic lives in SQL — `public.claim_ai_generation(...)`, added by
 * `20260930000010_ai_generation_rate_limit.sql`. The budgets are deliberately
 * *not* duplicated here: two copies of "5 per minute" is how a limit silently
 * stops matching the ledger it is counted from. This module only names the kinds,
 * calls the RPC, and turns its answer into the §5.1 429.
 *
 * Pure: the RPC arrives as a port. The real one is a service-role
 * `supabase.rpc()` in `edgeRuntime.ts` — `claim_ai_generation` has `execute`
 * revoked from `public` and granted only to `service_role`, so a client holding
 * the anon key cannot call it at all, which is the difference between a limit and
 * a suggestion.
 */

/** The `kind` column's CHECK constraint, mirrored. */
export type AiGenerationKind = "draft_vocabulary" | "draft_grammar" | "generate_image";

export interface ClaimInput {
  /** The signed-in caller. An admin viewing-as is recorded as themselves. */
  userId: string;
  /** Whose budget is spent: the topic's owning teacher. */
  teacherId: string;
  kind: AiGenerationKind;
  topicId: string | null;
}

export interface ClaimOutcome {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingToday: number;
}

/** Shape of one `claim_ai_generation` row, as PostgREST returns it. */
export interface ClaimRow {
  allowed: boolean;
  retry_after_seconds: number;
  remaining_today: number;
}

export interface RateLimitPorts {
  /**
   * Calls `public.claim_ai_generation`. Rejects (or returns null) only if the RPC
   * itself failed; a *refusal* is a successful call with `allowed: false`.
   */
  claim(input: ClaimInput): Promise<ClaimRow | null>;
}

/**
 * Claims one unit of quota. Returns `null` when the RPC could not be reached or
 * returned nothing, which the handler surfaces as `internal` (500) and **does not
 * proceed past**. A rate limiter that fails open is not a rate limiter: if the
 * ledger is unavailable, the correct answer is to spend nothing.
 */
export async function claimAiGeneration(
  ports: RateLimitPorts,
  input: ClaimInput,
): Promise<ClaimOutcome | null> {
  const row = await ports.claim(input);
  if (!row) return null;
  return {
    allowed: row.allowed === true,
    retryAfterSeconds: Number(row.retry_after_seconds) || 0,
    remainingToday: Number(row.remaining_today) || 0,
  };
}

/**
 * The teacher-facing 429. Names a real wait, because the SQL side computed one
 * from the ledger rather than guessing — "try again later" is what this replaces.
 * Sub-minute waits round up to one minute: "try again in 7 seconds" invites the
 * teacher to sit there counting.
 */
export function rateLimitMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil((retryAfterSeconds || 0) / 60));
  return `You've generated a lot recently. Try again in ${minutes} minute${
    minutes === 1 ? "" : "s"
  }.`;
}

/** `Retry-After` is in seconds and must be a positive integer. */
export function retryAfterHeader(retryAfterSeconds: number): Record<string, string> {
  return { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds || 0))) };
}
