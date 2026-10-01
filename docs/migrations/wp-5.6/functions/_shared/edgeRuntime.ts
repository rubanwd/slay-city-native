/**
 * **The only file in this work package that touches Deno or Supabase.**
 *
 * Everything else under `_shared/` is pure and dependency-injected, which is what
 * lets `index.test.ts` drive the whole gate chain under Node/Vitest — the same
 * split `update-streak/streak.ts` already uses, and the reason the web repo's
 * `vitest.config.ts` includes `supabase/functions/**` in its `unit` project.
 * Keep the boundary: anything that reads `Deno.env` or constructs a Supabase
 * client belongs here and nowhere else.
 *
 * Two clients, in this order, exactly as `update-streak/index.ts` does it:
 *
 *   * an **anon-key** client carrying the caller's `Authorization` header, used
 *     only for `auth.getUser()`. That is how the caller's identity is
 *     established — never from a field in the request body.
 *   * a **service-role** client for the privileged reads, the ownership check and
 *     the quota claim. The service key and `OPENROUTER_API_KEY` exist only inside
 *     this function's environment (Supabase Secrets) and are never serialised into
 *     a response, a log line or a client bundle.
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import { handleDraftRequest, type DraftPorts, type DraftSpec } from "./draftHandler.ts";
import { requestOpenRouterJson } from "./openrouter.ts";
import type { DraftRequestBase } from "./requestBody.ts";
import { errorResponse, MESSAGES } from "./response.ts";
import type { ClaimInput, ClaimRow } from "./rateLimit.ts";
import type { TopicContext } from "./teacherAuth.ts";

function env(name: string): string | undefined {
  return Deno.env.get(name) ?? undefined;
}

/**
 * Builds the real {@link DraftPorts} over a live Supabase project and OpenRouter.
 */
export function createDraftPorts(authHeader: string): DraftPorts | null {
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return null;

  const authClient: SupabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  // Bypasses RLS. Used for the ownership check (which must not be subject to the
  // over-broad `homework_topics_select` policy) and the ledger claim (whose table
  // has no grants to any PostgREST role at all).
  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const openRouterKey = env("OPENROUTER_API_KEY");

  return {
    async getUserFromAuthHeader(header: string) {
      const {
        data: { user },
        error,
      } = await authClient.auth.getUser(bearerToken(header));
      if (error || !user) return null;
      return { id: user.id };
    },

    async getProfileRole(userId: string) {
      const { data } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      return (data?.role as string | undefined) ?? null;
    },

    async getOwnedTopic(topicId: string, teacherId: string): Promise<TopicContext | null> {
      // Two reads rather than one embedded join: a PostgREST embed
      // (`teacher_groups!inner(teacher_id)`) depends on the FK's generated
      // relationship name, and a rename upstream would silently turn the
      // ownership filter into no filter at all. Two explicit equality reads
      // cannot fail that way, and they run on indexed primary keys.
      const { data: topic } = await admin
        .from("homework_topics")
        .select("group_id, title, description")
        .eq("id", topicId)
        .maybeSingle();
      if (!topic) return null;

      const { data: group } = await admin
        .from("teacher_groups")
        .select("id")
        .eq("id", topic.group_id)
        .eq("teacher_id", teacherId)
        .maybeSingle();
      if (!group) return null;

      return {
        title: (topic.title as string) ?? "",
        description: (topic.description as string | null) ?? null,
      };
    },

    async claim(input: ClaimInput): Promise<ClaimRow | null> {
      const { data, error } = await admin.rpc("claim_ai_generation", {
        p_user_id: input.userId,
        p_teacher_id: input.teacherId,
        p_kind: input.kind,
        p_topic_id: input.topicId,
      });
      if (error) {
        console.error("claim_ai_generation failed:", error.message);
        return null;
      }
      // `returns table (...)` comes back as an array of rows.
      const row = Array.isArray(data) ? data[0] : data;
      return (row as ClaimRow | undefined) ?? null;
    },

    isConfigured() {
      return Boolean(openRouterKey);
    },

    requestJson(prompt: string) {
      return requestOpenRouterJson(prompt, {
        apiKey: openRouterKey,
        model: env("OPENROUTER_TEXT_MODEL"),
      });
    },

    log(entry: Record<string, unknown>) {
      // §5.4: ids, outcome and timing only. Never the prompt (teacher-authored
      // text) and never the response body.
      console.log(JSON.stringify({ at: "ai_draft", ...entry }));
    },

    monotonicMs() {
      return performance.now();
    },
  };
}

/** `Authorization: Bearer <jwt>` → `<jwt>`. */
function bearerToken(header: string): string {
  return header.replace(/^Bearer\s+/i, "").trim();
}

/**
 * The whole of each function's `index.ts`: wire the real ports to the spec and
 * serve. Kept here so neither entry point has a line of its own logic to review.
 */
export function serveDraftFunction<TBody extends DraftRequestBase, TResponse>(
  spec: DraftSpec<TBody, TResponse>,
): void {
  Deno.serve(async (req: Request): Promise<Response> => {
    const authHeader = req.headers.get("Authorization");

    // The method check belongs to the handler, but the ports need the caller's
    // header to exist. Answer the two pre-handler cases the same way the handler
    // would, so the taxonomy has no gaps.
    if (req.method !== "POST") {
      return errorResponse("method_not_allowed", MESSAGES.method_not_allowed);
    }
    if (!authHeader) {
      return errorResponse("unauthorized", MESSAGES.unauthorized);
    }

    const ports = createDraftPorts(authHeader);
    if (!ports) {
      // SUPABASE_URL / keys missing from the function environment. Mirrors
      // `update-streak`'s "Server misconfigured", in this taxonomy.
      console.error("edge function environment incomplete");
      return errorResponse("internal", MESSAGES.internal);
    }

    try {
      return await handleDraftRequest(req, spec, ports);
    } catch (err) {
      // Nothing in the chain is expected to throw; if it does, the teacher gets
      // the generic message and the detail goes to the function log, not the wire.
      console.error("unhandled error in", spec.kind, err);
      return errorResponse("internal", MESSAGES.internal);
    }
  });
}
