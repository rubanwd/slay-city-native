"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requestOpenRouterImage } from "@/features/admin/openRouterImage";
import {
  buildVocabTest,
  clampWordCount,
  normalizeWordKey,
  parseGeneratedWords,
  type VocabDraftWord,
} from "@/features/homework/vocabulary";

import { extractJson, requestOpenRouterJson } from "./openRouterChat";
import { requireTeacher } from "./requireTeacher";
import { buildVocabularyPrompt, buildWordImagePrompt } from "./vocabularyPrompt";

/** Public storage bucket for content imagery (mirrors uploadContentImage). */
const CONTENT_BUCKET = "content";

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
 * Drafts a vocabulary word set from the topic via OpenRouter. Writes nothing —
 * the words come back for the teacher to review, generate images for, and
 * publish. Gated by topic ownership.
 *
 * WP-2.3 out of scope: this call spends real money and is gated only by
 * `requireTopicAccess()` (finding F8/§6.2 in MIGRATIONS-NEEDED.md). It moves
 * behind the `draft-vocabulary` Edge Function in WP-5.6, not here — there is no
 * table write for a WP-2.3 RPC to replace.
 */
export async function generateVocabularyDraft(input: GenerateDraftInput): Promise<GenerateDraftResult> {
  const supabase = await createClient();
  const access = await requireTopicAccess(supabase, input.topicId);
  if (!access.ok) return { ok: false, error: access.error };

  const prompt = buildVocabularyPrompt({
    topicTitle: input.topicTitle,
    topicDescription: input.topicDescription,
    extraInstructions: input.extraInstructions,
    wordCount: clampWordCount(input.wordCount),
  });

  const result = await requestOpenRouterJson(prompt);
  if (!result.ok) return { ok: false, error: result.error };

  const words = parseGeneratedWords(extractJson(result.content));
  if (words.length === 0) {
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

/** Decodes a `data:` image URL into raw bytes for a server-side storage upload. */
function decodeDataUrl(dataUrl: string): { bytes: Buffer; contentType: string; ext: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
  return { bytes: Buffer.from(match[2], "base64"), contentType, ext };
}

/**
 * Uploads a generated image (as a data URL) to the public `content/homework`
 * folder from the server and returns its public URL. Uses the request-scoped
 * client so storage RLS sees the teacher/admin caller — same folder and trust
 * level as {@link uploadContentImage} on the client.
 *
 * WP-2.3 out of scope (operation W-04): a Storage object upload cannot run
 * inside a Postgres function, so this stays a direct `storage.upload()` call.
 * It moves server-side behind the OD-1 `generate-image` Edge Function in
 * WP-5.6 instead of gaining an RPC here.
 */
async function uploadWordImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dataUrl: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return { ok: false, error: "The generated image was unreadable. Try again." };

  const path = `homework/${crypto.randomUUID()}.${decoded.ext}`;
  const { error } = await supabase.storage
    .from(CONTENT_BUCKET)
    .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: false });
  if (error) return { ok: false, error: error.message };

  const { data } = supabase.storage.from(CONTENT_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/**
 * Returns a flashcard illustration URL for one word. Reads through the shared
 * `vocab_image_cache` first (unless `forceRegenerate`): a cache hit reuses an
 * already-generated image for free, which is the whole cost optimisation —
 * common vocabulary words are only ever generated once. On a miss it generates
 * with the shared image model and provider tier from `openRouterImage.ts`
 * (Gemini's flash image model on the half-price flex tier — cheaper and faster
 * in practice than gpt-5-image-mini, which billed higher and was slow, and it
 * renders clean kid-friendly illustrations), uploads to shared storage, and
 * records the URL in the cache for every future topic that uses the word.
 * Returns a public storage URL (not a data URL), so the client sets it straight
 * onto the word with no publish-time upload.
 */
export async function generateWordImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const supabase = await createClient();
  const access = await requireTopicAccess(supabase, input.topicId);
  if (!access.ok) return { ok: false, error: access.error };

  const word = String(input.word ?? "").trim();
  if (!word) return { ok: false, error: "Give the word before generating an image." };

  const key = normalizeWordKey(word);

  // Read-through cache — reuse a generated image unless a fresh one is asked for.
  if (!input.forceRegenerate && key) {
    const { data: cached } = await supabase
      .from("vocab_image_cache")
      .select("image_url")
      .eq("word_key", key)
      .maybeSingle();
    if (cached?.image_url) return { ok: true, imageUrl: cached.image_url };
  }

  const result = await requestOpenRouterImage(buildWordImagePrompt(word, input.imagePrompt));
  if (!result.ok) return { ok: false, error: result.error };

  const upload = await uploadWordImage(supabase, result.dataUrl);
  if (!upload.ok) return { ok: false, error: upload.error };

  // Populate/refresh the shared library through `cache_vocab_image`
  // (WP-2.3 W-05) instead of a direct `vocab_image_cache` upsert. Still
  // non-fatal — the teacher still gets their image; the next request just
  // regenerates.
  if (key) {
    const { error: cacheErr } = await supabase.rpc("cache_vocab_image", {
      p_word_key: key,
      p_image_url: upload.url,
    });
    if (cacheErr) console.warn("cache_vocab_image failed:", cacheErr.message);
  }

  return { ok: true, imageUrl: upload.url };
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
