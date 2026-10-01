/**
 * What `draft-grammar` adds to the shared gate chain in
 * `_shared/draftHandler.ts`. The sibling of `draft-vocabulary/spec.ts`, step for
 * step, with `buildGrammarPrompt` and `parseGeneratedGrammar` substituted.
 *
 * Request:
 *
 *   POST /functions/v1/draft-grammar
 *   Authorization: Bearer <user JWT>
 *   { "topic_id": uuid,
 *     "extra_instructions": string|null,
 *     "point_count": 4,
 *     "task_count": 3,
 *     "act_as_teacher_id": uuid|null }
 *
 * Response 200:
 *
 *   { "points": [ { title, explanation, example } ],
 *     "tasks":  [ { taskType, content } ] }
 *
 * `points: []` is a 422. `tasks: []` with non-empty `points` is a **success** —
 * that is the behaviour today and `GrammarManager` handles it, so changing it
 * would be a regression dressed as validation.
 *
 * Worth knowing for the budget: `handleRegenerateTest()` in `GrammarManager.tsx`
 * makes a *second* identical call and keeps only `tasks`, so a teacher iterating
 * on a test legitimately spends several full drafts a minute. That is why
 * `draft_grammar`'s per-minute budget is 5 rather than something tighter.
 */

import {
  DEFAULT_GRAMMAR_POINTS,
  DEFAULT_GRAMMAR_TASKS,
  MAX_GRAMMAR_POINTS,
  MAX_GRAMMAR_TASKS,
  MIN_GRAMMAR_POINTS,
  MIN_GRAMMAR_TASKS,
  parseGeneratedGrammar,
  type DraftGrammarResponse,
} from "../_shared/drafts/grammarDraft.ts";
import { buildGrammarPrompt } from "../_shared/prompts/grammarPrompt.ts";
import type { DraftSpec } from "../_shared/draftHandler.ts";
import {
  isRecord,
  parseCount,
  parseDraftBase,
  type DraftRequestBase,
  type ParseResult,
} from "../_shared/requestBody.ts";

export interface DraftGrammarBody extends DraftRequestBase {
  pointCount: number;
  taskCount: number;
}

export const draftGrammarSpec: DraftSpec<DraftGrammarBody, DraftGrammarResponse> = {
  kind: "draft_grammar",

  parseBody(raw: unknown): ParseResult<DraftGrammarBody> {
    const base = parseDraftBase(raw);
    if (!base.ok) return { ok: false };
    if (!isRecord(raw)) return { ok: false };

    const pointCount = parseCount(
      raw.point_count,
      MIN_GRAMMAR_POINTS,
      MAX_GRAMMAR_POINTS,
      DEFAULT_GRAMMAR_POINTS,
    );
    if (!pointCount.ok) return { ok: false };

    // Zero tasks is legal: a teacher may want rule cards with no test.
    const taskCount = parseCount(
      raw.task_count,
      MIN_GRAMMAR_TASKS,
      MAX_GRAMMAR_TASKS,
      DEFAULT_GRAMMAR_TASKS,
    );
    if (!taskCount.ok) return { ok: false };

    return {
      ok: true,
      value: { ...base.value, pointCount: pointCount.value, taskCount: taskCount.value },
    };
  },

  buildPrompt(body, topic) {
    return buildGrammarPrompt({
      topicTitle: topic.title,
      topicDescription: topic.description,
      extraInstructions: body.extraInstructions,
      pointCount: body.pointCount,
      taskCount: body.taskCount,
    });
  },

  parseResponse(json) {
    const draft = parseGeneratedGrammar(json);
    if (draft.points.length === 0) {
      // Existing string, character for character.
      return {
        ok: false,
        message: "The AI didn't return any usable grammar points. Try again.",
      };
    }
    return { ok: true, value: draft };
  },
};
