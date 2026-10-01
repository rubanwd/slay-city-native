import { FunctionsHttpError } from "@supabase/supabase-js";

import { MESSAGES } from "@/features/teacher/aiDrafting";

/**
 * Unwraps a `supabase.functions.invoke()` error into the message the Edge
 * Function actually sent.
 *
 * This is the part that gets written wrong. `invoke()` does **not** put a non-2xx
 * response body in `error.message` — it returns a `FunctionsHttpError` whose
 * `context` is the raw `Response`, and `error.message` is the useless string
 * "Edge Function returned a non-2xx status code". Without this helper every one
 * of the function's error messages collapses into that sentence and the whole
 * taxonomy is wasted, which would be a visible regression: the teacher currently
 * reads "Insufficient credits…" or "The AI model took too long. Try again."
 *
 * The other two error classes are not HTTP responses at all:
 * `FunctionsFetchError` (the network never reached Supabase) and
 * `FunctionsRelayError` (the platform could not run the function). Both map to
 * the existing "Could not reach the AI model." string.
 */
export interface FunctionErrorResult {
  code: string;
  message: string;
}

export async function readFunctionError(error: unknown): Promise<FunctionErrorResult> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as {
        error?: { code?: string; message?: string };
      };
      if (body?.error?.message) {
        return { code: body.error.code ?? "internal", message: body.error.message };
      }
    } catch {
      // A non-JSON body from the gateway (a 502 HTML page, say). Fall through.
    }
    return { code: "internal", message: MESSAGES.internal };
  }

  return { code: "upstream_unreachable", message: MESSAGES.upstream_unreachable };
}
