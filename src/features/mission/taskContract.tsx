import type { ComponentType, ReactElement } from "react";

import type { MissionTaskType } from "@slay/core";
import type { Json } from "@slay/core/types";

/**
 * 🔒 FROZEN (WP-3.2). The contract every mission task implements — WP-3.3 to
 * WP-3.6 build the other 31 task types against it in parallel, so changing
 * it means changing all of them. Do not edit without the owner's sign-off.
 *
 * It is upstream's, shape for shape (WP-3.2 AC1): each web task takes
 * `{ content, onComplete, actionLabel }`, and `TaskRunner` takes the props
 * below. A task reports what happened and nothing else (AGENTS.md):
 *
 * - `onComplete()` — the task is done. Counts as full completion.
 * - `onComplete(fraction)` — only for a task the player may finish early
 *   (the word search): the share in [0, 1] they earned. `MissionScreen` turns
 *   it into the reward with `missionRewardFraction` from `@slay/core`; a task
 *   never computes XP or coins.
 *
 * `onComplete` may be handed straight to a button: `TaskRunner` drops any
 * argument that is not a number, so a press event can never pass as a
 * fraction.
 */
export interface TaskProps<Content> {
  /** The task's JSONB content, already parsed by its `parse…Content` from `@slay/core`. */
  content: Content;
  onComplete: (rewardFraction?: number) => void;
  /** The finish button's label — "Next", or "Finish Mission" on the last task. */
  actionLabel: string;
}

/** 🔒 FROZEN (WP-3.2). Same as upstream's `TaskRunnerProps`. */
export interface TaskRunnerProps {
  taskType: MissionTaskType;
  /** Raw JSONB content, parsed by the same parser the type uses everywhere. */
  content: Json;
  /**
   * Called when the task is done. A task that can be finished partially passes
   * a reward fraction in [0, 1]; all others call it with no argument, which
   * counts as full completion.
   */
  onComplete: (rewardFraction?: number) => void;
  /**
   * Moves past the task without earning anything for it. Used for the card
   * shown when a task can't be played at all; callers that have no notion of
   * skipping leave it unset, and the card then completes the task instead.
   */
  onSkip?: () => void;
  actionLabel: string;
}

/** Renders one task type from raw content, or null when the content is malformed. */
export type TaskRenderer = (content: Json, props: Omit<TaskProps<never>, "content">) => ReactElement | null;

/**
 * Pairs a task type's parser from `@slay/core` with its component — one line
 * per task in `taskRegistry.ts`. A failed parse renders nothing, so
 * `TaskRunner` shows the skip card instead of a broken task.
 */
export function defineTask<Content>(
  parse: (content: Json) => Content | null,
  Component: ComponentType<TaskProps<Content>>,
): TaskRenderer {
  return function renderTask(raw, props) {
    const content = parse(raw);
    return content ? <Component content={content} {...props} /> : null;
  };
}
