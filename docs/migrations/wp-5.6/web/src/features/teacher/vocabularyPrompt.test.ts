// WP-5.6: the `buildVocabularyPrompt` and `extractJson` describes moved to
// `supabase/functions/_shared/prompts/vocabularyPrompt.test.ts`, with the code
// they covered. `buildWordImagePrompt` is still a Server Action concern until
// `generate-image` is ported, so its describe stays here, unchanged.

import { describe, expect, it } from "vitest";

import { buildWordImagePrompt } from "./vocabularyPrompt";

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

