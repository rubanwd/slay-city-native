/**
 * Pure prompt builder for the vocabulary image model.
 *
 * WP-5.6 moved `buildVocabularyPrompt`, its `VocabularyPromptInput` and the
 * `MAX_FIELD_LEN`/`clean()` pair it shared into
 * `supabase/functions/_shared/prompts/vocabularyPrompt.ts`: the text prompt is now
 * built inside the `draft-vocabulary` Edge Function, and this file would otherwise
 * be a second copy of it (EDGE-FUNCTIONS-PLAN.md §4.5 option (c)).
 *
 * `buildWordImagePrompt` stays because `generateWordImage` is still a Server
 * Action — `generate-image` is not part of this change. When it is ported, this
 * file moves with it and disappears from `src/`.
 */

const MAX_FIELD_LEN = 500;

function clean(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_FIELD_LEN);
}

/**
 * Builds the image-model prompt for a single word's flashcard illustration —
 * a clean, bright, single-subject picture with no text (mirrors the location
 * icon style used elsewhere in the app).
 */
export function buildWordImagePrompt(word: string, imageHint?: string | null): string {
  const subject = clean(imageHint) || clean(word);
  return [
    `A bright, friendly flat-illustration of: ${subject}.`,
    `Single clear subject, centered, simple solid background, bold cartoon style for a children's English-learning app.`,
    `No text, no letters, no words in the image.`,
  ].join(" ");
}
