// Tests for the OpenRouter image transport. Mirrors `openrouter.test.ts`'s
// structure for the text transport — the same move, the same guarantee: the
// model sees the same request from Deno as it did from Vercel, and every
// failure keeps the exact message a teacher already reads.
//
// `fetch` is injected, so nothing here touches the network.

import { describe, expect, it, vi } from "vitest";

import { OPENROUTER_URL } from "./openrouter.ts";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_PROVIDER_SLUG,
  describeImageRouting,
  imageProviderRouting,
  requestOpenRouterImage,
  type OpenRouterImageConfig,
} from "./openrouterImage.ts";

function jsonFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

const DATA_URL_BODY = {
  choices: [{ message: { images: [{ image_url: { url: "data:image/png;base64,QQ==" } } ] } }],
};

function config(over: Partial<OpenRouterImageConfig> = {}): OpenRouterImageConfig {
  return { apiKey: "sk-or-test", fetchImpl: jsonFetch(DATA_URL_BODY), ...over };
}

describe("requestOpenRouterImage — the request", () => {
  it("sends the same URL, model, modalities, provider routing and headers as the Server Action did", async () => {
    const fetchImpl = jsonFetch(DATA_URL_BODY);
    await requestOpenRouterImage("PROMPT", config({ fetchImpl }));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(OPENROUTER_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk-or-test",
      "Content-Type": "application/json",
      "X-Title": "SLAY CITY",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: DEFAULT_IMAGE_MODEL,
      modalities: ["image", "text"],
      messages: [{ role: "user", content: "PROMPT" }],
      provider: { order: [DEFAULT_IMAGE_PROVIDER_SLUG], allow_fallbacks: true },
    });
  });

  it("honours OPENROUTER_IMAGE_MODEL / OPENROUTER_IMAGE_PROVIDER so a deploy-time change stays one", async () => {
    const fetchImpl = jsonFetch(DATA_URL_BODY);
    await requestOpenRouterImage(
      "P",
      config({ fetchImpl, model: "openai/gpt-image-x", providerSlug: "" }),
    );

    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(body.model).toBe("openai/gpt-image-x");
    expect(body.provider).toBeUndefined();
  });

  it("passes an abort signal, so a hung model cannot hang the function", async () => {
    const fetchImpl = jsonFetch(DATA_URL_BODY);
    await requestOpenRouterImage("P", config({ fetchImpl }));

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns the data URL as-is when the model inlines one", async () => {
    const res = await requestOpenRouterImage("P", config());
    expect(res).toEqual({ ok: true, dataUrl: "data:image/png;base64,QQ==" });
  });

  it("re-fetches and re-encodes a hosted image URL into a data URL", async () => {
    const chatFetch = jsonFetch({
      choices: [{ message: { images: [{ image_url: { url: "https://cdn.example/x.png" } } ] } }],
    });
    const imageBytes = new Uint8Array([1, 2, 3, 4]);
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === "https://cdn.example/x.png") {
        return new Response(imageBytes, { status: 200, headers: { "content-type": "image/png" } });
      }
      return chatFetch();
    }) as unknown as typeof fetch;

    const res = await requestOpenRouterImage("P", config({ fetchImpl }));
    expect(res.ok).toBe(true);
    expect((res as { ok: true; dataUrl: string }).dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("does not retry — a timeout may still have been billed", async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error("nope");
      err.name = "TimeoutError";
      throw err;
    }) as unknown as typeof fetch;

    await requestOpenRouterImage("P", config({ fetchImpl }));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("requestOpenRouterImage — failure taxonomy (openRouterImage.ts's own wording)", () => {
  it("not_configured when the secret is absent, without calling fetch", async () => {
    const fetchImpl = jsonFetch(DATA_URL_BODY);
    const res = await requestOpenRouterImage("P", { apiKey: undefined, fetchImpl });

    expect(res).toEqual({
      ok: false,
      code: "not_configured",
      message: "Image generation is not configured on this server.",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("upstream_timeout with the existing message", async () => {
    const res = await requestOpenRouterImage(
      "P",
      config({
        timeoutMs: 1,
        fetchImpl: ((_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const err = new Error("timed out");
              err.name = "TimeoutError";
              reject(err);
            });
          })) as unknown as typeof fetch,
      }),
    );

    expect(res).toEqual({
      ok: false,
      code: "upstream_timeout",
      message: "The image model took too long. Try again.",
    });
  });

  it("upstream_unreachable for any other fetch rejection", async () => {
    const res = await requestOpenRouterImage(
      "P",
      config({
        fetchImpl: (async () => {
          throw new TypeError("network down");
        }) as unknown as typeof fetch,
      }),
    );

    expect(res).toEqual({
      ok: false,
      code: "upstream_unreachable",
      message: "Could not reach the image model. Check your connection.",
    });
  });

  it("unreadable_response, naming the status, when the body is not JSON", async () => {
    const res = await requestOpenRouterImage(
      "P",
      config({
        fetchImpl: (async () => new Response("<html>502</html>", { status: 502 })) as typeof fetch,
      }),
    );

    expect(res).toEqual({
      ok: false,
      code: "unreadable_response",
      message: "Image model returned an unreadable response (502).",
    });
  });

  it("upstream_error passes OpenRouter's own message through verbatim", async () => {
    const res = await requestOpenRouterImage(
      "P",
      config({ fetchImpl: jsonFetch({ error: { message: "No auth credentials found" } }, 401) }),
    );

    expect(res).toEqual({
      ok: false,
      code: "upstream_error",
      message: "No auth credentials found",
    });
  });

  it("upstream_error falls back to a status when OpenRouter sends no message", async () => {
    const res = await requestOpenRouterImage("P", config({ fetchImpl: jsonFetch({}, 503) }));
    expect(res).toEqual({ ok: false, code: "upstream_error", message: "Image model error (503)." });
  });

  it("empty_response when there is no image in the first choice", async () => {
    const res = await requestOpenRouterImage(
      "P",
      config({ fetchImpl: jsonFetch({ choices: [{ message: {} }] }) }),
    );

    expect(res).toEqual({
      ok: false,
      code: "empty_response",
      message: "The model did not return an image. Try regenerating.",
    });
  });

  it("empty_response when a hosted image URL cannot be fetched", async () => {
    const chatFetch = jsonFetch({
      choices: [{ message: { images: [{ image_url: { url: "https://cdn.example/x.png" } } ] } }],
    });
    const fetchImpl = vi.fn(async (url: string) =>
      url === "https://cdn.example/x.png" ? new Response("nope", { status: 404 }) : chatFetch(),
    ) as unknown as typeof fetch;

    const res = await requestOpenRouterImage("P", config({ fetchImpl }));
    expect(res).toEqual({
      ok: false,
      code: "empty_response",
      message: "The model did not return a usable image. Try regenerating.",
    });
  });

  it("never puts the API key in a returned message", async () => {
    const res = await requestOpenRouterImage(
      "P",
      config({ fetchImpl: jsonFetch({ error: { message: "bad key" } }, 401) }),
    );

    expect(JSON.stringify(res)).not.toContain("sk-or-test");
  });
});

describe("imageProviderRouting", () => {
  it("builds an order with fallbacks on for a configured slug", () => {
    expect(imageProviderRouting("google-ai-studio/flex")).toEqual({
      order: ["google-ai-studio/flex"],
      allow_fallbacks: true,
    });
  });

  it("is undefined for an empty slug", () => {
    expect(imageProviderRouting("")).toBeUndefined();
    expect(imageProviderRouting("   ")).toBeUndefined();
  });
});

describe("describeImageRouting", () => {
  it("flags a fallback from the requested tier to the standard one", () => {
    const { text, fellBack } = describeImageRouting({
      providerSlug: "google-ai-studio/flex",
      servedTier: "default",
      cost: 0.039,
    });
    expect(fellBack).toBe(true);
    expect(text).toContain("asked for flex");
    expect(text).toContain("cost=$0.0390");
  });

  it("does not flag a request served at the tier it asked for", () => {
    const { fellBack } = describeImageRouting({
      providerSlug: "google-ai-studio/flex",
      servedTier: "flex",
    });
    expect(fellBack).toBe(false);
  });

  it("does not flag anything when no tier was requested", () => {
    const { fellBack } = describeImageRouting({ providerSlug: "", servedTier: "default" });
    expect(fellBack).toBe(false);
  });
});
