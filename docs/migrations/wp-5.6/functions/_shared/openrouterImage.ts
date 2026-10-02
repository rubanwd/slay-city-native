/**
 * Image generation via OpenRouter — the Deno port of what used to be
 * `src/features/admin/openRouterImage.ts`'s `requestOpenRouterImage`,
 * `imageProviderRouting`, `describeImageRouting` and `urlToDataUrl`.
 *
 * Reached only from `generate-image`. Nothing about the request changes from
 * that file: same URL (shared with the text transport — see `OPENROUTER_URL`
 * in `./openrouter.ts`), same model default, same `modalities`, same
 * provider-routing slug and fallback behaviour, same 90 s timeout — so the
 * teacher's flashcard looks the same and costs the same as it does today.
 *
 * The flex-tier routing is a deliberate cost decision (~$0.019 vs ~$0.039 per
 * 1024px image, EDGE-FUNCTIONS-PLAN.md §3.2) and the fallback-detection
 * logging in `describeImageRouting` must survive the move unchanged — it is
 * the only signal that images have quietly started costing full price.
 *
 * `openRouterImage.ts`'s own messages are kept verbatim rather than reused
 * from `./response.ts`'s `MESSAGES`: the two transports have always read
 * slightly different wording ("Image generation is not configured…" here vs.
 * "AI generation is not configured…" for text), because they are, and always
 * were, two different files. Moving the call must not change a single word a
 * teacher reads.
 *
 * `fetch` and the key arrive as config, same as `openrouter.ts`, so this
 * module has no Deno reference and runs under Node/Vitest.
 */

import { OPENROUTER_URL } from "./openrouter.ts";
import type { ErrorCode } from "./response.ts";

export const DEFAULT_IMAGE_MODEL = "google/gemini-2.5-flash-image";

/**
 * Google AI Studio's flex tier serves the same model at roughly half the
 * standard rate, trading guaranteed latency for a best-effort queue — the
 * right trade for a teacher already waiting on a preview. An empty slug
 * disables routing and leaves OpenRouter's default alone.
 */
export const DEFAULT_IMAGE_PROVIDER_SLUG = "google-ai-studio/flex";

/** Image generation is slow; fail loudly rather than hanging the teacher's form. */
export const REQUEST_TIMEOUT_MS = 90_000;

export interface OpenRouterImageConfig {
  /** From Supabase Secrets. Absent is `not_configured`, never a guess. */
  apiKey: string | undefined;
  /** `OPENROUTER_IMAGE_MODEL`, same name and default as the Server Action used. */
  model?: string;
  /** `OPENROUTER_IMAGE_PROVIDER`, same name and default. */
  providerSlug?: string;
  timeoutMs?: number;
  /** Injected so tests can run the whole path without a network. */
  fetchImpl?: typeof fetch;
}

export type OpenRouterImageFailure = Extract<
  ErrorCode,
  | "not_configured"
  | "upstream_timeout"
  | "upstream_unreachable"
  | "upstream_error"
  | "unreadable_response"
  | "empty_response"
>;

export type OpenRouterImageResult =
  | { ok: true; dataUrl: string }
  | { ok: false; code: OpenRouterImageFailure; message: string };

interface OpenRouterImageResponse {
  choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
  error?: { message?: string };
  /** Tier that actually served the request: `default`, `flex`, `priority`, or null. */
  service_tier?: string | null;
  /** Upstream provider OpenRouter routed to, e.g. "Google AI Studio". */
  provider?: string;
  /** Always returned by OpenRouter; `cost` is what this request charged, in USD. */
  usage?: { cost?: number };
}

/**
 * OpenRouter's non-default service tiers, as they appear in a provider slug's
 * suffix. Anything else after the slash (`google-vertex/global`) is a region,
 * which does not change the tier.
 */
const SERVICE_TIERS = new Set(["flex", "priority", "fast"]);

function requestedTier(slug: string): string | null {
  if (!slug.trim()) return null;
  const suffix = slug.trim().split("/")[1];
  return suffix && SERVICE_TIERS.has(suffix) ? suffix : "default";
}

/**
 * Builds the one-line record of how a finished image request was actually
 * routed and billed. A silent fallback is invisible where you would look for
 * it — the served tier next to the dollars is what makes "is the cheap tier
 * actually working?" answerable from a log line instead of a pricing table.
 */
export function describeImageRouting(input: {
  providerSlug: string;
  servedTier?: string | null;
  provider?: string;
  cost?: number;
}): { text: string; fellBack: boolean } {
  const wanted = requestedTier(input.providerSlug);
  const served = input.servedTier ?? "unreported";
  const fellBack = wanted !== null && served !== "unreported" && served !== wanted;

  const parts = [`tier=${served}`];
  if (fellBack) {
    parts.push(`(asked for ${wanted} — it had no capacity, so this billed at ${served} rates)`);
  }
  if (input.provider) parts.push(`provider=${input.provider}`);
  if (typeof input.cost === "number") parts.push(`cost=$${input.cost.toFixed(4)}`);

  return { text: `OpenRouter image: ${parts.join(" ")}`, fellBack };
}

/**
 * OpenRouter provider-routing block for an image request, or `undefined` when
 * no tier is configured (leaving OpenRouter's default routing alone).
 */
export function imageProviderRouting(
  slug: string,
): { order: string[]; allow_fallbacks: true } | undefined {
  const trimmed = slug.trim();
  if (!trimmed) return undefined;
  return { order: [trimmed], allow_fallbacks: true };
}

/**
 * Base64-encodes bytes in fixed-size chunks rather than
 * `String.fromCharCode(...bytes)` in one call, which overflows the call stack
 * on images of any real size. `btoa`/`atob` are standard in both Deno and
 * Node 18+, so this needs no platform-specific buffer type.
 */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Fetches an http(s) image URL and re-encodes it as a data URL. */
async function urlToDataUrl(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return `data:${contentType};base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
}

/**
 * Sends one prompt to an OpenRouter image model and returns the generated
 * image as a data URL. Some models return a hosted URL rather than an inline
 * data URL; those are fetched and re-encoded so the caller always gets a
 * `data:` URL it can upload directly.
 *
 * No retry at any layer, deliberately (EDGE-FUNCTIONS-PLAN.md §5.2): a
 * timeout does not mean the request was not served, so an automatic retry can
 * double a bill silently.
 */
export async function requestOpenRouterImage(
  prompt: string,
  config: OpenRouterImageConfig,
): Promise<OpenRouterImageResult> {
  if (!config.apiKey) {
    return {
      ok: false,
      code: "not_configured",
      message: "Image generation is not configured on this server.",
    };
  }

  const doFetch = config.fetchImpl ?? fetch;
  const model = config.model || DEFAULT_IMAGE_MODEL;
  const providerSlug = config.providerSlug ?? DEFAULT_IMAGE_PROVIDER_SLUG;
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;

  let response: Response;
  try {
    response = await doFetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "SLAY CITY",
      },
      body: JSON.stringify({
        model,
        modalities: ["image", "text"],
        messages: [{ role: "user", content: prompt }],
        provider: imageProviderRouting(providerSlug),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return {
        ok: false,
        code: "upstream_timeout",
        message: "The image model took too long. Try again.",
      };
    }
    return {
      ok: false,
      code: "upstream_unreachable",
      message: "Could not reach the image model. Check your connection.",
    };
  }

  let body: OpenRouterImageResponse;
  try {
    body = (await response.json()) as OpenRouterImageResponse;
  } catch {
    return {
      ok: false,
      code: "unreadable_response",
      message: `Image model returned an unreadable response (${response.status}).`,
    };
  }

  if (!response.ok) {
    // Surface OpenRouter's own message (bad key, no credit, rate limit) — it
    // is the only thing that tells the teacher how to fix the problem.
    return {
      ok: false,
      code: "upstream_error",
      message: body.error?.message ?? `Image model error (${response.status}).`,
    };
  }

  // The request is billed from here on, so record what it cost and which
  // tier served it. A fallback is the case worth noticing: it means the cheap
  // tier is unavailable and images are quietly costing full price.
  const routing = describeImageRouting({
    providerSlug,
    servedTier: body.service_tier,
    provider: body.provider,
    cost: body.usage?.cost,
  });
  if (routing.fellBack) console.warn(routing.text);
  else console.info(routing.text);

  const url = body.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) {
    return {
      ok: false,
      code: "empty_response",
      message: "The model did not return an image. Try regenerating.",
    };
  }
  if (url.startsWith("data:image/")) {
    return { ok: true, dataUrl: url };
  }

  const dataUrl = await urlToDataUrl(url, doFetch, timeoutMs);
  if (!dataUrl) {
    return {
      ok: false,
      code: "empty_response",
      message: "The model did not return a usable image. Try regenerating.",
    };
  }
  return { ok: true, dataUrl };
}
