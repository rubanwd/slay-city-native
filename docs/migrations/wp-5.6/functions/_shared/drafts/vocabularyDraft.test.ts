// The `parseGeneratedWords` describe, MOVED from
// `src/features/homework/vocabulary.test.ts` with the function it covers,
// assertion for assertion. Everything else in that file stays upstream — it
// covers `buildVocabTest`, `clampWordCount`, `normalizeWordKey` and
// `describeVocabTask`, none of which moved.

import { describe, expect, it } from "vitest";

import { parseGeneratedWords } from "./vocabularyDraft.ts";

describe("parseGeneratedWords", () => {
  it("reads a well-formed response", () => {
    const words = parseGeneratedWords({
      words: [
        {
          word: "Apple",
          transcription: "/ˈæp.əl/",
          translation: "яблуко",
          exampleSentence: "I eat an apple.",
          imagePrompt: "a red apple",
        },
      ],
    });
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe("Apple");
    expect(words[0].transcription).toBe("/ˈæp.əl/");
    expect(words[0].imagePrompt).toBe("a red apple");
  });

  it("accepts a bare array as well as a wrapped object", () => {
    const words = parseGeneratedWords([{ word: "dog", translation: "собака" }]);
    expect(words).toHaveLength(1);
  });

  it("drops entries missing a word or translation", () => {
    const words = parseGeneratedWords({
      words: [{ word: "dog" }, { translation: "собака" }, { word: "sun", translation: "сонце" }],
    });
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe("sun");
  });

  it("falls back to a derived image prompt when missing", () => {
    const [w] = parseGeneratedWords({ words: [{ word: "sun", translation: "сонце" }] });
    expect(w.imagePrompt).toContain("sun");
  });

  it("returns an empty array on junk input", () => {
    expect(parseGeneratedWords(null)).toEqual([]);
    expect(parseGeneratedWords("nope")).toEqual([]);
    expect(parseGeneratedWords({ words: "no" })).toEqual([]);
  });
});
