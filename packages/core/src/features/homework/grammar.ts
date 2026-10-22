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

/** The complete AI generation result the teacher reviews before publishing. */
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

/* ── AI response parsing ───────────────────────────────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const s = asTrimmedString(entry);
    if (s) out.push(s);
  }
  return out;
}

/**
 * Parses one generated test task into a valid `{ taskType, content }` in the
 * exact content shapes `TaskRunner` already renders for the vocabulary test
 * (quiz / fill_blank). Returns `null` for anything unusable, so a partial
 * response still yields a usable test.
 */
function parseGrammarTask(entry: unknown): GrammarDraftTask | null {
  if (!isRecord(entry)) return null;
  const type = asTrimmedString(entry.type ?? entry.taskType ?? entry.task_type)?.toLowerCase();

  if (type === "quiz") {
    const question = asTrimmedString(entry.question ?? entry.prompt);
    const options = asStringList(entry.options);
    if (!question || options.length < 2) return null;
    const answer = asTrimmedString(entry.answer ?? entry.correctAnswer);
    let correctIndex =
      typeof entry.correctIndex === "number" ? Math.trunc(entry.correctIndex) : -1;
    if (correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = answer ? options.findIndex((o) => o === answer) : 0;
    }
    if (correctIndex < 0) correctIndex = 0;
    return {
      taskType: "quiz",
      content: { question, imageUrl: null, options, correctIndex } satisfies Record<string, Json>,
    };
  }

  if (type === "fill_blank" || type === "fill-blank" || type === "fillblank") {
    const sentence = asTrimmedString(entry.sentence ?? entry.prompt);
    const answer = asTrimmedString(entry.answer);
    if (!sentence || !answer) return null;
    // Ensure the answer is among the options and there are at least two to pick from.
    const provided = asStringList(entry.options);
    const options = provided.includes(answer) ? provided : [answer, ...provided];
    return {
      taskType: "fill_blank",
      content: {
        sentence,
        answer,
        options: options.length >= 2 ? options : [],
        translation: asTrimmedString(entry.translation) ?? "",
      } satisfies Record<string, Json>,
    };
  }

  return null;
}

/**
 * Defensively parses the AI generator's JSON into a grammar draft (points +
 * test tasks). Malformed entries are dropped rather than throwing, so a
 * partially-valid response still yields a usable draft.
 */
export function parseGeneratedGrammar(raw: unknown): GrammarDraft {
  const root = isRecord(raw) ? raw : {};

  const pointList = Array.isArray(root.points) ? root.points : [];
  const points: GrammarDraftPoint[] = [];
  for (const entry of pointList) {
    if (!isRecord(entry)) continue;
    const title = asTrimmedString(entry.title ?? entry.rule ?? entry.name);
    const explanation = asTrimmedString(entry.explanation ?? entry.rule ?? entry.description);
    if (!title || !explanation) continue;
    points.push({
      title,
      explanation,
      example: asTrimmedString(entry.example ?? entry.exampleSentence ?? entry.example_sentence),
    });
  }

  const taskList = Array.isArray(root.tasks) ? root.tasks : [];
  const tasks: GrammarDraftTask[] = [];
  for (const entry of taskList) {
    const task = parseGrammarTask(entry);
    if (task) tasks.push(task);
  }

  return { points, tasks };
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
