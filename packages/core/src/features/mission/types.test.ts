import { describe, expect, it } from "vitest";

import {
  parseCrosswordContent,
  parseFillBlankContent,
  parseFlashcardsContent,
  parseMatchingContent,
  parseMemoryCardsContent,
  parseStorySequencingContent,
  parseWordSearchContent,
} from "./types";

/**
 * These cover the guarantees the task components rely on to be finishable at
 * all: authored content is untrusted JSONB, and a parser that passes a
 * contradiction through leaves the student on a task they cannot complete.
 */

describe("parseMatchingContent", () => {
  it("numbers pairs itself, so duplicate authored ids can't collide", () => {
    const parsed = parseMatchingContent({
      prompt: "Match",
      pairs: [
        { id: "same", word: "Cat", match: "кіт" },
        { id: "same", word: "Dog", match: "собака" },
      ],
    });
    expect(parsed?.pairs.map((p) => p.id)).toEqual(["0", "1"]);
  });
});

describe("parseMemoryCardsContent", () => {
  it("numbers pairs itself", () => {
    const parsed = parseMemoryCardsContent({
      pairs: [
        { id: "x", word: "Sun", match: "сонце" },
        { id: "x", word: "Moon", match: "місяць" },
      ],
    });
    expect(parsed?.pairs.map((p) => p.id)).toEqual(["0", "1"]);
  });
});

describe("parseFlashcardsContent / parseStorySequencingContent", () => {
  it("gives every card and step a unique id", () => {
    const cards = parseFlashcardsContent({
      cards: [
        { id: "1", front: "a", back: "b" },
        { id: "1", front: "c", back: "d" },
      ],
    });
    expect(cards?.cards.map((c) => c.id)).toEqual(["0", "1"]);

    const steps = parseStorySequencingContent({
      steps: [
        { id: "s", text: "First" },
        { id: "s", text: "Then" },
      ],
    });
    expect(steps?.steps.map((s) => s.id)).toEqual(["0", "1"]);
  });
});

describe("parseFillBlankContent", () => {
  it("slots the answer into options that left it out", () => {
    const parsed = parseFillBlankContent({
      sentence: "I see the ____.",
      answer: "cat",
      options: ["dog", "bird", "fish"],
    });
    expect(parsed?.options).toContain("cat");
    expect(parsed?.options).toHaveLength(4);
  });

  it("leaves options that already hold the answer alone, whatever the case", () => {
    const parsed = parseFillBlankContent({
      sentence: "I see the ____.",
      answer: "cat",
      options: ["Cat", "dog"],
    });
    expect(parsed?.options).toEqual(["Cat", "dog"]);
  });

  it("keeps a typed-answer task (fewer than two options) as typed", () => {
    const parsed = parseFillBlankContent({ sentence: "___", answer: "cat", options: [] });
    expect(parsed?.options).toEqual([]);
  });
});

describe("parseWordSearchContent", () => {
  it("drops repeated words, which could never all be crossed off", () => {
    const parsed = parseWordSearchContent({ words: ["CAT", "cat", "DOG"], size: 6 });
    expect(parsed?.words).toEqual(["CAT", "DOG"]);
  });
});

describe("parseCrosswordContent", () => {
  it("drops an entry placed far outside a playable grid", () => {
    const parsed = parseCrosswordContent({
      entries: [
        { answer: "CAT", clue: "Pet", row: 0, col: 0, direction: "across" },
        { answer: "DOG", clue: "Pet", row: 900, col: 0, direction: "across" },
      ],
    });
    expect(parsed?.entries.map((e) => e.answer)).toEqual(["CAT"]);
  });

  it("drops a crossing whose letter contradicts one already placed", () => {
    const parsed = parseCrosswordContent({
      entries: [
        { answer: "CAT", clue: "Pet", row: 0, col: 0, direction: "across" },
        // Would need a D where the CAT above puts an A.
        { answer: "DOG", clue: "Pet", row: 0, col: 1, direction: "down" },
      ],
    });
    expect(parsed?.entries.map((e) => e.answer)).toEqual(["CAT"]);
  });

  it("keeps a crossing that agrees", () => {
    const parsed = parseCrosswordContent({
      entries: [
        { answer: "CAT", clue: "Pet", row: 0, col: 0, direction: "across" },
        { answer: "ANT", clue: "Bug", row: 0, col: 1, direction: "down" },
      ],
    });
    expect(parsed?.entries).toHaveLength(2);
  });

  it("returns null when nothing survives", () => {
    expect(parseCrosswordContent({ entries: [{ answer: "A", clue: "letter", row: 0, col: 0 }] })).toBeNull();
  });
});
