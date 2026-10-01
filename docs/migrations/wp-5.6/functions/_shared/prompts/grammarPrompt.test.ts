// MOVED unchanged from `src/features/teacher/grammarPrompt.test.ts` by WP-5.6,
// assertion for assertion. See `vocabularyPrompt.test.ts`'s header.

import { describe, expect, it } from "vitest";

import { buildGrammarPrompt } from "./grammarPrompt.ts";

describe("buildGrammarPrompt", () => {
  it("names the topic and requested counts", () => {
    const prompt = buildGrammarPrompt({ topicTitle: "Present Simple", pointCount: 4, taskCount: 3 });
    expect(prompt).toContain("Present Simple");
    expect(prompt).toContain("exactly 4");
    expect(prompt).toContain("exactly 3");
  });

  it("includes description and extra instructions when present", () => {
    const prompt = buildGrammarPrompt({
      topicTitle: "Past Tense",
      topicDescription: "Regular and irregular verbs",
      extraInstructions: "beginner level only",
      pointCount: 3,
      taskCount: 2,
    });
    expect(prompt).toContain("Regular and irregular verbs");
    expect(prompt).toContain("beginner level only");
  });

  it("asks for the strict JSON shape and both task types", () => {
    const prompt = buildGrammarPrompt({ topicTitle: "Articles", pointCount: 2, taskCount: 2 });
    expect(prompt).toContain('"points"');
    expect(prompt).toContain('"tasks"');
    expect(prompt).toContain("fill_blank");
    expect(prompt).toContain("quiz");
  });

  it("rounds and floors the point count to at least one", () => {
    expect(buildGrammarPrompt({ topicTitle: "X", pointCount: 0, taskCount: 0 })).toContain(
      "exactly 1",
    );
    expect(buildGrammarPrompt({ topicTitle: "X", pointCount: 3.6, taskCount: 1 })).toContain(
      "exactly 4",
    );
  });
});
