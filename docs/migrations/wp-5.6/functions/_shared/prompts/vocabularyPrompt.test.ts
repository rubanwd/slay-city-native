// MOVED from `src/features/teacher/vocabularyPrompt.test.ts`: `buildVocabularyPrompt`
// and `extractJson` by WP-5.6, `buildWordImagePrompt` by `generate-image`'s
// implementation. Every describe arrives here assertion for assertion — if any
// of them had to change, the prompt or the extractor changed too, and that is a
// behaviour change hiding inside a move.

import { describe, expect, it } from "vitest";

import { extractJson } from "../openrouter.ts";

import { buildVocabularyPrompt, buildWordImagePrompt } from "./vocabularyPrompt.ts";

describe("buildVocabularyPrompt", () => {
  it("names the topic and requested count", () => {
    const prompt = buildVocabularyPrompt({ topicTitle: "Animals", wordCount: 6 });
    expect(prompt).toContain("Animals");
    expect(prompt).toContain("exactly 6");
  });

  it("includes description and extra instructions when present", () => {
    const prompt = buildVocabularyPrompt({
      topicTitle: "Food",
      topicDescription: "Fruits and vegetables",
      extraInstructions: "beginner level only",
      wordCount: 4,
    });
    expect(prompt).toContain("Fruits and vegetables");
    expect(prompt).toContain("beginner level only");
  });

  it("asks for the strict JSON shape and IPA transcription", () => {
    const prompt = buildVocabularyPrompt({ topicTitle: "Colors", wordCount: 3 });
    expect(prompt).toContain('"words"');
    expect(prompt).toContain("transcription");
    expect(prompt).toContain("IPA");
  });

  it("rounds and floors the word count to at least one", () => {
    expect(buildVocabularyPrompt({ topicTitle: "X", wordCount: 0 })).toContain("exactly 1");
    expect(buildVocabularyPrompt({ topicTitle: "X", wordCount: 3.6 })).toContain("exactly 4");
  });
});

describe("buildWordImagePrompt", () => {
  it("uses the image hint when provided", () => {
    expect(buildWordImagePrompt("apple", "a shiny red apple")).toContain("a shiny red apple");
  });

  it("falls back to the word", () => {
    expect(buildWordImagePrompt("apple")).toContain("apple");
  });

  it("forbids text in the illustration", () => {
    expect(buildWordImagePrompt("dog")).toContain("No text");
  });
});

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON inside code fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses JSON with surrounding prose", () => {
    expect(extractJson('Here you go: {"a":1} enjoy')).toEqual({ a: 1 });
  });

  it("returns null on unparseable input", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("{broken")).toBeNull();
  });
});
