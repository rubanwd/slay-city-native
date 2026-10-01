/**
 * The one error taxonomy every AI Edge Function answers with, and the JSON
 * helpers that serialise it.
 *
 * Specified in `docs/EDGE-FUNCTIONS-PLAN.md` §5.1 (native repo). Every non-2xx
 * response is `{ error: { code, message } }`: `code` is what a client branches
 * on, `message` is what the teacher reads.
 *
 * The messages marked "existing" below are the strings the Next.js Server
 * Actions already produce today, character for character. Moving the OpenRouter
 * call behind a function must not change a single word a teacher sees — the web
 * UX is the regression baseline for this work package. The rest are new because
 * the failure mode is new.
 *
 * Runtime-agnostic on purpose: no Deno and no Supabase import, so the handler
 * tests can import it under Node/Vitest (`Response` is global in both). Every
 * Deno-only concern lives in `edgeRuntime.ts`.
 */

export type ErrorCode =
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

export interface ErrorPayload {
  error: { code: ErrorCode; message: string };
}

/** HTTP status for each code. The client branches on `code`, not on status. */
const STATUS: Record<ErrorCode, number> = {
  method_not_allowed: 405,
  unauthorized: 401,
  forbidden: 403,
  invalid_request: 400,
  rate_limited: 429,
  not_configured: 500,
  upstream_timeout: 504,
  upstream_unreachable: 502,
  upstream_error: 502,
  unreadable_response: 502,
  empty_response: 502,
  unusable_response: 422,
  internal: 500,
};

/**
 * Default teacher-facing message per code. `upstream_error` has none: it always
 * carries OpenRouter's own `error.message` verbatim, because that is the only
 * thing that distinguishes *bad key* from *no credit* from *provider rate
 * limit*.
 */
export const MESSAGES = {
  method_not_allowed: "Method not allowed.",
  unauthorized: "Your session expired. Sign in again.",
  /** Not a teacher, or a non-admin tried to act as one. Existing string. */
  forbidden_not_teacher: "Only teachers can manage homework.",
  /** Topic missing, or owned by someone else. Existing string. */
  forbidden_topic: "Topic not found or not yours to edit.",
  invalid_request: "Something was wrong with that request. Try again.",
  /** Existing string. */
  not_configured: "AI generation is not configured on this server.",
  /** Existing string. */
  upstream_timeout: "The AI model took too long. Try again.",
  /** Existing string. */
  upstream_unreachable: "Could not reach the AI model. Check your connection.",
  /** Existing string. */
  empty_response: "The model returned no content. Try again.",
  internal: "Something went wrong. Try again.",
} as const;

/** Existing string. `status` is OpenRouter's, mirroring `openRouterChat.ts`. */
export function unreadableResponseMessage(status: number): string {
  return `AI model returned an unreadable response (${status}).`;
}

/** Existing fallback when OpenRouter returns a non-2xx with no `error.message`. */
export function upstreamErrorMessage(status: number): string {
  return `AI model error (${status}).`;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  headers: Record<string, string> = {},
): Response {
  const body: ErrorPayload = { error: { code, message } };
  return jsonResponse(body, STATUS[code], headers);
}

/** Exposed so a test can assert the status a code maps to without a live request. */
export function statusForCode(code: ErrorCode): number {
  return STATUS[code];
}
