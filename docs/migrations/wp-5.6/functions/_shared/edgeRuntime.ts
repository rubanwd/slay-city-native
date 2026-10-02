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

import { Buffer } from "node:buffer";

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import { handleDraftRequest, type DraftPorts, type DraftSpec } from "./draftHandler.ts";
import { handleGenerateImageRequest, type ImagePorts } from "./imageHandler.ts";
import { requestOpenRouterJson } from "./openrouter.ts";
import { requestOpenRouterImage } from "./openrouterImage.ts";
import type { DraftRequestBase } from "./requestBody.ts";
import { errorResponse, MESSAGES } from "./response.ts";
import type { ClaimInput, ClaimRow, RateLimitPorts } from "./rateLimit.ts";
import type { TeacherAuthPorts, TopicContext } from "./teacherAuth.ts";

function env(name: string): string | undefined {
  return Deno.env.get(name) ?? undefined;
}

/** Two live Supabase clients, built the same way for every function here. */
interface Clients {
  /** Carries the caller's own JWT. Only for `auth.getUser()` and RPCs whose
   *  `SECURITY DEFINER` body re-checks `auth.uid()` (`cache_vocab_image`). */
  authClient: SupabaseClient;
  /** Bypasses RLS. For the ownership check (must not be subject to the
   *  over-broad `homework_topics_select` policy), the ledger claim (whose
   *  table has no grants to any PostgREST role at all) and the Storage
   *  upload (so a folder-wide policy is no longer what authorises the write). */
  admin: SupabaseClient;
}

function createClients(authHeader: string): Clients | null {
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return null;

  return {
    authClient: createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    }),
    admin: createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }),
  };
}

/** `Authorization: Bearer <jwt>` → `<jwt>`. */
function bearerToken(header: string): string {
  return header.replace(/^Bearer\s+/i, "").trim();
}

/**
 * The three privileged reads every AI function needs before its billed call:
 * who the caller is, whether they are a teacher (or an admin naming one), and
 * whether that teacher owns the topic. Shared by {@link createDraftPorts} and
 * {@link createImagePorts} so the two-client pattern — and the "two reads,
 * not one embedded join" ownership check — is written and reviewed once.
 */
function createSharedPorts(
  clients: Clients,
): TeacherAuthPorts & RateLimitPorts & { getUserFromAuthHeader(header: string): Promise<{ id: string } | null> } {
  const { authClient, admin } = clients;

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
  };
}

/**
 * Builds the real {@link DraftPorts} over a live Supabase project and OpenRouter.
 */
export function createDraftPorts(authHeader: string): DraftPorts | null {
  const clients = createClients(authHeader);
  if (!clients) return null;
  const shared = createSharedPorts(clients);

  const openRouterKey = env("OPENROUTER_API_KEY");

  return {
    ...shared,

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

/** `data:image/<type>;base64,<bytes>` → decoded bytes, content type and file extension. */
function decodeDataUrl(
  dataUrl: string,
): { bytes: Uint8Array; contentType: string; ext: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
  return { bytes: Buffer.from(match[2], "base64"), contentType, ext };
}

/**
 * Builds the real {@link ImagePorts} over a live Supabase project and
 * OpenRouter. Shares the two-client pattern with {@link createDraftPorts}: a
 * service-role client bypasses RLS for everything that must not be subject to
 * the over-broad `homework_topics_select` / `vocab_image_cache_select`
 * policies — the ownership check, the quota claim and the Storage upload (so
 * `content_insert_teacher_homework`'s folder-wide policy is no longer what
 * authorises the write; the path does that instead).
 *
 * `cache_vocab_image` is the one exception: it is `SECURITY DEFINER` but
 * still checks `is_teacher() or is_admin()` against `auth.uid()` internally,
 * which is null with no JWT — so it runs through `authClient`, the same way
 * the Server Action's own `supabase.rpc(...)` did.
 */
export function createImagePorts(authHeader: string): ImagePorts | null {
  const clients = createClients(authHeader);
  if (!clients) return null;
  const { authClient, admin } = clients;
  const shared = createSharedPorts(clients);

  const openRouterKey = env("OPENROUTER_API_KEY");
  const CONTENT_BUCKET = "content";

  return {
    ...shared,

    isConfigured() {
      return Boolean(openRouterKey);
    },

    async getCachedImageUrl(wordKey: string) {
      const { data } = await admin
        .from("vocab_image_cache")
        .select("image_url")
        .eq("word_key", wordKey)
        .maybeSingle();
      return (data?.image_url as string | undefined) ?? null;
    },

    requestImage(prompt: string) {
      return requestOpenRouterImage(prompt, {
        apiKey: openRouterKey,
        model: env("OPENROUTER_IMAGE_MODEL"),
        providerSlug: env("OPENROUTER_IMAGE_PROVIDER"),
      });
    },

    async uploadImage(dataUrl: string, teacherId: string) {
      const decoded = decodeDataUrl(dataUrl);
      if (!decoded) return { ok: false, message: "The generated image was unreadable. Try again." };

      // Scoped to the teacher's own folder, unlike the Server Action's
      // `homework/<uuid>.<ext>` — closes MIGRATIONS-NEEDED.md §7.1 for the
      // Storage write. The service-role client bypasses `storage.objects`
      // RLS entirely, so this is enforced by the path, not a policy.
      const path = `homework/${teacherId}/${crypto.randomUUID()}.${decoded.ext}`;
      const { error } = await admin.storage
        .from(CONTENT_BUCKET)
        .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: false });
      if (error) return { ok: false, message: error.message };

      const { data } = admin.storage.from(CONTENT_BUCKET).getPublicUrl(path);
      return { ok: true, url: data.publicUrl };
    },

    async cacheImage(wordKey: string, imageUrl: string) {
      // `cache_vocab_image` is `SECURITY DEFINER` but still checks
      // `is_teacher() or is_admin()` internally against `auth.uid()` — that
      // is null under the service-role client, which has no JWT at all. Call
      // it through `authClient`, carrying the real caller's token, exactly as
      // the Server Action's own `supabase.rpc(...)` did.
      const { error } = await authClient.rpc("cache_vocab_image", {
        p_word_key: wordKey,
        p_image_url: imageUrl,
      });
      if (error) {
        console.warn("cache_vocab_image failed:", error.message);
        return false;
      }
      return true;
    },

    log(entry: Record<string, unknown>) {
      console.log(JSON.stringify({ at: "ai_generate_image", ...entry }));
    },

    monotonicMs() {
      return performance.now();
    },
  };
}

/**
 * The whole of `generate-image/index.ts`: wire the real ports and serve. Same
 * pre-handler shortcuts as {@link serveDraftFunction} — the method and header
 * checks belong to the handler, but the ports need the caller's header to
 * exist first.
 */
export function serveImageFunction(): void {
  Deno.serve(async (req: Request): Promise<Response> => {
    const authHeader = req.headers.get("Authorization");

    if (req.method !== "POST") {
      return errorResponse("method_not_allowed", MESSAGES.method_not_allowed);
    }
    if (!authHeader) {
      return errorResponse("unauthorized", MESSAGES.unauthorized);
    }

    const ports = createImagePorts(authHeader);
    if (!ports) {
      console.error("edge function environment incomplete");
      return errorResponse("internal", MESSAGES.internal);
    }

    try {
      return await handleGenerateImageRequest(req, ports);
    } catch (err) {
      console.error("unhandled error in generate_image", err);
      return errorResponse("internal", MESSAGES.internal);
    }
  });
}
