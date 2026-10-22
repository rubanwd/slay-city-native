import type { Json } from "@/types/database";
import type { MissionTaskType } from "@/features/mission/types";

/**
 * Shared, framework-free domain logic for the homework vocabulary flow —
 * imported by both the teacher (authoring/AI) and student (learning) sides, and
 * by the server actions. Keep it free of any `"use client"`/`"use server"`
 * directive and of Supabase/React imports so it stays unit-testable and usable
 * on either side of the network boundary.
 */

/** One vocabulary word the student learns as a flashcard. */
export interface HomeworkWord {
  id: string;
  word: string;
  transcription: string | null;
  translation: string;
  imageUrl: string | null;
  orderIndex: number;
}

/** A single test task attached to a topic's vocabulary set. */
export interface HomeworkVocabTask {
  id: string;
  taskType: MissionTaskType;
  orderIndex: number;
  content: Json;
}

/* ── AI draft shapes (pre-publish, held in client state) ───────────────────── */

/** A word as produced by the AI generator, before images are attached/uploaded. */
export interface VocabDraftWord {
  word: string;
  transcription: string | null;
  translation: string;
  exampleSentence: string | null;
  /** Short prompt the image model should illustrate for this word. */
  imagePrompt: string;
  /** Generated preview image (data URL) once the teacher generates one. */
  imageDataUrl?: string | null;
}

/** The complete AI generation result the teacher reviews before publishing. */
export interface VocabularyDraft {
  words: VocabDraftWord[];
}

/* ── Counts ────────────────────────────────────────────────────────────────── */

export const MAX_VOCAB_WORDS = 20;
export const MIN_VOCAB_WORDS = 1;

/**
 * Default number of test tasks for a word set: "half the number of words",
 * rounded, never fewer than one when there is at least one word.
 */
export function defaultTestTaskCount(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.max(1, Math.round(wordCount / 2));
}

/** Clamp a requested word count into the allowed range. */
export function clampWordCount(requested: number): number {
  if (!Number.isFinite(requested)) return MIN_VOCAB_WORDS;
  return Math.min(MAX_VOCAB_WORDS, Math.max(MIN_VOCAB_WORDS, Math.round(requested)));
}

/**
 * Cache key for the shared vocabulary image library: a word's canonical form,
 * so "Cat", " cat " and "cat" all reuse one generated image. Lowercased,
 * Unicode-normalized, inner whitespace collapsed, trimmed. Used as the primary
 * key of `vocab_image_cache` — keep it stable, changing it orphans the cache.
 */
export function normalizeWordKey(word: string): string {
  return String(word ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/* ── Deterministic test builder ────────────────────────────────────────────── */

/**
 * The task types the vocabulary test is built from. Deliberately a small,
 * self-contained subset of the full catalog — each only needs the words and
 * translations, so a generated test is always valid and renderable by
 * `TaskRunner`, regardless of the AI's output.
 */
export const VOCAB_TEST_TASK_TYPES: MissionTaskType[] = [
  "quiz",
  "matching",
  "word_scramble",
  "fill_blank",
  "flashcards",
];

interface TestSourceWord {
  word: string;
  translation: string;
  exampleSentence?: string | null;
  imageUrl?: string | null;
}

function shuffleDeterministic<T>(items: T[], seed: number): T[] {
  // Small LCG so a given (items, seed) always shuffles the same way — keeps the
  // builder pure and its tests stable.
  const out = [...items];
  let state = (seed * 9301 + 49297) % 233280 || 1;
  const rand = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickDistractors(
  words: TestSourceWord[],
  exceptIndex: number,
  field: "translation" | "word",
  max: number
): string[] {
  const pool = words
    .map((w, i) => ({ value: w[field], i }))
    .filter((entry) => entry.i !== exceptIndex && entry.value.trim().length > 0);
  return shuffleDeterministic(pool, exceptIndex + 1)
    .slice(0, max)
    .map((entry) => entry.value);
}

function buildQuiz(words: TestSourceWord[], index: number): { taskType: MissionTaskType; content: Json } {
  const target = words[index];
  const distractors = pickDistractors(words, index, "translation", 3);
  const options = shuffleDeterministic([target.translation, ...distractors], index + 7);
  return {
    taskType: "quiz",
    content: {
      question: `What does "${target.word}" mean?`,
      imageUrl: target.imageUrl ?? null,
      options,
      correctIndex: options.indexOf(target.translation),
    } satisfies Record<string, Json>,
  };
}

function buildMatching(words: TestSourceWord[], index: number): { taskType: MissionTaskType; content: Json } {
  const chosen = shuffleDeterministic(words, index + 3).slice(0, Math.min(4, words.length));
  return {
    taskType: "matching",
    content: {
      prompt: "Match each word to its meaning",
      mode: "word-to-translation",
      pairs: chosen.map((w, i) => ({ id: String(i), word: w.word, match: w.translation })),
    } satisfies Record<string, Json>,
  };
}

function buildWordScramble(words: TestSourceWord[], index: number): { taskType: MissionTaskType; content: Json } {
  const target = words[index];
  return {
    taskType: "word_scramble",
    content: {
      word: target.word,
      translation: target.translation,
      hint: target.translation,
      imageUrl: target.imageUrl ?? null,
    } satisfies Record<string, Json>,
  };
}

function blankOutWord(sentence: string, word: string): string | null {
  const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (!pattern.test(sentence)) return null;
  return sentence.replace(pattern, "____");
}

function buildFillBlank(words: TestSourceWord[], index: number): { taskType: MissionTaskType; content: Json } {
  const target = words[index];
  const example = target.exampleSentence?.trim();
  const sentence =
    (example && blankOutWord(example, target.word)) ?? `I can see the ____. (${target.translation})`;
  const distractors = pickDistractors(words, index, "word", 3);
  const options = shuffleDeterministic([target.word, ...distractors], index + 11);
  return {
    taskType: "fill_blank",
    content: {
      sentence,
      answer: target.word,
      options: options.length >= 2 ? options : [],
      translation: target.translation,
    } satisfies Record<string, Json>,
  };
}

function buildFlashcards(words: TestSourceWord[], index: number): { taskType: MissionTaskType; content: Json } {
  const chosen = shuffleDeterministic(words, index + 5).slice(0, Math.min(6, words.length));
  return {
    taskType: "flashcards",
    content: {
      prompt: "Flip each card to review",
      cards: chosen.map((w, i) => ({
        id: String(i),
        front: w.word,
        back: w.translation,
        imageUrl: w.imageUrl ?? null,
      })),
    } satisfies Record<string, Json>,
  };
}

/**
 * Builds a deterministic, always-valid test of `count` tasks from a topic's
 * words, cycling through the allowed task types. Task types that need
 * distractors (quiz, fill_blank) are only used when there are at least two
 * words; with a single word the test falls back to scramble/flashcards.
 *
 * `seed` shifts which task type and word each slot uses (and the internal
 * shuffles), so "regenerate" can produce a different — but equally valid —
 * test from the same words. `seed = 0` (the default) keeps the canonical
 * output, so persisted tests and the builder's tests stay stable.
 *
 * Returns `{ taskType, content, orderIndex }[]` ready to insert into
 * `homework_vocab_tasks`.
 */
export function buildVocabTest(
  words: TestSourceWord[],
  count: number,
  seed = 0
): { taskType: MissionTaskType; content: Json; orderIndex: number }[] {
  const usable = words.filter((w) => w.word.trim() && w.translation.trim());
  if (usable.length === 0 || count <= 0) return [];

  const hasDistractors = usable.length >= 2;
  const builders: ((words: TestSourceWord[], index: number) => { taskType: MissionTaskType; content: Json })[] =
    hasDistractors
      ? [buildQuiz, buildMatching, buildWordScramble, buildFillBlank, buildFlashcards]
      : [buildWordScramble, buildFlashcards];

  const offset = ((Math.trunc(seed) % 1000) + 1000) % 1000;
  const tasks: { taskType: MissionTaskType; content: Json; orderIndex: number }[] = [];
  for (let i = 0; i < count; i++) {
    const builder = builders[(i + offset) % builders.length];
    // The builder uses its index arg as both the word picked and the shuffle
    // seed, so offsetting it varies the whole task with the seed.
    const wordIndex = (i + offset) % usable.length;
    const { taskType, content } = builder(usable, wordIndex);
    tasks.push({ taskType, content, orderIndex: i });
  }
  return tasks;
}

/** Human-facing label + one-line detail for a built test task, for previews. */
export function describeVocabTask(taskType: MissionTaskType, content: Json): { label: string; detail: string } {
  const c = isRecord(content) ? content : {};
  switch (taskType) {
    case "quiz":
      return { label: "Quiz", detail: asTrimmedString(c.question) ?? "Pick the right meaning" };
    case "matching": {
      const pairs = Array.isArray(c.pairs) ? c.pairs.length : 0;
      return { label: "Matching", detail: `Match ${pairs} word${pairs === 1 ? "" : "s"} to meanings` };
    }
    case "word_scramble":
      return { label: "Word scramble", detail: `Unscramble "${asTrimmedString(c.word) ?? "the word"}"` };
    case "fill_blank":
      return { label: "Fill the blank", detail: asTrimmedString(c.sentence) ?? "Complete the sentence" };
    case "flashcards": {
      const cards = Array.isArray(c.cards) ? c.cards.length : 0;
      return { label: "Flashcards", detail: `Review ${cards} card${cards === 1 ? "" : "s"}` };
    }
    default:
      return { label: taskType, detail: "" };
  }
}

/* ── AI response parsing ───────────────────────────────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Defensively parses the AI generator's JSON into draft words. Malformed
 * entries are dropped rather than throwing, so a partially-valid response still
 * yields a usable draft. Returns `[]` when nothing parseable is found.
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
      exampleSentence: asTrimmedString(entry.exampleSentence ?? entry.example_sentence ?? entry.example),
      imagePrompt: asTrimmedString(entry.imagePrompt ?? entry.image_prompt) ?? `${word}, ${translation}`,
    });
  }
  return words;
}
