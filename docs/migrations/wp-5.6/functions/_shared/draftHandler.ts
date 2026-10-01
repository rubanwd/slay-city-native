/**
 * The gate chain both drafting functions run. `draft-vocabulary` and
 * `draft-grammar` differ only in their prompt builder, their parser and two
 * count fields, so the order of the checks — which *is* the security property —
 * is written once, here, and reviewed once.
 *
 * Order, from `EDGE-FUNCTIONS-PLAN.md` §4.2:
 *
 *   1. POST, else 405
 *   2. `Authorization` header present, else 401
 *   3. caller resolved from the JWT, else 401
 *   4. body valid, else 400
 *   5. OpenRouter configured, else 500 `not_configured`
 *   6. teacher resolved (role, and `act_as_teacher_id` for admins), else 403
 *   7. topic owned by that teacher, else 403 — and the prompt's title and
 *      description come from this read, never from the request
 *   8. rate-limit quota claimed, else 429
 *   9. ------ the only billed line in the function ------
 *  10. model output parsed; empty result is 422
 *
 * Steps 1–8 cost nothing. Step 9 spends money, and every gate is above it. That
 * is the whole point of the file, and `index.test.ts` asserts it by failing any
 * rejection path that called `requestJson`.
 *
 * Step 5 is one place this departs from the plan's ordering, which has the
 * configuration check inside the OpenRouter call at step 9. Hoisting it above the
 * claim means a server with no `OPENROUTER_API_KEY` does not burn a teacher's
 * quota to tell them so. No teacher-visible string changes.
 *
 * Pure: every outside effect is a port. No Deno, no Supabase, no `fetch`.
 */

import {
  claimAiGeneration,
  rateLimitMessage,
  retryAfterHeader,
  type AiGenerationKind,
  type RateLimitPorts,
} from "./rateLimit.ts";
import { extractJson, type OpenRouterTextResult } from "./openrouter.ts";
import { parseDraftBase, type DraftRequestBase, type ParseResult } from "./requestBody.ts";
import { errorResponse, jsonResponse, MESSAGES } from "./response.ts";
import {
  resolveOwnedTopic,
  resolveTeacherId,
  type TeacherAuthPorts,
  type TopicContext,
} from "./teacherAuth.ts";

export interface DraftPorts extends TeacherAuthPorts, RateLimitPorts {
  /** Resolves the caller from their bearer token, or null if it is not valid. */
  getUserFromAuthHeader(authHeader: string): Promise<{ id: string } | null>;
  /** The billed call. Nothing above it in the chain may invoke it. */
  requestJson(prompt: string): Promise<OpenRouterTextResult>;
  /** True when `OPENROUTER_API_KEY` is present in the function environment. */
  isConfigured(): boolean;
  /** Structured log line. Never the prompt and never the response body (§5.4). */
  log(entry: Record<string, unknown>): void;
  /** Injected so a test can assert `duration_ms` without a real clock. */
  monotonicMs(): number;
}

/**
 * What a function contributes on top of the shared chain. `TBody` extends
 * {@link DraftRequestBase}, so `topicId`, `extraInstructions` and
 * `actAsTeacherId` are parsed once by {@link parseDraftBase}.
 */
export interface DraftSpec<TBody extends DraftRequestBase, TResponse> {
  /** Ledger `kind`, and the budget it is counted against. */
  kind: AiGenerationKind;
  /** Per-function body fields on top of the shared ones. */
  parseBody(raw: unknown): ParseResult<TBody>;
  buildPrompt(body: TBody, topic: TopicContext): string;
  /**
   * Turns the model's JSON into the response body. `ok: false` is
   * `unusable_response` (422) with `message` — "The AI didn't return any usable
   * words. Try again." and its grammar sibling, both existing strings.
   */
  parseResponse(json: unknown): { ok: true; value: TResponse } | { ok: false; message: string };
}

export async function handleDraftRequest<TBody extends DraftRequestBase, TResponse>(
  req: Request,
  spec: DraftSpec<TBody, TResponse>,
  ports: DraftPorts,
): Promise<Response> {
  const startedAt = ports.monotonicMs();

  // Everything a rejection logs, filled in as the chain learns it.
  const entry: Record<string, unknown> = { kind: spec.kind };
  const finish = (outcome: string, response: Response): Response => {
    ports.log({ ...entry, outcome, duration_ms: ports.monotonicMs() - startedAt });
    return response;
  };

  // 1 — method
  if (req.method !== "POST") {
    return finish(
      "method_not_allowed",
      errorResponse("method_not_allowed", MESSAGES.method_not_allowed),
    );
  }

  // 2 — a bearer token at all. `verify_jwt = true` in config.toml means the
  // platform gateway should already have rejected this, so reaching it means
  // either local `--no-verify-jwt` or a config regression. Check anyway.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return finish("unauthorized", errorResponse("unauthorized", MESSAGES.unauthorized));
  }

  // 3 — who is calling. Resolved from the token with an anon-key client, never
  // from a field in the body.
  let user: { id: string } | null;
  try {
    user = await ports.getUserFromAuthHeader(authHeader);
  } catch {
    return finish("unauthorized", errorResponse("unauthorized", MESSAGES.unauthorized));
  }
  if (!user) {
    return finish("unauthorized", errorResponse("unauthorized", MESSAGES.unauthorized));
  }
  entry.user_id = user.id;

  // 4 — the body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return finish("invalid_request", errorResponse("invalid_request", MESSAGES.invalid_request));
  }
  const base = parseDraftBase(raw);
  if (!base.ok) {
    return finish("invalid_request", errorResponse("invalid_request", MESSAGES.invalid_request));
  }
  const parsed = spec.parseBody(raw);
  if (!parsed.ok) {
    return finish("invalid_request", errorResponse("invalid_request", MESSAGES.invalid_request));
  }
  const body = parsed.value;
  entry.topic_id = body.topicId;

  // 5 — a server that cannot call the model should not spend a teacher's quota
  // finding out.
  if (!ports.isConfigured()) {
    return finish("not_configured", errorResponse("not_configured", MESSAGES.not_configured));
  }

  // 6 — whose budget and whose topics. §3.4: `requireTeacher()` is the only
  // thing standing between a student and an OpenRouter bill today, and it only
  // ever ran on the Next.js server.
  const teacher = await resolveTeacherId(ports, user.id, body.actAsTeacherId);
  if (!teacher.ok) {
    return finish("forbidden", errorResponse("forbidden", teacher.message));
  }
  entry.teacher_id = teacher.teacherId;

  // 7 — ownership, and the prompt's topic text. `homework_topics_select` grants
  // `is_group_member(group_id)`, so a *visible* topic proves nothing; this reads
  // through `teacher_groups.teacher_id`.
  const topic = await resolveOwnedTopic(ports, body.topicId, teacher.teacherId);
  if (!topic.ok) {
    return finish("forbidden", errorResponse("forbidden", topic.message));
  }

  // 8 — quota. Claimed, not merely checked: the row is inserted in the same
  // transaction, so two concurrent requests cannot both pass.
  const claim = await claimAiGeneration(ports, {
    userId: user.id,
    teacherId: teacher.teacherId,
    kind: spec.kind,
    topicId: body.topicId,
  });
  if (!claim) {
    // The ledger was unreachable. Fail closed: spend nothing.
    return finish("internal", errorResponse("internal", MESSAGES.internal));
  }
  if (!claim.allowed) {
    return finish(
      "rate_limited",
      errorResponse(
        "rate_limited",
        rateLimitMessage(claim.retryAfterSeconds),
        retryAfterHeader(claim.retryAfterSeconds),
      ),
    );
  }
  entry.remaining_today = claim.remainingToday;

  // 9 — the billed call. Everything above is free; nothing below it is a gate.
  const result = await ports.requestJson(spec.buildPrompt(body, topic.topic));
  if (!result.ok) {
    return finish(result.code, errorResponse(result.code, result.message));
  }

  // 10 — the model's output. A response that parses to nothing is the model's
  // fault, not the caller's, but it is not a 5xx either: the request was fine and
  // retrying may work.
  const parsedResponse = spec.parseResponse(extractJson(result.content));
  if (!parsedResponse.ok) {
    return finish("unusable_response", errorResponse("unusable_response", parsedResponse.message));
  }

  return finish("ok", jsonResponse(parsedResponse.value));
}
