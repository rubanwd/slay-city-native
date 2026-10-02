"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { buildVocabTest, clampWordCount, type VocabDraftWord } from "@/features/homework/vocabulary";
import { readFunctionError } from "@/lib/functionError";

import type {
  DraftVocabularyRequest,
  GenerateImageRequest,
  GenerateImageResponse,
} from "./aiDrafting";
import { requireTeacher } from "./requireTeacher";
import { readViewAsTeacherId } from "./viewAs";

const MAX_TASK_COUNT = 20;

/** A word as submitted for publishing — image already uploaded to storage by the client. */
export interface PublishWordInput {
  word: string;
  transcription: string | null;
  translation: string | null;
  imageUrl: string | null;
}

export type GenerateDraftResult =
  | { ok: true; words: VocabDraftWord[] }
  | { ok: false; error: string };

export type GenerateImageResult = { ok: true; imageUrl: string } | { ok: false; error: string };

export type VocabActionResult = { ok: true } | { ok: false; error: string };

/**
 * Confirms the caller is a teacher (or admin viewing-as) AND can see the topic
 * — RLS on `homework_topics` already limits SELECT to the owning teacher / an
 * admin, so a successful read is proof of ownership. Returns the topic's group
 * id (for revalidation) or an error.
 */
async function requireTopicAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  topicId: string
): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> {
  const teacher = await requireTeacher(supabase);
  if (!teacher.ok) return { ok: false, error: teacher.error };

  const { data: topic } = await supabase
    .from("homework_topics")
    .select("id, group_id")
    .eq("id", topicId)
    .maybeSingle();

  if (!topic) return { ok: false, error: "Topic not found or not yours to edit." };
  return { ok: true, groupId: topic.group_id };
}

function revalidateTopic(groupId: string, topicId: string): void {
  revalidatePath(`/teacher/groups/${groupId}/topics/${topicId}`);
  revalidatePath(`/teacher/groups/${groupId}`);
  revalidatePath("/homework", "layout");
}

/* ── AI generation (no DB writes — the teacher reviews first) ───────────────── */

export interface GenerateDraftInput {
  topicId: string;
  topicTitle: string;
  topicDescription: string | null;
  extraInstructions: string | null;
  wordCount: number;
}

/**
 * Drafts a vocabulary word set from the topic. Writes nothing — the words come
 * back for the teacher to review, generate images for, and publish.
 *
 * WP-5.6 (`OD-1`): this is now a thin caller of the `draft-vocabulary` Edge
 * Function. The exported name, `GenerateDraftInput` and `GenerateDraftResult` are
 * unchanged, so `VocabularyManager.tsx` needs no edit and the teacher-facing
 * behaviour is identical — that is the main thing to check in review.
 *
 * What moved, and why:
 *
 *   * `OPENROUTER_API_KEY` is no longer read here. It lives in Supabase Secrets
 *     and is readable only inside the function. A native teacher console cannot
 *     hold it (a key in an `.ipa`/`.aab` is extractable in minutes and bills to
 *     this account), and there is no third place to put it.
 *   * `buildVocabularyPrompt`, `requestOpenRouterJson`, `extractJson` and
 *     `parseGeneratedWords` all run inside the function now. This file no longer
 *     builds a prompt or parses a model response.
 *   * `topicTitle` / `topicDescription` are **not forwarded**. The function reads
 *     them from `homework_topics` in the same query that proves ownership, which
 *     removes a prompt-injection surface. They stay in `GenerateDraftInput` only
 *     so the manager's call site does not have to change; a later cleanup can
 *     drop them.
 *   * `requireTopicAccess()` is gone from this path. It was never a real gate —
 *     `homework_topics_select` grants `is_group_member(group_id)`, so a student in
 *     the group could pass it. The function re-checks role *and* ownership in SQL
 *     and claims rate-limit quota, all before the billed call.
 *
 * `clampWordCount` still runs here, for the same reason the function clamps
 * again: this keeps the request honest, and the function cannot trust it.
 */
export async function generateVocabularyDraft(input: GenerateDraftInput): Promise<GenerateDraftResult> {
  const supabase = await createClient();

  // The admin "view as teacher" cookie becomes an explicit request field — Deno
  // has no `next/headers` and a phone has no cookie. The function verifies the
  // caller really is an admin before honouring it, so sending it is not trust.
  const actAsTeacherId = await readViewAsTeacherId();

  const body: DraftVocabularyRequest = {
    topic_id: input.topicId,
    extra_instructions: input.extraInstructions,
    word_count: clampWordCount(input.wordCount),
    act_as_teacher_id: actAsTeacherId,
  };

  const { data, error } = await supabase.functions.invoke<{ words: VocabDraftWord[] }>(
    "draft-vocabulary",
    { body }
  );

  if (error) {
    // `invoke()` hides the function's own message inside the Response; without
    // `readFunctionError` every failure would read "Edge Function returned a
    // non-2xx status code".
    const { message } = await readFunctionError(error);
    return { ok: false, error: message };
  }

  const words = data?.words ?? [];
  if (words.length === 0) {
    // The function already returns 422 with this exact string; this covers a
    // malformed 200, which should be impossible.
    return { ok: false, error: "The AI didn't return any usable words. Try again." };
  }

  return { ok: true, words };
}

export interface GenerateImageInput {
  topicId: string;
  word: string;
  imagePrompt: string | null;
  /**
   * Skip the shared cache and generate a fresh image (used by the manual "AI"
   * button when the word already has an image — i.e. the teacher wants a
   * different one). Auto-generation leaves this off so common words reuse the
   * library for free.
   */
  forceRegenerate?: boolean;
}

/**
 * Returns a flashcard illustration URL for one word.
 *
 * WP-5.6 (`OD-1`): this is now a thin caller of the `generate-image` Edge
 * Function, the same move `generateVocabularyDraft` made. `OPENROUTER_API_KEY`
 * is no longer read here — it lives in Supabase Secrets. The function reads
 * through `vocab_image_cache` before spending anything, generates with the
 * shared image model and provider tier `openRouterImage.ts` used to configure
 * directly (Gemini's flash image model on the half-price flex tier), uploads
 * to Storage under the caller's own `homework/<teacherId>/` folder, and
 * records the URL in the cache for every future topic that uses the word.
 * `requireTopicAccess()` is gone from this path for the same reason it left
 * `generateVocabularyDraft`: it was never a real gate, and the function
 * re-checks role *and* ownership in SQL before any outbound request.
 * `normalizeWordKey` is gone from this file entirely — the function computes
 * its own cache key server-side (`supabase/functions/_shared/wordKey.ts`),
 * since the client no longer touches `vocab_image_cache` at all.
 */
export async function generateWordImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const supabase = await createClient();
  const actAsTeacherId = await readViewAsTeacherId();

  const body: GenerateImageRequest = {
    topic_id: input.topicId,
    word: input.word,
    image_prompt: input.imagePrompt,
    force_regenerate: input.forceRegenerate ?? false,
    act_as_teacher_id: actAsTeacherId,
  };

  const { data, error } = await supabase.functions.invoke<GenerateImageResponse>(
    "generate-image",
    { body }
  );

  if (error) {
    const { message } = await readFunctionError(error);
    return { ok: false, error: message };
  }

  const imageUrl = data?.image_url;
  if (!imageUrl) {
    // The function already returns a taxonomy error for every failure mode;
    // this covers a malformed 200, which should be impossible.
    return { ok: false, error: "The model did not return an image. Try regenerating." };
  }

  return { ok: true, imageUrl };
}

/* ── Publish (replace the topic's whole vocabulary set + rebuild its test) ──── */

export interface PublishVocabularyInput {
  topicId: string;
  words: PublishWordInput[];
  /** How many test tasks to build from the words. */
  taskCount: number;
  /**
   * Test variant the teacher previewed. Threaded into {@link buildVocabTest} so
   * the published test matches exactly what the teacher saw and regenerated.
   * Defaults to the canonical variant.
   */
  testSeed?: number;
}

/**
 * Replaces the topic's vocabulary words and rebuilds its test in one shot: any
 * existing words/tasks are deleted, the new words inserted, and a deterministic
 * test of `taskCount` tasks generated from them. Existing pass records are left
 * intact — a student who already passed stays passed.
 *
 * WP-2.3 W-06…W-09: the four separate round-trips this used to make (delete
 * words, delete tasks, insert words, insert tasks) are now one call to
 * `publish_homework_vocabulary`, which does the whole replace in one
 * transaction — closing the "empty topic on a failed publish" gap (finding
 * F3). `buildVocabTest` stays in TypeScript (it's a pure, seeded generator
 * shared with the native app); the function only validates the count and task
 * type of what this action already built.
 */
export async function publishVocabulary(input: PublishVocabularyInput): Promise<VocabActionResult> {
  const supabase = await createClient();
  const access = await requireTopicAccess(supabase, input.topicId);
  if (!access.ok) return { ok: false, error: access.error };

  const words = (input.words ?? [])
    .map((w) => ({
      word: String(w.word ?? "").trim(),
      transcription: String(w.transcription ?? "").trim() || null,
      translation: String(w.translation ?? "").trim(),
      imageUrl: String(w.imageUrl ?? "").trim() || null,
    }))
    .filter((w) => w.word && w.translation);

  if (words.length === 0) {
    return { ok: false, error: "Add at least one word with a translation before publishing." };
  }

  const taskCount = Math.min(MAX_TASK_COUNT, Math.max(0, Math.round(input.taskCount)));
  const tasks = buildVocabTest(
    words.map((w) => ({ word: w.word, translation: w.translation, imageUrl: w.imageUrl })),
    taskCount,
    input.testSeed ?? 0
  );

  const { error } = await supabase.rpc("publish_homework_vocabulary", {
    p_topic_id: input.topicId,
    p_words: words.map((w) => ({
      word: w.word,
      transcription: w.transcription,
      translation: w.translation,
      image_url: w.imageUrl,
    })),
    p_tasks: tasks.map((t) => ({
      task_type: t.taskType,
      content: t.content,
      order_index: t.orderIndex,
    })),
  });
  if (error) return { ok: false, error: error.message };

  revalidateTopic(access.groupId, input.topicId);
  return { ok: true };
}

/**
 * Removes a topic's entire vocabulary set (words + test).
 *
 * WP-2.3 W-10…W-11: the two direct deletes are now one call to
 * `clear_homework_vocabulary`.
 */
export async function clearVocabulary(topicId: string): Promise<VocabActionResult> {
  const supabase = await createClient();
  const access = await requireTopicAccess(supabase, topicId);
  if (!access.ok) return { ok: false, error: access.error };

  const { error } = await supabase.rpc("clear_homework_vocabulary", { p_topic_id: topicId });
  if (error) return { ok: false, error: error.message };

  revalidateTopic(access.groupId, topicId);
  return { ok: true };
}

/* ── Reuse (copy another topic's vocabulary into this one's draft) ──────────── */

export type CopyVocabularyResult =
  | { ok: true; words: PublishWordInput[]; taskCount: number }
  | { ok: false; error: string };

export interface CopyVocabularyInput {
  /** The topic being edited (target of the eventual publish). */
  topicId: string;
  /** The already-authored topic whose words are being reused. */
  sourceTopicId: string;
}

/**
 * Reads another topic's published vocabulary so the teacher can reuse it here.
 * The same topic is often taught to several groups, and re-drafting it with AI
 * every time costs time and image credits — copying reuses the exact words and
 * their (already generated) images.
 *
 * Writes nothing: the words come back into the draft list like an AI draft, so
 * the teacher can edit and only then publish. Both topics are ownership-gated,
 * so a teacher can only ever copy from their own groups.
 */
export async function copyVocabularyFromTopic(
  input: CopyVocabularyInput
): Promise<CopyVocabularyResult> {
  const supabase = await createClient();
  const target = await requireTopicAccess(supabase, input.topicId);
  if (!target.ok) return { ok: false, error: target.error };
  const source = await requireTopicAccess(supabase, input.sourceTopicId);
  if (!source.ok) return { ok: false, error: "That topic isn't yours to copy from." };

  const [wordsRes, tasksRes] = await Promise.all([
    supabase
      .from("homework_vocab_words")
      .select("word, transcription, translation, image_url, order_index")
      .eq("topic_id", input.sourceTopicId)
      .order("order_index"),
    supabase.from("homework_vocab_tasks").select("id").eq("topic_id", input.sourceTopicId),
  ]);

  const words = (wordsRes.data ?? []).map((w) => ({
    word: w.word,
    transcription: w.transcription,
    translation: w.translation,
    imageUrl: w.image_url,
  }));

  if (words.length === 0) {
    return { ok: false, error: "That topic has no vocabulary to copy." };
  }

  return { ok: true, words, taskCount: tasksRes.data?.length ?? 0 };
}
