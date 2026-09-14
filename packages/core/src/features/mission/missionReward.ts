/** Reward maths for a mission run, kept free of React so it stays unit-testable. */

export interface MissionRunReward {
  /**
   * Product of the completion fraction every *played* task reported. Fully
   * completed tasks report 1; ones that can be finished early (the word search)
   * report the share they got through.
   */
  playedFraction: number;
  /** How many tasks the player skipped outright. */
  skipped: number;
  /** Total tasks in the mission. */
  total: number;
}

/** Clamps a task's self-reported completion share to the [0, 1] it promises. */
export function clampTaskFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Normalises whatever a finished task reported as its share of the reward.
 *
 * Only tasks that can end early (the word search) report a number; every other
 * task simply signals "done" and its `onComplete` may be wired straight to a
 * button, in which case React hands it a click event instead of a fraction.
 * Anything that isn't a real number therefore means *fully completed* — reading
 * it as a share would silently zero out the whole mission's reward.
 */
export function taskRewardFraction(value: unknown): number {
  return typeof value === "number" ? clampTaskFraction(value) : 1;
}

/**
 * The share of a mission's XP and coins a run has earned.
 *
 * Every task is worth an equal slice of the mission, so skipping one forfeits
 * exactly that slice and leaves the slices the player did play untouched —
 * skipping a single broken task costs a fifth of a five-task mission, not the
 * whole thing. A run that skips everything earns nothing, but still counts as
 * completed so the missions behind it stay reachable.
 */
export function missionRewardFraction({
  playedFraction,
  skipped,
  total,
}: MissionRunReward): number {
  if (total <= 0) return 1;
  const played = Math.max(0, total - Math.max(0, skipped));
  return clampTaskFraction(playedFraction) * (played / total);
}
