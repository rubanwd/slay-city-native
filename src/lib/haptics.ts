import * as Haptics from "expo-haptics";
import { useSyncExternalStore } from "react";

import { readSecureItem, writeSecureItem } from "./secure-storage";

/**
 * The moments that buzz, each with its own feel so they can be told apart
 * without looking (WP-6.3):
 *
 * - `tap` — a light impact on a button press.
 * - `tick` — the selection click that keeps time with Simon's lights.
 * - `correct` — the success notification on a right answer.
 * - `wrong` — the warning notification on a wrong one; a warning, not an
 *   error, since a miss is part of learning.
 * - `missionComplete` — a medium then heavy knock as the last task is sent.
 * - `reward` — a success, then two light sparkles, as the reward screen lands.
 * - `levelUnlock` — two heavy knocks and a success, for a cleared district or
 *   level: the biggest moment gets the biggest pattern.
 */
export type HapticPattern = "tap" | "tick" | "correct" | "wrong" | "missionComplete" | "reward" | "levelUnlock";

type Step = readonly [delayMs: number, play: () => Promise<void>];

const light = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const medium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const heavy = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
const warning = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

const PATTERNS: Record<HapticPattern, readonly Step[]> = {
  tap: [[0, light]],
  tick: [[0, () => Haptics.selectionAsync()]],
  correct: [[0, success]],
  wrong: [[0, warning]],
  missionComplete: [
    [0, medium],
    [120, heavy],
  ],
  reward: [
    [0, success],
    [260, light],
    [400, light],
  ],
  levelUnlock: [
    [0, heavy],
    [160, heavy],
    [340, success],
  ],
};

/** The off switch's stored value: "off" disables haptics; anything else, or nothing, leaves them on. */
export const HAPTICS_STORAGE_KEY = "slay_haptics";

let enabled = true;
const listeners = new Set<() => void>();

function setEnabled(value: boolean) {
  if (value === enabled) return;
  enabled = value;
  listeners.forEach((listener) => listener());
}

/** Reads the stored switch. Call once at start-up; until it resolves, haptics are on. */
export async function loadHapticsPreference(): Promise<void> {
  setEnabled((await readSecureItem(HAPTICS_STORAGE_KEY).catch(() => null)) !== "off");
}

/** Flips the global switch and stores it, so it holds across launches. */
export async function setHapticsEnabled(value: boolean): Promise<void> {
  setEnabled(value);
  await writeSecureItem(HAPTICS_STORAGE_KEY, value ? "on" : "off").catch(() => {});
}

/** Whether haptics are on, re-rendering when the switch changes. */
export function useHapticsEnabled(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled,
  );
}

/**
 * Plays a pattern unless haptics are switched off. Never throws and never
 * waits: a device without a vibrator, or the web, simply feels nothing.
 */
export function haptic(pattern: HapticPattern): void {
  if (!enabled) return;
  for (const [delayMs, play] of PATTERNS[pattern]) {
    const run = () => {
      // Re-checked per step, so switching off mid-pattern stops the rest.
      if (enabled) play().catch(() => {});
    };
    if (delayMs === 0) run();
    else setTimeout(run, delayMs);
  }
}
