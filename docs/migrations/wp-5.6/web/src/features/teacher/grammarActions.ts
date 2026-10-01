"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  clampGrammarPointCount,
  MAX_GRAMMAR_TASKS,
  type GrammarDraftPoint,
  type GrammarDraftTask,
} from "@/features/homework/grammar";
import { readFunctionError } from "@/lib/functionError";

import type { DraftGrammarRequest } from "./aiDrafting";
import { requireTeacher } from "./requireTeacher";
import { readViewAsTeacherId } from "./viewAs";

/** A grammar point as submitted for publishing. */
export interface PublishGrammarPoint {
  title: string;
  explanation: string;
  example: string | null;
}

export type GenerateGrammarResult =
  | { ok: true; points: GrammarDraftPoint[]; tasks: GrammarDraftTask[] }
  | { ok: false; error: string };

export type GrammarActionResult = { ok: true } | { ok: false; error: string };

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

export interface GenerateGrammarInput {
  topicId: string;
  topicTitle: string;
  topicDescription: string | null;
  extraInstructions: string | null;
  pointCount: number;
  taskCount: number;
}

/**
 * Drafts a grammar set (rule points + a test) from the topic. Writes nothing —
 * the draft comes back for the teacher to review, edit and publish.
 *
 * WP-5.6 (`OD-1`): a thin caller of the `draft-grammar` Edge Function. Same
 * exported name, same `GenerateGrammarInput`, same `GenerateGrammarResult`, so
 * `GrammarManager.tsx` is untouched — including `handleRegenerateTest()`, which
 * makes a second identical call and keeps only `tasks`. See the long note on
 * `generateVocabularyDraft` in `vocabularyActions.ts` for why the OpenRouter call
 * moved and which authorization gap the move closes; this function is the same
 * change with the grammar prompt and parser.
 *
 * `buildGrammarPrompt` and `parseGeneratedGrammar` now live in
 * `supabase/functions/_shared/`. `topicTitle` / `topicDescription` are not
 * forwarded: the function reads them from `homework_topics` itself.
 */
export async function generateGrammarDraft(input: GenerateGrammarInput): Promise<GenerateGrammarResult> {
  const supabase = await createClient();

  const actAsTeacherId = await readViewAsTeacherId();

  const body: DraftGrammarRequest = {
    topic_id: input.topicId,
    extra_instructions: input.extraInstructions,
    point_count: clampGrammarPointCount(input.pointCount),
    task_count: Math.min(MAX_GRAMMAR_TASKS, Math.max(0, Math.round(input.taskCount))),
    act_as_teacher_id: actAsTeacherId,
  };

  const { data, error } = await supabase.functions.invoke<{
    points: GrammarDraftPoint[];
    tasks: GrammarDraftTask[];
  }>("draft-grammar", { body });

  if (error) {
    const { message } = await readFunctionError(error);
    return { ok: false, error: message };
  }

  const points = data?.points ?? [];
  if (points.length === 0) {
    return { ok: false, error: "The AI didn't return any usable grammar points. Try again." };
  }

  // `tasks: []` with non-empty points is a success, not an error — unchanged from
  // today, and the manager renders rule cards with no test.
  return { ok: true, points, tasks: data?.tasks ?? [] };
}

/* ── Publish (replace the topic's whole grammar set + its test) ─────────────── */

export interface PublishGrammarInput {
  topicId: string;
  points: PublishGrammarPoint[];
  tasks: GrammarDraftTask[];
}

/**
 * Replaces the topic's grammar points and test in one shot: any existing
 * points/tasks are deleted, then the new ones inserted. The test tasks come
 * straight from the reviewed AI draft (grammar can't be built deterministically
 * the way the vocabulary test is). Existing pass records are left intact.
 *
 * WP-2.3 W-12…W-15: the four direct writes are now one call to
 * `publish_homework_grammar`, atomic like its vocabulary counterpart.
 */
export async function publishGrammar(input: PublishGrammarInput): Promise<GrammarActionResult> {
  const supabase = await createClient();
  const access = await requireTopicAccess(supabase, input.topicId);
  if (!access.ok) return { ok: false, error: access.error };

  const points = (input.points ?? [])
    .map((p) => ({
      title: String(p.title ?? "").trim(),
      explanation: String(p.explanation ?? "").trim(),
      example: String(p.example ?? "").trim() || null,
    }))
    .filter((p) => p.title && p.explanation);

  if (points.length === 0) {
    return { ok: false, error: "Add at least one grammar point with an explanation before publishing." };
  }

  const tasks = (input.tasks ?? []).slice(0, MAX_GRAMMAR_TASKS);

  const { error } = await supabase.rpc("publish_homework_grammar", {
    p_topic_id: input.topicId,
    p_points: points,
    p_tasks: tasks.map((t, index) => ({
      task_type: t.taskType,
      content: t.content,
      order_index: index,
    })),
  });
  if (error) return { ok: false, error: error.message };

  revalidateTopic(access.groupId, input.topicId);
  return { ok: true };
}

/**
 * Removes a topic's entire grammar set (points + test).
 *
 * WP-2.3 W-16…W-17: the two direct deletes are now one call to
 * `clear_homework_grammar`.
 */
export async function clearGrammar(topicId: string): Promise<GrammarActionResult> {
  const supabase = await createClient();
  const access = await requireTopicAccess(supabase, topicId);
  if (!access.ok) return { ok: false, error: access.error };

  const { error } = await supabase.rpc("clear_homework_grammar", { p_topic_id: topicId });
  if (error) return { ok: false, error: error.message };

  revalidateTopic(access.groupId, topicId);
  return { ok: true };
}

/* ── Reuse (copy another topic's grammar into this one's draft) ─────────────── */

export type CopyGrammarResult =
  | { ok: true; points: PublishGrammarPoint[]; tasks: GrammarDraftTask[] }
  | { ok: false; error: string };

export interface CopyGrammarInput {
  /** The topic being edited (target of the eventual publish). */
  topicId: string;
  /** The already-authored topic whose grammar set is being reused. */
  sourceTopicId: string;
}

/**
 * Reads another topic's published grammar set so the teacher can reuse it here
 * — the sibling of {@link copyVocabularyFromTopic}. The test tasks are copied
 * along with the rule points, because a grammar test can't be rebuilt from the
 * points the way the vocabulary test can.
 *
 * Writes nothing: the draft comes back for review and only Publish persists it.
 * Both topics are ownership-gated, so only the teacher's own groups are
 * reachable as sources.
 */
export async function copyGrammarFromTopic(input: CopyGrammarInput): Promise<CopyGrammarResult> {
  const supabase = await createClient();
  const target = await requireTopicAccess(supabase, input.topicId);
  if (!target.ok) return { ok: false, error: target.error };
  const source = await requireTopicAccess(supabase, input.sourceTopicId);
  if (!source.ok) return { ok: false, error: "That topic isn't yours to copy from." };

  const [pointsRes, tasksRes] = await Promise.all([
    supabase
      .from("homework_grammar_points")
      .select("title, explanation, example, order_index")
      .eq("topic_id", input.sourceTopicId)
      .order("order_index"),
    supabase
      .from("homework_grammar_tasks")
      .select("task_type, content, order_index")
      .eq("topic_id", input.sourceTopicId)
      .order("order_index"),
  ]);

  const points = (pointsRes.data ?? []).map((p) => ({
    title: p.title,
    explanation: p.explanation,
    example: p.example,
  }));

  if (points.length === 0) {
    return { ok: false, error: "That topic has no grammar to copy." };
  }

  const tasks: GrammarDraftTask[] = (tasksRes.data ?? [])
    .slice(0, MAX_GRAMMAR_TASKS)
    .map((t) => ({ taskType: t.task_type, content: t.content }));

  return { ok: true, points, tasks };
}
