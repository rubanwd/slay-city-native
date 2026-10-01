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
import { clearGrammar, generateGrammarDraft, publishGrammar } from "./grammarActions";

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

/* ── WP-5.6: generateGrammarDraft is now a thin caller ──────────────────────── */

const TOPIC = "11111111-1111-4111-8111-111111111111";

function grammarInput(over: Partial<Parameters<typeof generateGrammarDraft>[0]> = {}) {
  return {
    topicId: TOPIC,
    topicTitle: "Present Simple",
    topicDescription: "he/she/it + s",
    extraInstructions: null,
    pointCount: 4,
    taskCount: 3,
    ...over,
  };
}

describe("generateGrammarDraft", () => {
  it("invokes draft-grammar with both clamped counts and no topic text", async () => {
    const { client, invokeCalls } = createMockSupabase({
      functions: {
        "draft-grammar": {
          data: {
            points: [{ title: "T", explanation: "E", example: null }],
            tasks: [{ taskType: "quiz", content: { question: "Q?", options: ["a", "b"], correctIndex: 0 } }],
          },
        },
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(readViewAsTeacherId).mockResolvedValue(null);

    const result = await generateGrammarDraft(grammarInput({ pointCount: 999, taskCount: 99 }));

    expect(result.ok).toBe(true);
    expect(invokeCalls).toEqual([
      {
        name: "draft-grammar",
        body: {
          topic_id: TOPIC,
          extra_instructions: null,
          point_count: 20,
          task_count: 20,
          act_as_teacher_id: null,
        },
      },
    ]);
  });

  it("treats an empty task list with points as a success", async () => {
    // Unchanged behaviour: a teacher may want rule cards with no test, and
    // `GrammarManager` already renders that.
    const { client } = createMockSupabase({
      functions: {
        "draft-grammar": { data: { points: [{ title: "T", explanation: "E", example: null }], tasks: [] } },
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(readViewAsTeacherId).mockResolvedValue(null);

    const result = await generateGrammarDraft(grammarInput());

    expect(result).toEqual({
      ok: true,
      points: [{ title: "T", explanation: "E", example: null }],
      tasks: [],
    });
  });

  it("returns the existing message when the model produced no usable points", async () => {
    const { client } = createMockSupabase({
      functions: {
        "draft-grammar": {
          error: new FunctionsHttpError(
            new Response(
              JSON.stringify({
                error: {
                  code: "unusable_response",
                  message: "The AI didn't return any usable grammar points. Try again.",
                },
              }),
              { status: 422, headers: { "Content-Type": "application/json" } }
            )
          ),
        },
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(readViewAsTeacherId).mockResolvedValue(null);

    const result = await generateGrammarDraft(grammarInput());

    expect(result).toEqual({
      ok: false,
      error: "The AI didn't return any usable grammar points. Try again.",
    });
  });

  it("leaves the teacher's draft alone on failure — it writes nothing either way", async () => {
    const { client, rpcCalls } = createMockSupabase({
      functions: { "draft-grammar": { error: new Error("offline") } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(readViewAsTeacherId).mockResolvedValue(null);

    const result = await generateGrammarDraft(grammarInput());

    expect(result.ok).toBe(false);
    expect(rpcCalls).toHaveLength(0);
    expect(client.from).not.toHaveBeenCalled();
  });
});
