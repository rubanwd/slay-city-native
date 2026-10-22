import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * The `draft-vocabulary` / `draft-grammar` / `generate-image` Edge Function wire
 * contract, as callers see it — the native copy of the staged
 * `docs/migrations/wp-5.6/web/src/features/teacher/aiDrafting.ts`. Once
 * upstream merges that PR, the file belongs in `packages/core` as a tracked copy
 * (it must be identical on both platforms) and this one goes.
 *
 * The functions are not deployed yet (`docs/UPSTREAM-PR-WP-5.6.md`). Until they
 * are, every call fails, and the caller shows the message: the teacher authors
 * by hand, which is what WP-5.6's "failures degrade to manual authoring" asks.
 * No OpenRouter key is ever in this app.
 */

/** Bodies are `snake_case` — an HTTP contract, not a TypeScript call. */
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

export interface GenerateImageResponse {
  image_url: string;
  cached: boolean;
}

/** Fallbacks for when there is no function response to read a message from. Both strings exist in the product. */
export const AI_MESSAGES = {
  internal: "Something went wrong. Try again.",
  upstream_unreachable: "Could not reach the AI model. Check your connection.",
} as const;

/**
 * Port of the staged `lib/functionError.ts`: `functions.invoke()` hides the
 * function's own message inside the `Response` of a `FunctionsHttpError`, so
 * without this every failure would read "Edge Function returned a non-2xx
 * status code". A fetch or relay error never reached the function.
 */
export async function readFunctionError(error: unknown): Promise<{ code: string; message: string }> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await (error.context as Response).json()) as { error?: { code?: string; message?: string } };
      if (body?.error?.message) return { code: body.error.code ?? "internal", message: body.error.message };
    } catch {
      // A non-JSON body from the gateway (a 502 page, say). Fall through.
    }
    return { code: "internal", message: AI_MESSAGES.internal };
  }
  return { code: "upstream_unreachable", message: AI_MESSAGES.upstream_unreachable };
}
