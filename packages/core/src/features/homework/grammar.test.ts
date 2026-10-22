import { describe, expect, it } from "vitest";

import {
  clampGrammarPointCount,
  defaultGrammarTaskCount,
  describeGrammarTask,
  GRAMMAR_TEST_TASK_TYPES,
  MAX_GRAMMAR_POINTS,
  parseGeneratedGrammar,
} from "./grammar";

describe("defaultGrammarTaskCount", () => {
  it("is half the point count, rounded", () => {
    expect(defaultGrammarTaskCount(4)).toBe(2);
    expect(defaultGrammarTaskCount(10)).toBe(5);
  });

  it("never returns fewer than one when there are points", () => {
    expect(defaultGrammarTaskCount(1)).toBe(1);
  });

  it("is zero with no points", () => {
    expect(defaultGrammarTaskCount(0)).toBe(0);
  });
});

describe("clampGrammarPointCount", () => {
  it("clamps into the allowed range", () => {
    expect(clampGrammarPointCount(0)).toBe(1);
    expect(clampGrammarPointCount(999)).toBe(MAX_GRAMMAR_POINTS);
    expect(clampGrammarPointCount(5)).toBe(5);
  });

  it("handles non-finite input", () => {
    expect(clampGrammarPointCount(Number.NaN)).toBe(1);
  });
});

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
    for (const t of draft.tasks) expect(GRAMMAR_TEST_TASK_TYPES).toContain(t.taskType);
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
      tasks: [{ type: "fill_blank", sentence: "I ___ happy.", answer: "am", options: ["is", "are"] }],
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

describe("describeGrammarTask", () => {
  it("labels each grammar task type", () => {
    expect(describeGrammarTask("quiz", { question: "Pick one" })).toEqual({
      label: "Quiz",
      detail: "Pick one",
    });
    expect(describeGrammarTask("fill_blank", { sentence: "I ___ home" })).toEqual({
      label: "Fill the blank",
      detail: "I ___ home",
    });
  });
});
