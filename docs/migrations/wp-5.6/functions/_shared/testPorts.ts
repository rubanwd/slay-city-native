/**
 * **Test-only.** A fake {@link DraftPorts} for the gate-order tests in
 * `draft-vocabulary/index.test.ts` and `draft-grammar/index.test.ts`.
 *
 * Not imported by any `index.ts`, so it is never bundled into a deployed
 * function. It lives beside the code it fakes rather than under a `__tests__`
 * directory because the web repo has no such convention — `update-streak` keeps
 * its test next to its handler.
 *
 * The important thing this buys: `calls.requestJson` counts outbound model calls,
 * so every rejection test can assert the number is **zero**. Money is spent at
 * the API call; a gate that fires after it is not a gate, and that is the one
 * property a reviewer cannot check by reading the handler top to bottom.
 */

import type { DraftPorts } from "./draftHandler.ts";
import type { OpenRouterTextResult } from "./openrouter.ts";
import type { ClaimInput, ClaimRow } from "./rateLimit.ts";
import type { TopicContext } from "./teacherAuth.ts";

export interface FakePortOptions {
  /** `auth.getUser()`'s answer. Null means an invalid or expired token. */
  user?: { id: string } | null;
  /** `profiles.role` per user id. Missing id → no profile row. */
  roles?: Record<string, string>;
  /** Topics the given teacher owns, keyed `"<topicId>|<teacherId>"`. */
  ownedTopics?: Record<string, TopicContext>;
  claim?: ClaimRow | null;
  /** Whether `OPENROUTER_API_KEY` is set in the function environment. */
  configured?: boolean;
  openRouter?: OpenRouterTextResult;
}

export interface FakePorts {
  ports: DraftPorts;
  calls: {
    requestJson: string[];
    claims: ClaimInput[];
    logs: Record<string, unknown>[];
  };
}

export function createFakePorts(options: FakePortOptions = {}): FakePorts {
  const calls: FakePorts["calls"] = { requestJson: [], claims: [], logs: [] };
  let clock = 0;

  const ports: DraftPorts = {
    getUserFromAuthHeader: async () => options.user ?? null,

    getProfileRole: async (userId: string) => options.roles?.[userId] ?? null,

    getOwnedTopic: async (topicId: string, teacherId: string) =>
      options.ownedTopics?.[`${topicId}|${teacherId}`] ?? null,

    claim: async (input: ClaimInput) => {
      calls.claims.push(input);
      return options.claim === undefined
        ? { allowed: true, retry_after_seconds: 0, remaining_today: 199 }
        : options.claim;
    },

    isConfigured: () => options.configured !== false,

    requestJson: async (prompt: string) => {
      calls.requestJson.push(prompt);
      return (
        options.openRouter ?? { ok: true as const, content: '{"words":[]}' }
      );
    },

    log: (entry) => {
      calls.logs.push(entry);
    },

    monotonicMs: () => (clock += 5),
  };

  return { ports, calls };
}

/** A POST with a bearer token and a JSON body — the shape of a real invocation. */
export function postRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/functions/v1/draft", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** A POST whose body is not JSON at all. */
export function postRawRequest(raw: string): Request {
  return new Request("https://example.test/functions/v1/draft", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: raw,
  });
}

export async function readError(response: Response): Promise<{ code: string; message: string }> {
  const body = (await response.json()) as { error: { code: string; message: string } };
  return body.error;
}
