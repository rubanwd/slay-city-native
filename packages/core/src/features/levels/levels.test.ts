import { describe, expect, it } from "vitest";

import {
  DEFAULT_KNOWLEDGE_LEVEL,
  KNOWLEDGE_LEVELS,
  KNOWLEDGE_LEVEL_DESCRIPTIONS,
  KNOWLEDGE_LEVEL_LABELS,
  isKnowledgeLevel,
  knowledgeLevelLabel,
  knowledgeLevelOrder,
  nextKnowledgeLevel,
  resolveSelectableLevel,
  sortKnowledgeLevels,
} from "./levels";

describe("KNOWLEDGE_LEVELS", () => {
  it("lists the five levels in learning order", () => {
    expect(KNOWLEDGE_LEVELS).toEqual([
      "beginner",
      "elementary",
      "pre_intermediate",
      "intermediate",
      "upper_intermediate",
    ]);
  });

  it("has a label and a description for every level", () => {
    for (const level of KNOWLEDGE_LEVELS) {
      expect(KNOWLEDGE_LEVEL_LABELS[level]).toBeTruthy();
      expect(KNOWLEDGE_LEVEL_DESCRIPTIONS[level]).toBeTruthy();
    }
  });

  it("defaults to the only level with content today", () => {
    expect(DEFAULT_KNOWLEDGE_LEVEL).toBe("elementary");
  });
});

describe("isKnowledgeLevel", () => {
  it("accepts every declared level", () => {
    for (const level of KNOWLEDGE_LEVELS) {
      expect(isKnowledgeLevel(level)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isKnowledgeLevel("advanced")).toBe(false);
    expect(isKnowledgeLevel("Elementary")).toBe(false);
    expect(isKnowledgeLevel("")).toBe(false);
    expect(isKnowledgeLevel(null)).toBe(false);
    expect(isKnowledgeLevel(undefined)).toBe(false);
    expect(isKnowledgeLevel(2)).toBe(false);
  });
});

describe("knowledgeLevelLabel", () => {
  it("renders the display name of a known level", () => {
    expect(knowledgeLevelLabel("pre_intermediate")).toBe("Pre-Intermediate");
  });

  it("falls back to the raw value for unknown input", () => {
    expect(knowledgeLevelLabel("mystery")).toBe("mystery");
  });
});

describe("sortKnowledgeLevels", () => {
  it("puts levels back into learning order", () => {
    expect(sortKnowledgeLevels(["intermediate", "beginner", "elementary"])).toEqual([
      "beginner",
      "elementary",
      "intermediate",
    ]);
  });

  it("does not mutate its input", () => {
    const input = ["intermediate", "beginner"] as const;
    const copy = [...input];
    sortKnowledgeLevels(input);
    expect([...input]).toEqual(copy);
  });

  it("orders by the ladder, not alphabetically", () => {
    // "elementary" < "upper_intermediate" alphabetically too, so use a pair
    // where the two orders disagree: beginner comes first despite "b" > "a"
    // never mattering — pre_intermediate must sit before intermediate.
    expect(sortKnowledgeLevels(["intermediate", "pre_intermediate"])).toEqual([
      "pre_intermediate",
      "intermediate",
    ]);
    expect(knowledgeLevelOrder("pre_intermediate")).toBeLessThan(
      knowledgeLevelOrder("intermediate")
    );
  });
});

describe("nextKnowledgeLevel", () => {
  it("walks up the ladder one step at a time", () => {
    expect(nextKnowledgeLevel("beginner")).toBe("elementary");
    expect(nextKnowledgeLevel("elementary")).toBe("pre_intermediate");
    expect(nextKnowledgeLevel("pre_intermediate")).toBe("intermediate");
    expect(nextKnowledgeLevel("intermediate")).toBe("upper_intermediate");
  });

  it("returns null at the top", () => {
    expect(nextKnowledgeLevel("upper_intermediate")).toBeNull();
  });
});

describe("resolveSelectableLevel", () => {
  it("keeps the current level when it is still available", () => {
    expect(resolveSelectableLevel(["beginner", "elementary"], "elementary")).toBe("elementary");
  });

  it("falls back to the lowest available level when the current one is not offered", () => {
    expect(resolveSelectableLevel(["elementary", "intermediate"], "beginner")).toBe("elementary");
  });

  it("picks the lowest available level when there is no current one", () => {
    expect(resolveSelectableLevel(["intermediate", "beginner"], null)).toBe("beginner");
  });

  it("returns null when nothing is available", () => {
    expect(resolveSelectableLevel([], "elementary")).toBeNull();
    expect(resolveSelectableLevel([], null)).toBeNull();
  });
});
