import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./requireTeacher", () => ({ requireTeacher: vi.fn() }));
vi.mock("./viewAs", () => ({ readViewAsTeacherId: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createMockSupabase } from "@/lib/testSupabase";

import { FunctionsHttpError } from "@supabase/supabase-js";

import { requireTeacher } from "./requireTeacher";
import { readViewAsTeacherId } from "./viewAs";
import { clearVocabulary, generateVocabularyDraft, publishVocabulary } from "./vocabularyActions";

describe("publishVocabulary", () => {
  it("replaces the topic's vocabulary in one publish_homework_vocabulary call, not four direct writes", async () => {
    const { client, rpcCalls } = createMockSupabase({
      tables: { homework_topics: { id: "topic-1", group_id: "group-1" } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(requireTeacher).mockResolvedValue({ ok: true, userId: "teacher-1" });

    const result = await publishVocabulary({
      topicId: "topic-1",
      words: [{ word: "cat", transcription: null, translation: "кіт", imageUrl: null }],
      taskCount: 0,
    });

    expect(result).toEqual({ ok: true });
    expect(client.from).not.toHaveBeenCalledWith("homework_vocab_words");
    expect(client.from).not.toHaveBeenCalledWith("homework_vocab_tasks");
    expect(rpcCalls).toEqual([
      {
        name: "publish_homework_vocabulary",
        args: {
          p_topic_id: "topic-1",
          p_words: [{ word: "cat", transcription: null, translation: "кіт", image_url: null }],
          p_tasks: [],
        },
      },
    ]);
  });

  it("rejects a teacher who does not own the topic's group without calling the RPC", async () => {
    // requireTopicAccess reads homework_topics through RLS; a teacher outside
    // the owning group gets no row back, exactly as the direct-write version
    // did — the same "not yours to edit" case AC4 covers, caught here before
    // the RPC round trip rather than by it.
    const { client, rpcCalls } = createMockSupabase({ tables: { homework_topics: null } });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(requireTeacher).mockResolvedValue({ ok: true, userId: "other-teacher" });

    const result = await publishVocabulary({
      topicId: "topic-1",
      words: [{ word: "cat", transcription: null, translation: "кіт", imageUrl: null }],
      taskCount: 0,
    });

    expect(result).toEqual({ ok: false, error: "Topic not found or not yours to edit." });
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("clearVocabulary", () => {
  it("clears via clear_homework_vocabulary instead of two direct deletes", async () => {
    const { client, rpcCalls } = createMockSupabase({
      tables: { homework_topics: { id: "topic-1", group_id: "group-1" } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(requireTeacher).mockResolvedValue({ ok: true, userId: "teacher-1" });

    const result = await clearVocabulary("topic-1");

    expect(result).toEqual({ ok: true });
    expect(rpcCalls).toEqual([{ name: "clear_homework_vocabulary", args: { p_topic_id: "topic-1" } }]);
  });
});

/* ── WP-5.6: generateVocabularyDraft is now a thin caller ───────────────────── */

describe("generateVocabularyDraft", () => {
  it("invokes draft-vocabulary and never reads an OpenRouter key", async () => {
    const { client, invokeCalls } = createMockSupabase({
      functions: {
        "draft-vocabulary": {
          data: {
            words: [
              {
                word: "cow",
                transcription: "/kaʊ/",
                translation: "корова",
                exampleSentence: "The cow is big.",
                imagePrompt: "a friendly cartoon cow",
              },
            ],
          },
        },
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(readViewAsTeacherId).mockResolvedValue(null);

    const result = await generateVocabularyDraft({
      topicId: "11111111-1111-4111-8111-111111111111",
      topicTitle: "Animals",
      topicDescription: "Farm animals",
      extraInstructions: "beginner level",
      wordCount: 8,
    });

    expect(result).toEqual({
      ok: true,
      words: [
        {
          word: "cow",
          transcription: "/kaʊ/",
          translation: "корова",
          exampleSentence: "The cow is big.",
          imagePrompt: "a friendly cartoon cow",
        },
      ],
    });

    // The whole point of WP-5.6: the title and description are *not* sent, so a
    // forged title cannot become a forged prompt. The function reads them from
    // `homework_topics` in the query that proves ownership.
    expect(invokeCalls).toEqual([
      {
        name: "draft-vocabulary",
        body: {
          topic_id: "11111111-1111-4111-8111-111111111111",
          extra_instructions: "beginner level",
          word_count: 8,
          act_as_teacher_id: null,
        },
      },
    ]);
    expect(process.env.OPENROUTER_API_KEY).toBeUndefined();
  });

  it("clamps word_count before sending it", async () => {
    const { client, invokeCalls } = createMockSupabase({
      functions: { "draft-vocabulary": { data: { words: [{ word: "a", translation: "б" }] } } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(readViewAsTeacherId).mockResolvedValue(null);

    await generateVocabularyDraft({
      topicId: "11111111-1111-4111-8111-111111111111",
      topicTitle: "X",
      topicDescription: null,
      extraInstructions: null,
      wordCount: 9999,
    });

    expect((invokeCalls[0].body as { word_count: number }).word_count).toBe(20);
  });

  it("forwards the admin view-as teacher as an explicit field", async () => {
    // `readViewAsTeacherId()` reads a cookie through `next/headers`, which does
    // not exist in Deno. It becomes a request field the function re-verifies.
    const { client, invokeCalls } = createMockSupabase({
      functions: { "draft-vocabulary": { data: { words: [{ word: "a", translation: "б" }] } } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(readViewAsTeacherId).mockResolvedValue("22222222-2222-4222-8222-222222222222");

    await generateVocabularyDraft({
      topicId: "11111111-1111-4111-8111-111111111111",
      topicTitle: "X",
      topicDescription: null,
      extraInstructions: null,
      wordCount: 4,
    });

    expect((invokeCalls[0].body as { act_as_teacher_id: string }).act_as_teacher_id).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
  });

  it("surfaces the function's own message, not invoke()'s generic one", async () => {
    // Without `readFunctionError` this would read "Edge Function returned a
    // non-2xx status code" and the whole §5.1 taxonomy would be wasted.
    const { client } = createMockSupabase({
      functions: {
        "draft-vocabulary": {
          error: new FunctionsHttpError(
            new Response(
              JSON.stringify({
                error: { code: "rate_limited", message: "You've generated a lot recently. Try again in 2 minutes." },
              }),
              { status: 429, headers: { "Content-Type": "application/json" } }
            )
          ),
        },
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(readViewAsTeacherId).mockResolvedValue(null);

    const result = await generateVocabularyDraft({
      topicId: "11111111-1111-4111-8111-111111111111",
      topicTitle: "X",
      topicDescription: null,
      extraInstructions: null,
      wordCount: 4,
    });

    expect(result).toEqual({
      ok: false,
      error: "You've generated a lot recently. Try again in 2 minutes.",
    });
  });

  it("degrades to the offline message when the function is unreachable", async () => {
    const { client } = createMockSupabase({
      functions: { "draft-vocabulary": { error: new Error("fetch failed") } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(readViewAsTeacherId).mockResolvedValue(null);

    const result = await generateVocabularyDraft({
      topicId: "11111111-1111-4111-8111-111111111111",
      topicTitle: "X",
      topicDescription: null,
      extraInstructions: null,
      wordCount: 4,
    });

    expect(result).toEqual({
      ok: false,
      error: "Could not reach the AI model. Check your connection.",
    });
  });
});
