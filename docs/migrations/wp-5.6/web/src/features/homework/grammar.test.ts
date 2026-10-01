// WP-5.6: the `parseGeneratedGrammar` describe moved to
// `supabase/functions/_shared/drafts/grammarDraft.test.ts`, with the function it
// covered. Everything below is unchanged.

import { describe, expect, it } from "vitest";

import {
  clampGrammarPointCount,
  defaultGrammarTaskCount,
  describeGrammarTask,
  GRAMMAR_TEST_TASK_TYPES,
  MAX_GRAMMAR_POINTS,
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
