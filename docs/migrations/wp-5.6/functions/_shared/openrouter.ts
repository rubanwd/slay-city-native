/**
 * Text (JSON) generation via OpenRouter — the Deno port of what used to be
 * `src/features/teacher/openRouterChat.ts` in the web app.
 *
 * The only behavioural change from that file is *where the key comes from*:
 * `process.env.OPENROUTER_API_KEY` on a Vercel server becomes a Supabase Secret
 * read in `edgeRuntime.ts` and passed in as config. Nothing about the request
 * changes — same URL, same model default, same single-turn message, same
 * `response_format`, same `X-Title`, same 60 s timeout — so the model sees an
 * identical prompt and the teacher gets an identical result.
 *
 * Every failure is mapped to an `ErrorCode` here rather than to a bare string,
 * so the handler can return §5.1's taxonomy without re-deriving which failure it
 * was looking at. The messages themselves are unchanged from `openRouterChat.ts`.
 *
 * `fetch` and the key arrive as arguments, which is what lets this module be
 * imported under Node/Vitest with a stub fetch. It has no Deno reference.
 */

import {
  MESSAGES,
  unreadableResponseMessage,
  upstreamErrorMessage,
  type ErrorCode,
} from "./response.ts";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_TEXT_MODEL = "google/gemini-2.5-flash";

/** Text generation is slow; fail loudly rather than hanging the teacher's form. */
export const REQUEST_TIMEOUT_MS = 60_000;

export interface OpenRouterTextConfig {
  /** From Supabase Secrets. Absent is `not_configured`, never a guess. */
  apiKey: string | undefined;
  /** `OPENROUTER_TEXT_MODEL`, same name and default as the Server Action used. */
  model?: string;
  timeoutMs?: number;
  /** Injected so tests can run the whole path without a network. */
  fetchImpl?: typeof fetch;
}

export type OpenRouterTextFailure = Extract<
  ErrorCode,
  | "not_configured"
  | "upstream_timeout"
  | "upstream_unreachable"
  | "upstream_error"
  | "unreadable_response"
  | "empty_response"
>;

export type OpenRouterTextResult =
  | { ok: true; content: string }
  | { ok: false; code: OpenRouterTextFailure; message: string };

interface OpenRouterChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

/**
 * Sends one prompt to the OpenRouter chat model and returns the raw text content
 * of the first choice. The caller parses and validates the payload.
 *
 * There is no retry at any layer, deliberately (EDGE-FUNCTIONS-PLAN.md §5.2): a
 * timeout does not mean the request was not served, so an automatic retry can
 * double a bill silently. The teacher's "Generate" button is the retry, and the
 * 429 from `claim_ai_generation` is what stops them holding it down.
 */
export async function requestOpenRouterJson(
  prompt: string,
  config: OpenRouterTextConfig,
): Promise<OpenRouterTextResult> {
  if (!config.apiKey) {
    return { ok: false, code: "not_configured", message: MESSAGES.not_configured };
  }

  const doFetch = config.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await doFetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "SLAY CITY Teacher",
      },
      body: JSON.stringify({
        model: config.model || DEFAULT_TEXT_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(config.timeoutMs ?? REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // `AbortSignal.timeout` rejects with a TimeoutError in both runtimes.
    if (err instanceof Error && err.name === "TimeoutError") {
      return { ok: false, code: "upstream_timeout", message: MESSAGES.upstream_timeout };
    }
    return {
      ok: false,
      code: "upstream_unreachable",
      message: MESSAGES.upstream_unreachable,
    };
  }

  let body: OpenRouterChatResponse;
  try {
    body = (await response.json()) as OpenRouterChatResponse;
  } catch {
    return {
      ok: false,
      code: "unreadable_response",
      message: unreadableResponseMessage(response.status),
    };
  }

  if (!response.ok) {
    // OpenRouter's own message, verbatim — the only thing that says which of
    // bad key / no credit / provider rate limit this was.
    return {
      ok: false,
      code: "upstream_error",
      message: body.error?.message ?? upstreamErrorMessage(response.status),
    };
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return { ok: false, code: "empty_response", message: MESSAGES.empty_response };
  }

  return { ok: true, content };
}

/**
 * Extracts a JSON object from a model response, tolerating markdown code fences
 * or leading/trailing prose the model may add despite instructions. Returns
 * `null` when nothing parseable is found.
 *
 * Moved unchanged from `src/features/teacher/openRouterChat.ts`; its tests moved
 * with it into `prompts/vocabularyPrompt.test.ts`, where they already lived.
 */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
