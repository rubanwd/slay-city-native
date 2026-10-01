// The `parseGeneratedGrammar` describe, MOVED from
// `src/features/homework/grammar.test.ts` with the function it covers, assertion
// for assertion. The only edit is the one the move forces: the web test imported
// `GRAMMAR_TEST_TASK_TYPES` from the same module to assert every emitted task is
// in that subset, and that constant stayed upstream with `describeGrammarTask`.
// The local `GRAMMAR_TASK_TYPES` below is the same two members, which is exactly
// what `GrammarTaskType` narrows the parser to.

import { describe, expect, it } from "vitest";

import { parseGeneratedGrammar, type GrammarTaskType } from "./grammarDraft.ts";

const GRAMMAR_TASK_TYPES: GrammarTaskType[] = ["quiz", "fill_blank"];

describe("parseGeneratedGrammar", () => {
  it("reads a well-formed response with both task types", () => {
    const draft = parseGeneratedGrammar({
      points: [
        { title: "Present Simple", explanation: "Add -s for he/she/it.", example: "She runs." },
      ],
      tasks: [
        {
          type: "fill_blank",
          sentence: "She ___ to school.",
          answer: "goes",
          options: ["goes", "go", "going", "gone"],
          translation: "Вона ходить до школи.",
        },
        {
          type: "quiz",
          question: "Choose the correct form: He ___ football.",
          options: ["plays", "play", "playing"],
          correctIndex: 0,
        },
      ],
    });

    expect(draft.points).toHaveLength(1);
    expect(draft.points[0].title).toBe("Present Simple");
    expect(draft.points[0].example).toBe("She runs.");
    expect(draft.tasks).toHaveLength(2);

    const [fill, quiz] = draft.tasks;
    expect(fill.taskType).toBe("fill_blank");
    expect(quiz.taskType).toBe("quiz");
    for (const t of draft.tasks) expect(GRAMMAR_TASK_TYPES).toContain(t.taskType);
  });

  it("derives a quiz correctIndex from the answer when missing", () => {
    const draft = parseGeneratedGrammar({
      points: [{ title: "T", explanation: "E" }],
      tasks: [{ type: "quiz", question: "Q?", options: ["a", "b", "c"], answer: "b" }],
    });
    const content = draft.tasks[0].content as { correctIndex: number; options: string[] };
    expect(content.options[content.correctIndex]).toBe("b");
  });

  it("ensures the fill_blank answer is among the options", () => {
    const draft = parseGeneratedGrammar({
      points: [{ title: "T", explanation: "E" }],
      tasks: [
        { type: "fill_blank", sentence: "I ___ happy.", answer: "am", options: ["is", "are"] },
      ],
    });
    const content = draft.tasks[0].content as { options: string[]; answer: string };
    expect(content.options).toContain("am");
  });

  it("drops malformed points and tasks but keeps valid ones", () => {
    const draft = parseGeneratedGrammar({
      points: [
        { title: "ok", explanation: "yes" },
        { title: "no explanation" },
        { explanation: "no title" },
      ],
      tasks: [
        { type: "quiz", question: "only one option", options: ["a"] },
        { type: "mystery", question: "unknown type", options: ["a", "b"] },
        { type: "fill_blank", sentence: "___", answer: "x", options: ["x", "y"] },
      ],
    });
    expect(draft.points).toHaveLength(1);
    expect(draft.tasks).toHaveLength(1);
    expect(draft.tasks[0].taskType).toBe("fill_blank");
  });

  it("returns empty arrays on junk input", () => {
    expect(parseGeneratedGrammar(null)).toEqual({ points: [], tasks: [] });
    expect(parseGeneratedGrammar("nope")).toEqual({ points: [], tasks: [] });
    expect(parseGeneratedGrammar({ points: "no", tasks: "no" })).toEqual({ points: [], tasks: [] });
  });
});
