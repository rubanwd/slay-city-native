import { FunctionsFetchError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { copyGrammarFromTopic, generateGrammarDraft, publishGrammar } from "./grammarAuthoring";

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

const point = { title: "Plurals", explanation: "Add -s.", example: "cats" };
const task = { taskType: "quiz" as const, content: { question: "?", options: ["a", "b"], correctIndex: 0 } };

describe("generateGrammarDraft", () => {
  it("asks draft-grammar for clamped counts", async () => {
    const { db, functions } = client({ invoke: { data: { points: [point], tasks: [task] }, error: null } });
    expect(await generateGrammarDraft(db, { topicId: "t1", extraInstructions: null, pointCount: 50, taskCount: 99 })).toEqual({ ok: true, points: [point], tasks: [task] });
    expect(functions.invoke).toHaveBeenCalledWith("draft-grammar", {
      body: { topic_id: "t1", extra_instructions: null, point_count: 20, task_count: 20, act_as_teacher_id: null },
    });
  });

  it("degrades to a readable message", async () => {
    const { db } = client({ invoke: { data: null, error: new FunctionsFetchError("404") } });
    expect(await generateGrammarDraft(db, { topicId: "t1", extraInstructions: null, pointCount: 5, taskCount: 5 })).toEqual({
      ok: false,
      error: "Could not reach the AI model. Check your connection.",
    });
  });
});

describe("publishGrammar", () => {
  it("publishes the complete rules and the reviewed test in one call", async () => {
    const { db, rpc } = client();
    const half = { title: "Half", explanation: " ", example: null };
    expect(await publishGrammar(db, { topicId: "t1", points: [{ ...point, example: " " }, half], tasks: [task] })).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("publish_homework_grammar", {
      p_topic_id: "t1",
      p_points: [{ title: "Plurals", explanation: "Add -s.", example: null }],
      p_tasks: [{ task_type: "quiz", content: task.content, order_index: 0 }],
    });
  });

  it("refuses an empty set before calling the database", async () => {
    const { db, rpc } = client();
    expect((await publishGrammar(db, { topicId: "t1", points: [], tasks: [] })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("copyGrammarFromTopic", () => {
  it("copies the rules and their test", async () => {
    const { db } = client({
      tables: {
        homework_grammar_points: { data: [{ ...point, order_index: 0 }] },
        homework_grammar_tasks: { data: [{ task_type: "quiz", content: task.content, order_index: 0 }] },
      },
    });
    expect(await copyGrammarFromTopic(db, "t9")).toEqual({ ok: true, points: [point], tasks: [task] });
  });

  it("says when there is nothing to copy", async () => {
    expect(await copyGrammarFromTopic(client().db, "t9")).toEqual({ ok: false, error: "That topic has no grammar to copy." });
  });
});
