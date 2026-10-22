import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { readFunctionError } from "./aiDrafting";
import { copyVocabularyFromTopic, generateVocabularyDraft, generateWordImage, publishVocabulary } from "./vocabularyAuthoring";

type Result = { data: unknown; error?: unknown };

function client({ invoke = { data: null, error: null } as Result, rpcError = null as unknown, tables = {} as Record<string, Result> } = {}) {
  const chain = (result: Result): unknown =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
          return () => chain(result);
        },
      },
    );
  const functions = { invoke: vi.fn().mockResolvedValue(invoke) };
  const rpc = vi.fn().mockResolvedValue({ data: null, error: rpcError });
  const from = vi.fn((table: string) => chain({ error: null, ...(tables[table] ?? { data: [] }) }));
  return { db: { functions, rpc, from } as never, functions, rpc };
}

const httpError = (body: unknown) => new FunctionsHttpError(new Response(JSON.stringify(body), { status: 429 }));

describe("readFunctionError", () => {
  it("reads the function's own message out of the response", async () => {
    expect(await readFunctionError(httpError({ error: { code: "rate_limited", message: "Too many drafts. Try again in a minute." } }))).toEqual({
      code: "rate_limited",
      message: "Too many drafts. Try again in a minute.",
    });
  });

  it("falls back when the body isn't the contract, or nothing came back", async () => {
    expect((await readFunctionError(new FunctionsHttpError(new Response("<html>502</html>")))).message).toBe("Something went wrong. Try again.");
    expect((await readFunctionError(new FunctionsFetchError("offline"))).message).toBe("Could not reach the AI model. Check your connection.");
  });
});

describe("generateVocabularyDraft", () => {
  it("asks draft-vocabulary for a clamped number of words", async () => {
    const words = [{ word: "cat", transcription: null, translation: "кіт", exampleSentence: null, imagePrompt: "a cat" }];
    const { db, functions } = client({ invoke: { data: { words }, error: null } });
    expect(await generateVocabularyDraft(db, { topicId: "t1", extraInstructions: "nouns", wordCount: 99 })).toEqual({ ok: true, words });
    expect(functions.invoke).toHaveBeenCalledWith("draft-vocabulary", {
      body: { topic_id: "t1", extra_instructions: "nouns", word_count: 20, act_as_teacher_id: null },
    });
  });

  it("degrades to a readable message when the function isn't there or refuses", async () => {
    const { db } = client({ invoke: { data: null, error: new FunctionsFetchError("404") } });
    expect(await generateVocabularyDraft(db, { topicId: "t1", extraInstructions: null, wordCount: 6 })).toEqual({
      ok: false,
      error: "Could not reach the AI model. Check your connection.",
    });
    const empty = client({ invoke: { data: { words: [] }, error: null } });
    expect((await generateVocabularyDraft(empty.db, { topicId: "t1", extraInstructions: null, wordCount: 6 })).ok).toBe(false);
  });
});

describe("generateWordImage", () => {
  it("asks generate-image, skipping the cache only when told to", async () => {
    const { db, functions } = client({ invoke: { data: { image_url: "https://img", cached: true }, error: null } });
    expect(await generateWordImage(db, { topicId: "t1", word: "cat", imagePrompt: null, forceRegenerate: true })).toEqual({ ok: true, imageUrl: "https://img" });
    expect(functions.invoke).toHaveBeenCalledWith("generate-image", {
      body: { topic_id: "t1", word: "cat", image_prompt: null, force_regenerate: true, act_as_teacher_id: null },
    });
  });
});

describe("publishVocabulary", () => {
  const words = [
    { word: " cat ", transcription: " ", translation: "кіт", imageUrl: null },
    { word: "dog", transcription: "/dɒɡ/", translation: "пес", imageUrl: "https://img/dog" },
    { word: "half", transcription: null, translation: " ", imageUrl: null },
  ];

  it("publishes the complete words with the seeded test, in one call", async () => {
    const { db, rpc } = client();
    expect(await publishVocabulary(db, { topicId: "t1", words, taskCount: 2, testSeed: 3 })).toEqual({ ok: true });
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("publish_homework_vocabulary");
    expect(args.p_words).toEqual([
      { word: "cat", transcription: null, translation: "кіт", image_url: null },
      { word: "dog", transcription: "/dɒɡ/", translation: "пес", image_url: "https://img/dog" },
    ]);
    expect(args.p_tasks).toHaveLength(2);
  });

  it("refuses an empty set before calling the database", async () => {
    const { db, rpc } = client();
    expect(await publishVocabulary(db, { topicId: "t1", words: [words[2]], taskCount: 2 })).toEqual({
      ok: false,
      error: "Add at least one word with a translation before publishing.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the database's refusal through", async () => {
    const { db } = client({ rpcError: { message: "You can only edit your own topics." } });
    expect(await publishVocabulary(db, { topicId: "t1", words, taskCount: 0 })).toEqual({ ok: false, error: "You can only edit your own topics." });
  });
});

describe("copyVocabularyFromTopic", () => {
  it("returns the other topic's words and test size", async () => {
    const { db } = client({
      tables: {
        homework_vocab_words: { data: [{ word: "cat", transcription: null, translation: "кіт", image_url: "https://img", order_index: 0 }] },
        homework_vocab_tasks: { data: [{ id: "a" }, { id: "b" }, { id: "c" }] },
      },
    });
    expect(await copyVocabularyFromTopic(db, "t9")).toEqual({
      ok: true,
      words: [{ word: "cat", transcription: null, translation: "кіт", imageUrl: "https://img" }],
      taskCount: 3,
    });
  });

  it("says when there is nothing to copy", async () => {
    expect(await copyVocabularyFromTopic(client().db, "t9")).toEqual({ ok: false, error: "That topic has no vocabulary to copy." });
  });
});
