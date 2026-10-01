/**
 * The `draft-vocabulary` response contract, and the defensive parser that turns
 * a model response into it.
 *
 * `parseGeneratedWords` is MOVED from `src/features/homework/vocabulary.ts`
 * (WP-5.6): the web's Server Action no longer sees a model response, so there is
 * nothing left there to parse. Everything else that file exports — `buildVocabTest`,
 * `clampWordCount`, `normalizeWordKey`, `defaultTestTaskCount` — drives the
 * browser UI, is unrelated, and stays put.
 *
 * `VocabDraftWord` is re-declared here rather than imported, because
 * `src/features/homework/vocabulary.ts` cannot be imported from Deno: it pulls in
 * `@/types/database` and `@/features/mission/types` through path aliases Deno does
 * not resolve. The web keeps its own copy of the interface (its UI is typed
 * against it); the two are structurally identical and this is a declaration, not
 * logic, so there is no behaviour to drift. `index.test.ts` pins the wire shape so
 * a change to either side has to be deliberate.
 */

/** One word as produced by the AI generator, before images are attached. */
export interface VocabDraftWord {
  word: string;
  transcription: string | null;
  translation: string;
  exampleSentence: string | null;
  /** Short prompt the image model should illustrate for this word. */
  imagePrompt: string;
}

/** The 200 body of `draft-vocabulary`. */
export interface DraftVocabularyResponse {
  words: VocabDraftWord[];
}

export const MIN_VOCAB_WORDS = 1;
export const MAX_VOCAB_WORDS = 20;
export const DEFAULT_VOCAB_WORDS = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Defensively parses the AI generator's JSON into draft words. Malformed entries
 * are dropped rather than throwing, so a partially-valid response still yields a
 * usable draft. Returns `[]` when nothing parseable is found — the handler turns
 * that into `unusable_response` (422).
 */
export function parseGeneratedWords(raw: unknown): VocabDraftWord[] {
  const list = isRecord(raw) ? raw.words : raw;
  if (!Array.isArray(list)) return [];

  const words: VocabDraftWord[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const word = asTrimmedString(entry.word);
    const translation = asTrimmedString(entry.translation);
    if (!word || !translation) continue;
    words.push({
      word,
      transcription: asTrimmedString(entry.transcription),
      translation,
      exampleSentence: asTrimmedString(
        entry.exampleSentence ?? entry.example_sentence ?? entry.example,
      ),
      imagePrompt:
        asTrimmedString(entry.imagePrompt ?? entry.image_prompt) ?? `${word}, ${translation}`,
    });
  }
  return words;
}
