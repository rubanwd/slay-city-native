import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";
import { clampGrammarPointCount, MAX_GRAMMAR_TASKS, type GrammarDraftPoint, type GrammarDraftTask } from "@slay/core";

import { readFunctionError, type DraftGrammarRequest } from "./aiDrafting";
import { clearHomeworkGrammar, publishHomeworkGrammar } from "./guardedWrites";

export interface PublishGrammarPoint {
  title: string;
  explanation: string;
  example: string | null;
}

export type GrammarActionResult = { ok: true } | { ok: false; error: string };

/**
 * Drafts grammar points and their test through the `draft-grammar` Edge
 * Function — the native counterpart of the staged `generateGrammarDraft`. A
 * grammar test can't be built deterministically from the points, so it comes
 * from the model too. Writes nothing.
 */
export async function generateGrammarDraft(
  db: SupabaseClient<Database>,
  input: { topicId: string; extraInstructions: string | null; pointCount: number; taskCount: number }
): Promise<{ ok: true; points: GrammarDraftPoint[]; tasks: GrammarDraftTask[] } | { ok: false; error: string }> {
  const body: DraftGrammarRequest = {
    topic_id: input.topicId,
    extra_instructions: input.extraInstructions,
    point_count: clampGrammarPointCount(input.pointCount),
    task_count: Math.min(MAX_GRAMMAR_TASKS, Math.max(0, Math.round(input.taskCount))),
    act_as_teacher_id: null,
  };
  const { data, error } = await db.functions.invoke<{ points: GrammarDraftPoint[]; tasks: GrammarDraftTask[] }>("draft-grammar", { body });
  if (error) return { ok: false, error: (await readFunctionError(error)).message };

  const points = data?.points ?? [];
  if (points.length === 0) return { ok: false, error: "The AI didn't return any usable grammar points. Try again." };
  return { ok: true, points, tasks: data?.tasks ?? [] };
}

/**
 * Port of upstream's `publishGrammar`: replaces the topic's points and test in
 * one `publish_homework_grammar` transaction. The test is the reviewed draft,
 * stored as sent. Pass records are kept.
 */
export async function publishGrammar(
  db: SupabaseClient<Database>,
  input: { topicId: string; points: PublishGrammarPoint[]; tasks: GrammarDraftTask[] }
): Promise<GrammarActionResult> {
  const points = input.points
    .map((p) => ({
      title: String(p.title ?? "").trim(),
      explanation: String(p.explanation ?? "").trim(),
      example: String(p.example ?? "").trim() || null,
    }))
    .filter((p) => p.title && p.explanation);
  if (points.length === 0) return { ok: false, error: "Add at least one grammar point with an explanation before publishing." };

  return publishHomeworkGrammar(
    db,
    input.topicId,
    points,
    input.tasks.slice(0, MAX_GRAMMAR_TASKS).map((t, index) => ({ task_type: t.taskType, content: t.content, order_index: index }))
  );
}

/** Removes a topic's whole grammar set (points and test) through `clear_homework_grammar`. */
export function clearGrammar(db: SupabaseClient<Database>, topicId: string): Promise<GrammarActionResult> {
  return clearHomeworkGrammar(db, topicId);
}

/**
 * Port of upstream's `copyGrammarFromTopic`: another of this teacher's topics'
 * points *and* test — a grammar test can't be rebuilt from the points. Writes
 * nothing.
 */
export async function copyGrammarFromTopic(
  db: SupabaseClient<Database>,
  sourceTopicId: string
): Promise<{ ok: true; points: PublishGrammarPoint[]; tasks: GrammarDraftTask[] } | { ok: false; error: string }> {
  const [pointsRes, tasksRes] = await Promise.all([
    db.from("homework_grammar_points").select("title, explanation, example, order_index").eq("topic_id", sourceTopicId).order("order_index"),
    db.from("homework_grammar_tasks").select("task_type, content, order_index").eq("topic_id", sourceTopicId).order("order_index"),
  ]);
  if (pointsRes.error) return { ok: false, error: pointsRes.error.message };

  const points = (pointsRes.data ?? []).map((p) => ({ title: p.title, explanation: p.explanation, example: p.example }));
  if (points.length === 0) return { ok: false, error: "That topic has no grammar to copy." };
  const tasks = (tasksRes.data ?? []).slice(0, MAX_GRAMMAR_TASKS).map((t) => ({ taskType: t.task_type, content: t.content }));
  return { ok: true, points, tasks };
}
