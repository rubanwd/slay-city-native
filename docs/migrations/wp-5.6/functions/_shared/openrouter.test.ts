// Tests for the OpenRouter text transport.
//
// `openRouterChat.ts` had no tests upstream — only `extractJson` was covered, from
// the prompt test file. These are new, and they exist because the move is exactly
// the kind of change that silently alters a request: the whole guarantee of
// WP-5.6 is that the model sees the same request from Deno as it did from Vercel,
// and that every failure mode keeps the message a teacher already reads.
//
// `fetch` is injected, so nothing here touches the network.

import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_TEXT_MODEL,
  OPENROUTER_URL,
  requestOpenRouterJson,
  type OpenRouterTextConfig,
} from "./openrouter.ts";

function jsonFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

const OK_BODY = { choices: [{ message: { content: '{"words":[]}' } }] };

function config(over: Partial<OpenRouterTextConfig> = {}): OpenRouterTextConfig {
  return { apiKey: "sk-or-test", fetchImpl: jsonFetch(OK_BODY), ...over };
}

describe("requestOpenRouterJson — the request", () => {
  it("sends the same URL, model, message shape and headers as the Server Action did", async () => {
    const fetchImpl = jsonFetch(OK_BODY);
    await requestOpenRouterJson("PROMPT", config({ fetchImpl }));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(OPENROUTER_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk-or-test",
      "Content-Type": "application/json",
      "X-Title": "SLAY CITY Teacher",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: DEFAULT_TEXT_MODEL,
      messages: [{ role: "user", content: "PROMPT" }],
      response_format: { type: "json_object" },
    });
  });

  it("honours OPENROUTER_TEXT_MODEL so a model change stays a deploy-time change", async () => {
    const fetchImpl = jsonFetch(OK_BODY);
    await requestOpenRouterJson("P", config({ fetchImpl, model: "anthropic/claude-x" }));

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).model).toBe("anthropic/claude-x");
  });

  it("passes an abort signal, so a hung model cannot hang the function", async () => {
    const fetchImpl = jsonFetch(OK_BODY);
    await requestOpenRouterJson("P", config({ fetchImpl }));

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("times out to upstream_timeout with the existing message", async () => {
    const res = await requestOpenRouterJson(
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
      message: "The AI model took too long. Try again.",
    });
  });

  it("does not retry — a timeout may still have been billed", async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error("nope");
      err.name = "TimeoutError";
      throw err;
    }) as unknown as typeof fetch;

    await requestOpenRouterJson("P", config({ fetchImpl }));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("requestOpenRouterJson — failure taxonomy", () => {
  it("not_configured when the secret is absent, without calling fetch", async () => {
    const fetchImpl = jsonFetch(OK_BODY);
    const res = await requestOpenRouterJson("P", { apiKey: undefined, fetchImpl });

    expect(res).toEqual({
      ok: false,
      code: "not_configured",
      message: "AI generation is not configured on this server.",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("upstream_unreachable for any other fetch rejection", async () => {
    const res = await requestOpenRouterJson(
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
      message: "Could not reach the AI model. Check your connection.",
    });
  });

  it("unreadable_response, naming the status, when the body is not JSON", async () => {
    const res = await requestOpenRouterJson(
      "P",
      config({
        fetchImpl: (async () => new Response("<html>502</html>", { status: 502 })) as typeof fetch,
      }),
    );

    expect(res).toEqual({
      ok: false,
      code: "unreadable_response",
      message: "AI model returned an unreadable response (502).",
    });
  });

  it("upstream_error passes OpenRouter's own message through verbatim", async () => {
    const res = await requestOpenRouterJson(
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
    const res = await requestOpenRouterJson("P", config({ fetchImpl: jsonFetch({}, 503) }));
    expect(res).toEqual({ ok: false, code: "upstream_error", message: "AI model error (503)." });
  });

  it("empty_response when there is no content in the first choice", async () => {
    const res = await requestOpenRouterJson(
      "P",
      config({ fetchImpl: jsonFetch({ choices: [{ message: {} }] }) }),
    );

    expect(res).toEqual({
      ok: false,
      code: "empty_response",
      message: "The model returned no content. Try again.",
    });
  });

  it("never puts the API key in a returned message", async () => {
    const res = await requestOpenRouterJson(
      "P",
      config({ fetchImpl: jsonFetch({ error: { message: "bad key" } }, 401) }),
    );

    expect(JSON.stringify(res)).not.toContain("sk-or-test");
  });
});
