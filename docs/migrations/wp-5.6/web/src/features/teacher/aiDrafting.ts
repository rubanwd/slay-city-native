/**
 * The `draft-vocabulary` / `draft-grammar` / `generate-image` wire contract,
 * as the *callers* see it. Framework-free: no `"use server"`, no Supabase
 * import, no React — this is a shape both front ends have to agree on.
 *
 * The function side of the same contract lives in
 * `supabase/functions/_shared/` (`response.ts` for the taxonomy,
 * `drafts/*.ts` for the response bodies). The two must not drift, so the request
 * shapes are written here once and both Server Actions build them from these
 * types rather than from object literals.
 *
 * The native app will mirror this file as `packages/core/features/teacher/aiDrafting.ts`
 * and track it in `packages/core/.upstream.json`, which is why it is a standalone
 * module rather than a few interfaces inside `vocabularyActions.ts`. Per the
 * native repo's `docs/SYNC.md`, "signatures differ from upstream by design" does
 * **not** cover this file: these must be identical on both platforms.
 */

/** Bodies are `snake_case` — they are an HTTP contract, not a TypeScript call. */
export interface DraftVocabularyRequest {
  topic_id: string;
  extra_instructions: string | null;
  word_count: number;
  /** Admins only; the server verifies the caller's role before honouring it. */
  act_as_teacher_id: string | null;
}

export interface DraftGrammarRequest {
  topic_id: string;
  extra_instructions: string | null;
  point_count: number;
  task_count: number;
  act_as_teacher_id: string | null;
}

export interface GenerateImageRequest {
  topic_id: string;
  word: string;
  image_prompt: string | null;
  force_regenerate: boolean;
  act_as_teacher_id: string | null;
}

/**
 * The 200 body of `generate-image`. `snake_case`, unlike the drafting
 * functions' `words`/`points`+`tasks` — this is a thin wire shape, not a
 * domain object the UI already has a type for.
 */
export interface GenerateImageResponse {
  image_url: string;
  cached: boolean;
}

/**
 * Error codes the functions can return (`EDGE-FUNCTIONS-PLAN.md` §5.1). A caller
 * branches on `code`; `message` is what the teacher reads and is always safe to
 * display verbatim.
 */
export type AiDraftErrorCode =
  | "method_not_allowed"
  | "unauthorized"
  | "forbidden"
  | "invalid_request"
  | "rate_limited"
  | "not_configured"
  | "upstream_timeout"
  | "upstream_unreachable"
  | "upstream_error"
  | "unreadable_response"
  | "empty_response"
  | "unusable_response"
  | "internal";

/**
 * Client-side fallbacks, for the two cases where there is no function response to
 * read a message out of: the request never arrived, or it came back with a body
 * that is not this contract. Both strings already exist in the product.
 */
export const MESSAGES = {
  internal: "Something went wrong. Try again.",
  upstream_unreachable: "Could not reach the AI model. Check your connection.",
} as const;
