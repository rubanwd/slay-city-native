import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./requireTeacher", () => ({ requireTeacher: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createMockSupabase } from "@/lib/testSupabase";

import { requireTeacher } from "./requireTeacher";
import { clearGrammar, publishGrammar } from "./grammarActions";

describe("publishGrammar", () => {
  it("replaces the topic's grammar set in one publish_homework_grammar call", async () => {
    const { client, rpcCalls } = createMockSupabase({
      tables: { homework_topics: { id: "topic-1", group_id: "group-1" } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(requireTeacher).mockResolvedValue({ ok: true, userId: "teacher-1" });

    const result = await publishGrammar({
      topicId: "topic-1",
      points: [{ title: "Past tense", explanation: "Add -ed.", example: "walked" }],
      tasks: [],
    });

    expect(result).toEqual({ ok: true });
    expect(client.from).not.toHaveBeenCalledWith("homework_grammar_points");
    expect(client.from).not.toHaveBeenCalledWith("homework_grammar_tasks");
    expect(rpcCalls).toEqual([
      {
        name: "publish_homework_grammar",
        args: {
          p_topic_id: "topic-1",
          p_points: [{ title: "Past tense", explanation: "Add -ed.", example: "walked" }],
          p_tasks: [],
        },
      },
    ]);
  });

  it("rejects a teacher who does not own the topic's group without calling the RPC", async () => {
    const { client, rpcCalls } = createMockSupabase({ tables: { homework_topics: null } });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(requireTeacher).mockResolvedValue({ ok: true, userId: "other-teacher" });

    const result = await publishGrammar({
      topicId: "topic-1",
      points: [{ title: "Past tense", explanation: "Add -ed.", example: null }],
      tasks: [],
    });

    expect(result).toEqual({ ok: false, error: "Topic not found or not yours to edit." });
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("clearGrammar", () => {
  it("clears via clear_homework_grammar instead of two direct deletes", async () => {
    const { client, rpcCalls } = createMockSupabase({
      tables: { homework_topics: { id: "topic-1", group_id: "group-1" } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(requireTeacher).mockResolvedValue({ ok: true, userId: "teacher-1" });

    const result = await clearGrammar("topic-1");

    expect(result).toEqual({ ok: true });
    expect(rpcCalls).toEqual([{ name: "clear_homework_grammar", args: { p_topic_id: "topic-1" } }]);
  });
});
