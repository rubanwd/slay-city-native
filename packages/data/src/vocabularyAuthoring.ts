import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";
import { buildVocabTest, clampWordCount, type VocabDraftWord } from "@slay/core";

import { readFunctionError, type DraftVocabularyRequest, type GenerateImageRequest, type GenerateImageResponse } from "./aiDrafting";
import { clearHomeworkVocabulary, publishHomeworkVocabulary } from "./guardedWrites";

/** Upstream's cap on a vocabulary test's size. */
const MAX_TASK_COUNT = 20;

/** A word as published — its image already in Storage. */
export interface PublishWordInput {
  word: string;
  transcription: string | null;
  translation: string | null;
  imageUrl: string | null;
}

export type VocabActionResult = { ok: true } | { ok: false; error: string };

/**
 * Drafts a word set for a topic through the `draft-vocabulary` Edge Function —
 * the native counterpart of the staged `generateVocabularyDraft` thin caller.
 * Writes nothing: the words come back for the teacher to review. The function
 * reads the topic's title and description itself, in the same query that
 * proves ownership.
 */
export async function generateVocabularyDraft(
  db: SupabaseClient<Database>,
  input: { topicId: string; extraInstructions: string | null; wordCount: number }
): Promise<{ ok: true; words: VocabDraftWord[] } | { ok: false; error: string }> {
  const body: DraftVocabularyRequest = {
    topic_id: input.topicId,
    extra_instructions: input.extraInstructions,
    word_count: clampWordCount(input.wordCount),
    act_as_teacher_id: null,
  };
  const { data, error } = await db.functions.invoke<{ words: VocabDraftWord[] }>("draft-vocabulary", { body });
  if (error) return { ok: false, error: (await readFunctionError(error)).message };

  const words = data?.words ?? [];
  if (words.length === 0) return { ok: false, error: "The AI didn't return any usable words. Try again." };
  return { ok: true, words };
}

/**
 * A flashcard illustration for one word, through the `generate-image` Edge
 * Function (the staged `generateWordImage`). The function reads the shared
 * image cache first and uploads to Storage itself; `forceRegenerate` skips the
 * cache when the teacher wants a different picture.
 */
export async function generateWordImage(
  db: SupabaseClient<Database>,
  input: { topicId: string; word: string; imagePrompt: string | null; forceRegenerate?: boolean }
): Promise<{ ok: true; imageUrl: string } | { ok: false; error: string }> {
  const body: GenerateImageRequest = {
    topic_id: input.topicId,
    word: input.word,
    image_prompt: input.imagePrompt,
    force_regenerate: input.forceRegenerate ?? false,
    act_as_teacher_id: null,
  };
  const { data, error } = await db.functions.invoke<GenerateImageResponse>("generate-image", { body });
  if (error) return { ok: false, error: (await readFunctionError(error)).message };
  if (!data?.image_url) return { ok: false, error: "The model did not return an image. Try regenerating." };
  return { ok: true, imageUrl: data.image_url };
}

/**
 * Port of upstream's `publishVocabulary`: replaces the topic's words and
 * rebuilds its test in one `publish_homework_vocabulary` transaction. The test
 * is core's seeded `buildVocabTest`, so it is exactly the one the teacher
 * previewed. Pass records are kept.
 */
export async function publishVocabulary(
  db: SupabaseClient<Database>,
  input: { topicId: string; words: PublishWordInput[]; taskCount: number; testSeed?: number }
): Promise<VocabActionResult> {
  const words = input.words
    .map((w) => ({
      word: String(w.word ?? "").trim(),
      transcription: String(w.transcription ?? "").trim() || null,
      translation: String(w.translation ?? "").trim(),
      imageUrl: String(w.imageUrl ?? "").trim() || null,
    }))
    .filter((w) => w.word && w.translation);
  if (words.length === 0) return { ok: false, error: "Add at least one word with a translation before publishing." };

  const taskCount = Math.min(MAX_TASK_COUNT, Math.max(0, Math.round(input.taskCount)));
  const tasks = buildVocabTest(
    words.map((w) => ({ word: w.word, translation: w.translation, imageUrl: w.imageUrl })),
    taskCount,
    input.testSeed ?? 0
  );

  return publishHomeworkVocabulary(
    db,
    input.topicId,
    words.map((w) => ({ word: w.word, transcription: w.transcription, translation: w.translation, image_url: w.imageUrl })),
    tasks.map((t) => ({ task_type: t.taskType, content: t.content, order_index: t.orderIndex }))
  );
}

/** Removes a topic's whole vocabulary set (words and test) through `clear_homework_vocabulary`. */
export function clearVocabulary(db: SupabaseClient<Database>, topicId: string): Promise<VocabActionResult> {
  return clearHomeworkVocabulary(db, topicId);
}

/**
 * Port of upstream's `copyVocabularyFromTopic`: another of this teacher's
 * topics' published words and test size, for the draft. Writes nothing. RLS on
 * the vocabulary tables only shows a teacher their own groups' topics, so a
 * foreign topic reads as empty.
 */
export async function copyVocabularyFromTopic(
  db: SupabaseClient<Database>,
  sourceTopicId: string
): Promise<{ ok: true; words: PublishWordInput[]; taskCount: number } | { ok: false; error: string }> {
  const [wordsRes, tasksRes] = await Promise.all([
    db
      .from("homework_vocab_words")
      .select("word, transcription, translation, image_url, order_index")
      .eq("topic_id", sourceTopicId)
      .order("order_index"),
    db.from("homework_vocab_tasks").select("id").eq("topic_id", sourceTopicId),
  ]);
  if (wordsRes.error) return { ok: false, error: wordsRes.error.message };

  const words = (wordsRes.data ?? []).map((w) => ({
    word: w.word,
    transcription: w.transcription,
    translation: w.translation,
    imageUrl: w.image_url,
  }));
  if (words.length === 0) return { ok: false, error: "That topic has no vocabulary to copy." };
  return { ok: true, words, taskCount: tasksRes.data?.length ?? 0 };
}
