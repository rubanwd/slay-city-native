/**
 * Pure prompt builder for AI vocabulary generation. Kept framework-free and
 * unit-tested so the exact instructions sent to OpenRouter are verifiable
 * without a network call.
 *
 * MOVED from `src/features/teacher/vocabularyPrompt.ts` by WP-5.6, with its
 * tests, because the prompt is now built inside the Edge Function and the web's
 * Server Action is a thin caller that never sees it (EDGE-FUNCTIONS-PLAN.md §4.5
 * option (c) — copying it instead would be two divergent copies of a prompt,
 * which is the failure mode `packages/core` exists to prevent one repository
 * over). `buildWordImagePrompt` stays behind in `src/`: `generateWordImage` is
 * still a Server Action until `generate-image` is ported.
 *
 * The builder body is byte-identical to the file it came from — the prompt the
 * model receives must not change, or the drafts teachers get do.
 */

export interface VocabularyPromptInput {
  /** The homework topic title (e.g. "Animals", "At the Airport"). */
  topicTitle: string;
  /** The topic description, if the teacher wrote one. */
  topicDescription?: string | null;
  /** Optional extra guidance from the teacher (level, focus, exclusions). */
  extraInstructions?: string | null;
  /** How many words to generate. */
  wordCount: number;
}

const MAX_FIELD_LEN = 500;

function clean(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_FIELD_LEN);
}

/**
 * Builds the chat prompt that asks the model for a JSON array of vocabulary
 * words for a topic. The response contract is a strict JSON object so
 * {@link parseGeneratedWords} can read it back.
 */
export function buildVocabularyPrompt(input: VocabularyPromptInput): string {
  const title = clean(input.topicTitle);
  const description = clean(input.topicDescription);
  const extra = clean(input.extraInstructions);
  const count = Math.max(1, Math.round(input.wordCount));

  const lines: string[] = [
    `You are helping an English teacher build a vocabulary set for young learners (ages 7-14).`,
    `Topic: "${title}".`,
  ];
  if (description) lines.push(`Topic description: ${description}`);
  if (extra) lines.push(`Extra instructions from the teacher: ${extra}`);

  lines.push(
    ``,
    `Produce exactly ${count} common, topic-relevant English vocabulary words suitable for children.`,
    `For each word provide:`,
    `- "word": the English word in lowercase (single word or short phrase).`,
    `- "transcription": the IPA phonetic transcription, wrapped in slashes, e.g. "/ˈæp.əl/".`,
    `- "translation": the Ukrainian translation.`,
    `- "exampleSentence": one short, simple English example sentence that contains the word.`,
    `- "imagePrompt": a short English description of a clear, kid-friendly illustration of the word.`,
    ``,
    `Respond with ONLY a JSON object of this exact shape, no markdown, no commentary:`,
    `{"words":[{"word":"","transcription":"","translation":"","exampleSentence":"","imagePrompt":""}]}`,
  );

  return lines.join("\n");
}
