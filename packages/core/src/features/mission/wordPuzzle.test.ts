import { describe, expect, it } from "vitest";

import {
  blankIndicesFor,
  isSpelledCorrectly,
  normalizeSpelling,
  scrambleWord,
  slotGroups,
} from "./wordPuzzle";

describe("scrambleWord", () => {
  it("makes one tile per letter of a single word", () => {
    expect(scrambleWord("cat")).toEqual({ letters: ["c", "a", "t"], groupSizes: [3] });
  });

  it("never makes a tile out of a space", () => {
    const { letters, groupSizes } = scrambleWord("adventure tourist");
    expect(letters.join("")).toBe("adventuretourist");
    expect(letters).not.toContain(" ");
    expect(groupSizes).toEqual([9, 7]);
  });

  it("collapses stray whitespace around and inside the answer", () => {
    expect(scrambleWord("  ice   cream \n")).toEqual({
      letters: "icecream".split(""),
      groupSizes: [3, 5],
    });
  });

  it("keeps punctuation as a visible tile", () => {
    expect(scrambleWord("it's").letters).toEqual(["i", "t", "'", "s"]);
  });

  it("handles an empty answer without producing tiles", () => {
    expect(scrambleWord("   ")).toEqual({ letters: [], groupSizes: [] });
  });
});

describe("slotGroups", () => {
  it("numbers the slots word by word", () => {
    expect(slotGroups([3, 2])).toEqual([
      [0, 1, 2],
      [3, 4],
    ]);
  });

  it("is empty for an answer with no letters", () => {
    expect(slotGroups([])).toEqual([]);
  });
});

describe("isSpelledCorrectly", () => {
  it("accepts the letters of a multi-word answer without its space", () => {
    expect(isSpelledCorrectly("adventuretourist", "adventure tourist")).toBe(true);
  });

  it("ignores case", () => {
    expect(isSpelledCorrectly("CAT", "cat")).toBe(true);
  });

  it("rejects a wrong or partial spelling", () => {
    expect(isSpelledCorrectly("act", "cat")).toBe(false);
    expect(isSpelledCorrectly("ca", "cat")).toBe(false);
    expect(isSpelledCorrectly("", "cat")).toBe(false);
  });

  it("is never satisfied by an answer with no letters", () => {
    expect(isSpelledCorrectly("", "  ")).toBe(false);
  });
});

describe("normalizeSpelling", () => {
  it("strips whitespace and case", () => {
    expect(normalizeSpelling(" Ice Cream ")).toBe("icecream");
  });
});

describe("blankIndicesFor", () => {
  it("blanks every other letter, leaving the first one visible", () => {
    expect(blankIndicesFor("cat")).toEqual([1]);
    expect(blankIndicesFor("puzzle")).toEqual([1, 3, 5]);
  });

  it("never blanks a space, so no blank is invisible", () => {
    const word = "adventure tourist";
    const blanks = blankIndicesFor(word);
    expect(blanks.map((i) => word[i])).not.toContain(" ");
    // Blanks stay every-other-*letter* across the space, not every-other-index.
    expect(blanks.map((i) => word[i]).join("")).toBe("detrtuit");
  });

  it("never blanks punctuation", () => {
    const word = "it's";
    expect(blankIndicesFor(word).map((i) => word[i])).toEqual(["t"]);
  });

  it("blanks the only letter of a one-letter word", () => {
    expect(blankIndicesFor("a")).toEqual([0]);
  });

  it("returns nothing for an answer with no letters to blank", () => {
    expect(blankIndicesFor("   ")).toEqual([]);
  });
});
