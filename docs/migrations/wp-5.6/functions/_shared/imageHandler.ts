/**
 * The gate chain `generate-image` runs. Deliberately not built on top of
 * `./draftHandler.ts`'s `DraftSpec`/`DraftPorts`: this function differs from
 * the two text functions in two structural ways that abstraction does not
 * fit —
 *
 *   * the `vocab_image_cache` read happens **before** the quota claim, so a
 *     cache hit costs neither money nor quota (EDGE-FUNCTIONS-PLAN.md §4.4,
 *     §6.6);
 *   * it ends in a Storage upload and a cache upsert, not a JSON parse, so
 *     there is no `parseResponse(json: unknown)` step to plug in.
 *
 * Order, adapted from `EDGE-FUNCTIONS-PLAN.md` §4.2/§4.4:
 *
 *   1. POST, else 405
 *   2. `Authorization` header present, else 401
 *   3. caller resolved from the JWT, else 401
 *   4. body valid, else 400
 *   5. OpenRouter configured, else 500 `not_configured`
 *   6. teacher resolved (role, and `act_as_teacher_id` for admins), else 403
 *   7. topic owned by that teacher, else 403 — the ownership check the
 *      Server Action never had (§3.4)
 *   8. cache read-through — a hit returns here, free
 *   9. rate-limit quota claimed, else 429
 *  10. ------ the only billed line in the function ------
 *  11. uploaded to Storage under `homework/<teacherId>/<uuid>.<ext>`
 *  12. cache upsert, non-fatal
 *
 * Steps 1–9 cost nothing. Step 10 is the only billed line, and every gate is
 * above it — `index.test.ts` asserts that by failing any rejection path that
 * called `requestImage`.
 *
 * Pure: every outside effect is a port. No Deno, no Supabase, no `fetch`.
 */

import {
  claimAiGeneration,
  rateLimitMessage,
  retryAfterHeader,
  type RateLimitPorts,
} from "./rateLimit.ts";
import type { OpenRouterImageResult } from "./openrouterImage.ts";
import { buildWordImagePrompt } from "./prompts/vocabularyPrompt.ts";
import {
  isRecord,
  isUuid,
  parseOptionalText,
  type ParseResult,
} from "./requestBody.ts";
import { errorResponse, jsonResponse, MESSAGES } from "./response.ts";
import {
  resolveOwnedTopic,
  resolveTeacherId,
  type TeacherAuthPorts,
} from "./teacherAuth.ts";
import { normalizeWordKey } from "./wordKey.ts";

/** The 200 body: `snake_case`, matching EDGE-FUNCTIONS-PLAN.md §4.4 exactly. */
export interface GenerateImageResponse {
  image_url: string;
  cached: boolean;
}

export interface GenerateImageBody {
  topicId: string;
  word: string;
  imagePrompt: string | null;
  /** Skip the cache and generate a fresh image, even on a hit. */
  forceRegenerate: boolean;
  actAsTeacherId: string | null;
}

const MAX_WORD_LEN = 100;

function parseWord(value: unknown): ParseResult<string> {
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false };
  return { ok: true, value: trimmed.slice(0, MAX_WORD_LEN) };
}

function parseForceRegenerate(value: unknown): ParseResult<boolean> {
  if (value === undefined || value === null) return { ok: true, value: false };
  if (typeof value !== "boolean") return { ok: false };
  return { ok: true, value };
}

/**
 * Request (snake_case wire contract):
 *
 *   POST /functions/v1/generate-image
 *   { "topic_id": uuid, "word": "apple", "image_prompt": string|null,
 *     "force_regenerate": false, "act_as_teacher_id": uuid|null }
 *
 * `word` must be a non-empty string; an empty one collapses into the same
 * generic `invalid_request` 400 every other malformed field does, rather than
 * the Server Action's bespoke "Give the word before generating an image." —
 * matching the precedent `draft-vocabulary`/`draft-grammar` already set for
 * every other field in this gate (EDGE-FUNCTIONS-PLAN.md §4.2 step 4). No real
 * caller sends an empty word; the client always has one before it asks.
 */
export function parseGenerateImageBody(raw: unknown): ParseResult<GenerateImageBody> {
  if (!isRecord(raw)) return { ok: false };
  if (!isUuid(raw.topic_id)) return { ok: false };

  const word = parseWord(raw.word);
  if (!word.ok) return { ok: false };

  const imagePrompt = parseOptionalText(raw.image_prompt);
  if (!imagePrompt.ok) return { ok: false };

  const forceRegenerate = parseForceRegenerate(raw.force_regenerate);
  if (!forceRegenerate.ok) return { ok: false };

  const actAs = raw.act_as_teacher_id;
  if (actAs !== undefined && actAs !== null && !isUuid(actAs)) return { ok: false };

  return {
    ok: true,
    value: {
      topicId: raw.topic_id,
      word: word.value,
      imagePrompt: imagePrompt.value,
      forceRegenerate: forceRegenerate.value,
      actAsTeacherId: typeof actAs === "string" ? actAs : null,
    },
  };
}

export interface ImagePorts extends TeacherAuthPorts, RateLimitPorts {
  /** Resolves the caller from their bearer token, or null if it is not valid. */
  getUserFromAuthHeader(authHeader: string): Promise<{ id: string } | null>;
  /** True when `OPENROUTER_API_KEY` is present in the function environment. */
  isConfigured(): boolean;
  /** `vocab_image_cache` read-through, keyed by the normalized word. */
  getCachedImageUrl(wordKey: string): Promise<string | null>;
  /** The billed call. Nothing above it in the chain may invoke it. */
  requestImage(prompt: string): Promise<OpenRouterImageResult>;
  /**
   * Uploads the generated image to Storage, scoped to `teacherId`'s own
   * folder (`homework/<teacherId>/<uuid>.<ext>`) rather than the folder-wide
   * `homework/<uuid>.<ext>` the Server Action used — closing
   * MIGRATIONS-NEEDED.md §7.1's "any teacher may overwrite any teacher's
   * image" for the Storage write (the cache row stays global on purpose; see
   * `cacheImage`).
   */
  uploadImage(
    dataUrl: string,
    teacherId: string,
  ): Promise<{ ok: true; url: string } | { ok: false; message: string }>;
  /**
   * `cache_vocab_image`, non-fatal: returns whether it succeeded so the
   * handler can log a warning, but a failure must not lose the teacher their
   * image — matching `generateWordImage`'s existing `console.warn` semantics.
   */
  cacheImage(wordKey: string, imageUrl: string): Promise<boolean>;
  /** Structured log line. Never the prompt and never the response body (§5.4). */
  log(entry: Record<string, unknown>): void;
  /** Injected so a test can assert `duration_ms` without a real clock. */
  monotonicMs(): number;
}

export async function handleGenerateImageRequest(
  req: Request,
  ports: ImagePorts,
): Promise<Response> {
  const startedAt = ports.monotonicMs();

  const entry: Record<string, unknown> = { kind: "generate_image" };
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

  // 2 — a bearer token at all
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return finish("unauthorized", errorResponse("unauthorized", MESSAGES.unauthorized));
  }

  // 3 — who is calling, from the token, never from the body
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
  const parsed = parseGenerateImageBody(raw);
  if (!parsed.ok) {
    return finish("invalid_request", errorResponse("invalid_request", MESSAGES.invalid_request));
  }
  const body = parsed.value;
  entry.topic_id = body.topicId;

  // 5 — a server that cannot call the model should not spend a teacher's
  // quota finding out. `openRouterImage.ts`'s own wording, not the text
  // transport's.
  if (!ports.isConfigured()) {
    return finish(
      "not_configured",
      errorResponse("not_configured", "Image generation is not configured on this server."),
    );
  }

  // 6 — whose budget and whose topics
  const teacher = await resolveTeacherId(ports, user.id, body.actAsTeacherId);
  if (!teacher.ok) {
    return finish("forbidden", errorResponse("forbidden", teacher.message));
  }
  entry.teacher_id = teacher.teacherId;

  // 7 — ownership. `homework_topics_select` grants `is_group_member`, so a
  // *visible* topic proves nothing; this reads through `teacher_groups.teacher_id`.
  const topic = await resolveOwnedTopic(ports, body.topicId, teacher.teacherId);
  if (!topic.ok) {
    return finish("forbidden", errorResponse("forbidden", topic.message));
  }

  const wordKey = normalizeWordKey(body.word);

  // 8 — cache read-through, before the quota claim: a hit costs neither
  // money nor quota (§4.4, §6.6).
  if (!body.forceRegenerate && wordKey) {
    const cachedUrl = await ports.getCachedImageUrl(wordKey);
    if (cachedUrl) {
      return finish("ok_cached", jsonResponse({ image_url: cachedUrl, cached: true }));
    }
  }

  // 9 — quota. Claimed, not merely checked.
  const claim = await claimAiGeneration(ports, {
    userId: user.id,
    teacherId: teacher.teacherId,
    kind: "generate_image",
    topicId: body.topicId,
  });
  if (!claim) {
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

  // 10 — the billed call
  const result = await ports.requestImage(buildWordImagePrompt(body.word, body.imagePrompt));
  if (!result.ok) {
    return finish(result.code, errorResponse(result.code, result.message));
  }

  // 11 — Storage, scoped to the teacher
  const upload = await ports.uploadImage(result.dataUrl, teacher.teacherId);
  if (!upload.ok) {
    return finish("internal", errorResponse("internal", upload.message));
  }

  // 12 — cache upsert, non-fatal: the teacher still gets their image.
  if (wordKey) {
    const cached = await ports.cacheImage(wordKey, upload.url);
    if (!cached) {
      entry.cache_write_failed = true;
    }
  }

  return finish("ok", jsonResponse({ image_url: upload.url, cached: false }));
}
