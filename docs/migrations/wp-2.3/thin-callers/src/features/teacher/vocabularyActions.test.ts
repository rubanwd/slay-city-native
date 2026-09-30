import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./requireTeacher", () => ({ requireTeacher: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createMockSupabase } from "@/lib/testSupabase";

import { requireTeacher } from "./requireTeacher";
import { clearVocabulary, publishVocabulary } from "./vocabularyActions";

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
