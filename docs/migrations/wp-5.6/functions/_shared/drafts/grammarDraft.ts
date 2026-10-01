/**
 * The `draft-grammar` response contract, and the defensive parser that turns a
 * model response into it.
 *
 * `parseGeneratedGrammar` (with its `parseGrammarTask` helper and the
 * `asStringList` it needs) is MOVED from `src/features/homework/grammar.ts`
 * (WP-5.6), for the reason in `vocabularyDraft.ts`'s header. `describeGrammarTask`,
 * the counts and the draft interfaces stay there — the manager UI and the publish
 * path are typed against them.
 *
 * `GrammarTaskType` is a two-member union rather than the web's full
 * `MissionTaskType`, because the parser only ever emits `quiz` or `fill_blank`:
 * `GRAMMAR_TEST_TASK_TYPES` is already that deliberately small subset, so a
 * generated test is always renderable by `TaskRunner` regardless of model output.
 * Narrowing it here means the union cannot drift wider than the parser.
 */

/** `Json`, re-declared — `@/types/database` is not reachable from Deno. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** The subset of `MissionTaskType` a grammar test may use. */
export type GrammarTaskType = "quiz" | "fill_blank";

/** A grammar point as produced by the AI generator, before publishing. */
export interface GrammarDraftPoint {
  title: string;
  explanation: string;
  example: string | null;
}

/** A generated test task the teacher reviews before publishing. */
export interface GrammarDraftTask {
  taskType: GrammarTaskType;
  content: Json;
}

/** The 200 body of `draft-grammar`. */
export interface DraftGrammarResponse {
  points: GrammarDraftPoint[];
  tasks: GrammarDraftTask[];
}

export const MIN_GRAMMAR_POINTS = 1;
export const MAX_GRAMMAR_POINTS = 20;
export const DEFAULT_GRAMMAR_POINTS = 4;
export const MIN_GRAMMAR_TASKS = 0;
export const MAX_GRAMMAR_TASKS = 20;
export const DEFAULT_GRAMMAR_TASKS = 3;

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
    let correctIndex = typeof entry.correctIndex === "number" ? Math.trunc(entry.correctIndex) : -1;
    if (correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = answer ? options.findIndex((o) => o === answer) : 0;
    }
    if (correctIndex < 0) correctIndex = 0;
    return {
      taskType: "quiz",
      content: { question, imageUrl: null, options, correctIndex },
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
      },
    };
  }

  return null;
}

/**
 * Defensively parses the AI generator's JSON into a grammar draft (points + test
 * tasks). Malformed entries are dropped rather than throwing, so a
 * partially-valid response still yields a usable draft.
 *
 * `points: []` is `unusable_response` (422) at the handler. `tasks: []` with
 * non-empty points is a **success** — that is the behaviour today and
 * `GrammarManager` handles it.
 */
export function parseGeneratedGrammar(raw: unknown): DraftGrammarResponse {
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
