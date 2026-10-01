import type { Json } from "@/types/database";
import type { MissionTaskType } from "@/features/mission/types";

/**
 * Shared, framework-free domain logic for the homework grammar flow — the
 * sibling of `vocabulary.ts`. Imported by both the teacher (authoring/AI) and
 * student (learning) sides, and by the server actions. Keep it free of any
 * `"use client"`/`"use server"` directive and of Supabase/React imports so it
 * stays unit-testable and usable on either side of the network boundary.
 *
 * A grammar module for a topic is a set of rule "points" (a title, a short
 * explanation, an example sentence) the student studies as cards, plus a short
 * test whose questions are authored by the AI — grammar can't be built
 * deterministically from a word list the way the vocabulary test is, so the
 * generator returns the questions directly.
 */

/** One grammar rule the student studies as a card. */
export interface HomeworkGrammarPoint {
  id: string;
  title: string;
  explanation: string;
  example: string | null;
  orderIndex: number;
}

/** A single test task attached to a topic's grammar set. */
export interface HomeworkGrammarTask {
  id: string;
  taskType: MissionTaskType;
  orderIndex: number;
  content: Json;
}

/* ── AI draft shapes (pre-publish, held in client state) ───────────────────── */

/** A grammar point as produced by the AI generator, before publishing. */
export interface GrammarDraftPoint {
  title: string;
  explanation: string;
  example: string | null;
}

/** A generated test task the teacher reviews before publishing. */
export interface GrammarDraftTask {
  taskType: MissionTaskType;
  content: Json;
}

/**
 * The complete AI generation result the teacher reviews before publishing.
 *
 * WP-5.6: `parseGeneratedGrammar` (and the `parseGrammarTask` / `asStringList`
 * helpers only it used) moved into
 * `supabase/functions/_shared/drafts/grammarDraft.ts`. The Server Action no
 * longer sees a model response. The interfaces stay here — `GrammarManager` and
 * `publishGrammar` are typed against them.
 */
export interface GrammarDraft {
  points: GrammarDraftPoint[];
  tasks: GrammarDraftTask[];
}

/* ── Counts ────────────────────────────────────────────────────────────────── */

export const MAX_GRAMMAR_POINTS = 20;
export const MIN_GRAMMAR_POINTS = 1;
export const MAX_GRAMMAR_TASKS = 20;

/**
 * Default number of test tasks for a grammar set: "half the number of points",
 * rounded, never fewer than one when there is at least one point.
 */
export function defaultGrammarTaskCount(pointCount: number): number {
  if (pointCount <= 0) return 0;
  return Math.max(1, Math.round(pointCount / 2));
}

/** Clamp a requested grammar-point count into the allowed range. */
export function clampGrammarPointCount(requested: number): number {
  if (!Number.isFinite(requested)) return MIN_GRAMMAR_POINTS;
  return Math.min(MAX_GRAMMAR_POINTS, Math.max(MIN_GRAMMAR_POINTS, Math.round(requested)));
}

/**
 * The task types a grammar test may use. A deliberately small subset that
 * `TaskRunner` renders from self-contained content, so a generated test is
 * always valid regardless of the model's output.
 */
export const GRAMMAR_TEST_TASK_TYPES: MissionTaskType[] = ["quiz", "fill_blank"];

/* ── Content helpers ─────────────────────────────────────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Human-facing label + one-line detail for a built grammar test task, for previews. */
export function describeGrammarTask(taskType: MissionTaskType, content: Json): { label: string; detail: string } {
  const c = isRecord(content) ? content : {};
  switch (taskType) {
    case "quiz":
      return { label: "Quiz", detail: asTrimmedString(c.question) ?? "Choose the correct form" };
    case "fill_blank":
      return { label: "Fill the blank", detail: asTrimmedString(c.sentence) ?? "Complete the sentence" };
    default:
      return { label: taskType, detail: "" };
  }
}
