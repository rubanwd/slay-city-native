import { describe, expect, it } from "vitest";

import {
  buildVocabTest,
  clampWordCount,
  defaultTestTaskCount,
  describeVocabTask,
  MAX_VOCAB_WORDS,
  normalizeWordKey,
  parseGeneratedWords,
  VOCAB_TEST_TASK_TYPES,
} from "./vocabulary";

const WORDS = [
  { word: "apple", translation: "яблуко", exampleSentence: "I eat an apple." },
  { word: "dog", translation: "собака", exampleSentence: "The dog runs." },
  { word: "sun", translation: "сонце", exampleSentence: "The sun is hot." },
  { word: "book", translation: "книга", exampleSentence: "I read a book." },
];

describe("defaultTestTaskCount", () => {
  it("is half the word count, rounded", () => {
    expect(defaultTestTaskCount(4)).toBe(2);
    expect(defaultTestTaskCount(10)).toBe(5);
  });

  it("never returns fewer than one when there are words", () => {
    expect(defaultTestTaskCount(1)).toBe(1);
  });

  it("is zero with no words", () => {
    expect(defaultTestTaskCount(0)).toBe(0);
  });
});

describe("clampWordCount", () => {
  it("clamps into the allowed range", () => {
    expect(clampWordCount(0)).toBe(1);
    expect(clampWordCount(999)).toBe(MAX_VOCAB_WORDS);
    expect(clampWordCount(5)).toBe(5);
  });

  it("handles non-finite input", () => {
    expect(clampWordCount(Number.NaN)).toBe(1);
  });
});

describe("buildVocabTest", () => {
  it("builds exactly the requested number of tasks", () => {
    expect(buildVocabTest(WORDS, 2)).toHaveLength(2);
    expect(buildVocabTest(WORDS, 5)).toHaveLength(5);
  });

  it("returns nothing when there are no words", () => {
    expect(buildVocabTest([], 3)).toEqual([]);
  });

  it("returns nothing when count is zero", () => {
    expect(buildVocabTest(WORDS, 0)).toEqual([]);
  });

  it("only emits allowed vocab test task types", () => {
    for (const task of buildVocabTest(WORDS, 5)) {
      expect(VOCAB_TEST_TASK_TYPES).toContain(task.taskType);
    }
  });

  it("assigns sequential order indexes", () => {
    const tasks = buildVocabTest(WORDS, 3);
    expect(tasks.map((t) => t.orderIndex)).toEqual([0, 1, 2]);
  });

  it("falls back to distractor-free types with a single word", () => {
    const tasks = buildVocabTest([WORDS[0]], 3);
    expect(tasks).toHaveLength(3);
    for (const task of tasks) {
      expect(["word_scramble", "flashcards"]).toContain(task.taskType);
    }
  });

  it("produces a quiz whose correctIndex points at the real translation", () => {
    const [quiz] = buildVocabTest(WORDS, 1);
    const content = quiz.content as { options: string[]; correctIndex: number };
    expect(content.options[content.correctIndex]).toBe("яблуко");
  });

  it("blanks the word out of a fill_blank sentence", () => {
    // 4th task in the cycle is fill_blank (quiz, matching, scramble, fill_blank).
    const tasks = buildVocabTest(WORDS, 4);
    const fill = tasks.find((t) => t.taskType === "fill_blank");
    expect(fill).toBeDefined();
    const content = fill!.content as { sentence: string; answer: string };
    expect(content.sentence).toContain("____");
    expect(content.sentence.toLowerCase()).not.toContain(content.answer.toLowerCase());
  });

  it("is deterministic for the same input", () => {
    expect(buildVocabTest(WORDS, 5)).toEqual(buildVocabTest(WORDS, 5));
  });

  it("keeps the canonical output for seed 0", () => {
    expect(buildVocabTest(WORDS, 5, 0)).toEqual(buildVocabTest(WORDS, 5));
  });

  it("varies with the seed but stays valid and the same length", () => {
    const base = buildVocabTest(WORDS, 5, 0);
    const variant = buildVocabTest(WORDS, 5, 1);
    expect(variant).toHaveLength(base.length);
    expect(variant).not.toEqual(base);
    for (const task of variant) {
      expect(VOCAB_TEST_TASK_TYPES).toContain(task.taskType);
    }
    expect(variant.map((t) => t.orderIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it("is deterministic for the same seed", () => {
    expect(buildVocabTest(WORDS, 4, 3)).toEqual(buildVocabTest(WORDS, 4, 3));
  });
});

describe("describeVocabTask", () => {
  it("labels each built task and gives a non-empty detail", () => {
    for (const task of buildVocabTest(WORDS, 5)) {
      const { label, detail } = describeVocabTask(task.taskType, task.content);
      expect(label.length).toBeGreaterThan(0);
      expect(detail.length).toBeGreaterThan(0);
    }
  });

  it("reads the quiz question into the detail", () => {
    const [quiz] = buildVocabTest(WORDS, 1);
    const { label, detail } = describeVocabTask(quiz.taskType, quiz.content);
    expect(label).toBe("Quiz");
    expect(detail).toContain("apple");
  });
});

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

describe("normalizeWordKey", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(normalizeWordKey("  Cat ")).toBe("cat");
    expect(normalizeWordKey("Ice   Cream")).toBe("ice cream");
    expect(normalizeWordKey("DOG")).toBe("dog");
  });

  it("collapses casing/spacing variants to the same key", () => {
    expect(normalizeWordKey("Cat")).toBe(normalizeWordKey(" cat "));
  });

  it("is safe on empty/nullish input", () => {
    expect(normalizeWordKey("")).toBe("");
    expect(normalizeWordKey(undefined as unknown as string)).toBe("");
  });
});
