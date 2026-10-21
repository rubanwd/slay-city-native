import { parseQuizContent, type MissionTaskType } from "@slay/core";

import { defineTask, type TaskRenderer } from "./taskContract";
import { QuizTask } from "./tasks/QuizTask";

/**
 * Every task type the app can play, keyed by `mission_task_type`. A type that
 * is missing here plays as upstream's "not available yet — skip ahead" card,
 * so a mission is never blocked by a task that hasn't been ported.
 *
 * WP-3.3–3.6 each add one line: `type: defineTask(parseTypeContent, TypeTask)`.
 */
export const TASKS: Partial<Record<MissionTaskType, TaskRenderer>> = {
  quiz: defineTask(parseQuizContent, QuizTask),
};
