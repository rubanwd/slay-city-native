import { describe, expect, it } from "vitest";

import {
  closestAvailableLevel,
  parseLevelScores,
  parsePlacementResult,
  percent,
  sanitizePlacementAnswers,
  shuffledOptionOrder,
} from "./placement";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

describe("sanitizePlacementAnswers", () => {
  it("keeps uuid keys with small integer choices", () => {
    expect(sanitizePlacementAnswers({ [ID_A]: 0, [ID_B]: 3 })).toEqual({ [ID_A]: 0, [ID_B]: 3 });
  });

  it("drops non-uuid keys, non-integers and out-of-range choices", () => {
    expect(
      sanitizePlacementAnswers({
        nope: 1,
        [ID_A]: 1.5,
        [ID_B]: 6,
        "33333333-3333-4333-8333-333333333333": -1,
        "44444444-4444-4444-8444-444444444444": "2",
      })
    ).toEqual({});
  });

  it("returns an empty object for anything that isn't a plain object", () => {
    expect(sanitizePlacementAnswers(null)).toEqual({});
    expect(sanitizePlacementAnswers([1, 2])).toEqual({});
    expect(sanitizePlacementAnswers("x")).toEqual({});
  });
});

describe("parsePlacementResult", () => {
  it("narrows the RPC payload and sorts level scores into learning order", () => {
    const result = parsePlacementResult({
      attempt_id: null,
      total_correct: 19,
      total_questions: 24,
      recommended_level: "pre_intermediate",
      level_scores: [
        { level: "pre_intermediate", correct: 3, total: 8, passed: false },
        { level: "beginner", correct: 8, total: 8, passed: true },
        { level: "elementary", correct: 8, total: 8, passed: true },
      ],
    });
    expect(result).toEqual({
      totalCorrect: 19,
      totalQuestions: 24,
      recommendedLevel: "pre_intermediate",
      levelScores: [
        { level: "beginner", correct: 8, total: 8, passed: true },
        { level: "elementary", correct: 8, total: 8, passed: true },
        { level: "pre_intermediate", correct: 3, total: 8, passed: false },
      ],
    });
  });

  it("rejects payloads without a valid level or counts", () => {
    expect(parsePlacementResult(null)).toBeNull();
    expect(
      parsePlacementResult({ total_correct: 1, total_questions: 2, recommended_level: "pro" })
    ).toBeNull();
    expect(
      parsePlacementResult({ total_correct: -1, total_questions: 2, recommended_level: "beginner" })
    ).toBeNull();
  });
});

describe("parseLevelScores", () => {
  it("skips malformed entries", () => {
    expect(
      parseLevelScores([
        { level: "beginner", correct: 2, total: 0 },
        { level: "wizard", correct: 1, total: 8 },
        "junk",
        { level: "elementary", correct: 5, total: 8, passed: true },
      ])
    ).toEqual([{ level: "elementary", correct: 5, total: 8, passed: true }]);
    expect(parseLevelScores("nope")).toEqual([]);
  });
});

describe("percent", () => {
  it("rounds and clamps", () => {
    expect(percent(5, 8)).toBe(63);
    expect(percent(9, 8)).toBe(100);
    expect(percent(1, 0)).toBe(0);
  });
});

describe("closestAvailableLevel", () => {
  it("uses the recommended level when it has content", () => {
    expect(closestAvailableLevel("elementary", ["elementary", "pre_intermediate"])).toBe(
      "elementary"
    );
  });

  it("falls back to the nearest level below", () => {
    expect(
      closestAvailableLevel("upper_intermediate", ["elementary", "pre_intermediate"])
    ).toBe("pre_intermediate");
  });

  it("goes up only when nothing below has content", () => {
    expect(closestAvailableLevel("beginner", ["pre_intermediate", "elementary"])).toBe(
      "elementary"
    );
  });

  it("returns null when no level has content", () => {
    expect(closestAvailableLevel("intermediate", [])).toBeNull();
  });
});

describe("shuffledOptionOrder", () => {
  it("is a permutation of the option indices", () => {
    const order = shuffledOptionOrder(4, "seed");
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
  });

  it("is stable for the same seed", () => {
    expect(shuffledOptionOrder(4, "abc")).toEqual(shuffledOptionOrder(4, "abc"));
  });

  it("does not keep the stored order for every seed", () => {
    const identity = Array.from({ length: 50 }, (_, i) => shuffledOptionOrder(4, `q${i}`)).filter(
      (order) => order.join() === "0,1,2,3"
    );
    expect(identity.length).toBeLessThan(10);
  });
});
