/**
 * What `draft-vocabulary` adds to the shared gate chain in
 * `_shared/draftHandler.ts`: its ledger kind, its one extra body field, its
 * prompt builder and its parser.
 *
 * Separate from `index.ts` for the reason `update-streak/streak.ts` is separate
 * from its handler — `index.ts` calls `Deno.serve` at module scope and cannot be
 * imported under Node, while this file is pure and `index.test.ts` drives the
 * entire chain through it.
 *
 * Request (snake_case wire contract):
 *
 *   POST /functions/v1/draft-vocabulary
 *   Authorization: Bearer <user JWT>
 *   { "topic_id": uuid,
 *     "extra_instructions": string|null,
 *     "word_count": 8,
 *     "act_as_teacher_id": uuid|null }
 *
 * Response 200 (camelCase domain object the UI already renders):
 *
 *   { "words": [ { word, transcription, translation, exampleSentence, imagePrompt } ] }
 *
 * `topic_title` and `topic_description` are deliberately absent. The browser
 * sends them today and they go straight into the prompt; the function reads them
 * from `homework_topics` in the same query that proves ownership, so a forged
 * title can no longer be a forged prompt.
 */

import {
  DEFAULT_VOCAB_WORDS,
  MAX_VOCAB_WORDS,
  MIN_VOCAB_WORDS,
  parseGeneratedWords,
  type DraftVocabularyResponse,
} from "../_shared/drafts/vocabularyDraft.ts";
import { buildVocabularyPrompt } from "../_shared/prompts/vocabularyPrompt.ts";
import type { DraftSpec } from "../_shared/draftHandler.ts";
import {
  isRecord,
  parseCount,
  parseDraftBase,
  type DraftRequestBase,
  type ParseResult,
} from "../_shared/requestBody.ts";

export interface DraftVocabularyBody extends DraftRequestBase {
  wordCount: number;
}

export const draftVocabularySpec: DraftSpec<DraftVocabularyBody, DraftVocabularyResponse> = {
  kind: "draft_vocabulary",

  parseBody(raw: unknown): ParseResult<DraftVocabularyBody> {
    const base = parseDraftBase(raw);
    if (!base.ok) return { ok: false };
    if (!isRecord(raw)) return { ok: false };

    // Clamped server-side even though the UI's number input clamps the same
    // range — the function cannot trust the client (EDGE-FUNCTIONS-PLAN.md §4.5).
    const wordCount = parseCount(
      raw.word_count,
      MIN_VOCAB_WORDS,
      MAX_VOCAB_WORDS,
      DEFAULT_VOCAB_WORDS,
    );
    if (!wordCount.ok) return { ok: false };

    return { ok: true, value: { ...base.value, wordCount: wordCount.value } };
  },

  buildPrompt(body, topic) {
    return buildVocabularyPrompt({
      topicTitle: topic.title,
      topicDescription: topic.description,
      extraInstructions: body.extraInstructions,
      wordCount: body.wordCount,
    });
  },

  parseResponse(json) {
    const words = parseGeneratedWords(json);
    if (words.length === 0) {
      // Existing string, character for character.
      return { ok: false, message: "The AI didn't return any usable words. Try again." };
    }
    return { ok: true, value: { words } };
  },
};
