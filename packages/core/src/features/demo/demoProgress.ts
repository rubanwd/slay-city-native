/**
 * The signed-out demo: what a visitor is allowed to play before the app asks
 * them to sign up.
 *
 * A visitor who has never logged in lands on a playable map instead of a login
 * form. They may finish exactly **one location** — every mission of it — and are
 * then sent to the login screen. Nothing about that run is written to the
 * database (there is no account to write it to): the whole demo run lives in one
 * cookie, which the "Back" button on the login screen clears so the visitor can
 * play another location.
 *
 * All of it is deliberately throw-away — no XP, no coins, no streak. Those only
 * start existing once there is an account to hold them.
 */

/** Holds the demo run. Absent means "this visitor has not played anything yet". */
export const DEMO_PROGRESS_COOKIE = "slay_demo";

/**
 * Where a visitor is sent once their one free location is done: the login
 * screen, flagged so it explains itself and offers the way back to the map.
 */
export const DEMO_GATE_PATH = "/auth/login?from=demo";

/**
 * A day. Long enough that a visitor who closes the tab mid-location comes back
 * to where they were, short enough that the demo resets on its own.
 */
export const DEMO_PROGRESS_MAX_AGE = 60 * 60 * 24;

export interface DemoProgress {
  /** Mission ids finished during the current demo run. */
  completedMissionIds: string[];
  /**
   * True once a whole location was finished — the demo allowance is spent and
   * every demo route redirects to the login screen until the run is reset.
   */
  gated: boolean;
}

/** A visitor who has played nothing yet. */
export const EMPTY_DEMO_PROGRESS: DemoProgress = { completedMissionIds: [], gated: false };

/**
 * Reads the demo cookie. Anything unparseable, wrongly shaped or tampered with
 * reads as "played nothing" rather than throwing — the cookie is visitor-owned
 * data and the worst it can do is hand out one more free location.
 */
export function parseDemoProgress(raw: string | undefined | null): DemoProgress {
  if (!raw) return EMPTY_DEMO_PROGRESS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_DEMO_PROGRESS;
  }

  if (typeof parsed !== "object" || parsed === null) return EMPTY_DEMO_PROGRESS;

  const record = parsed as { completedMissionIds?: unknown; gated?: unknown };
  const ids = Array.isArray(record.completedMissionIds)
    ? record.completedMissionIds.filter((id): id is string => typeof id === "string")
    : [];

  return { completedMissionIds: ids, gated: record.gated === true };
}

/** The cookie value for a demo run. */
export function serializeDemoProgress(progress: DemoProgress): string {
  return JSON.stringify(progress);
}

/**
 * The demo run after finishing `missionId` at a location whose published
 * missions are `locationMissionIds`.
 *
 * Finishing the last outstanding mission of the location closes the demo
 * (`gated`), which is what sends the visitor to the login screen.
 */
export function advanceDemoProgress(
  progress: DemoProgress,
  missionId: string,
  locationMissionIds: readonly string[]
): DemoProgress {
  const completedMissionIds = progress.completedMissionIds.includes(missionId)
    ? progress.completedMissionIds
    : [...progress.completedMissionIds, missionId];

  const completed = new Set(completedMissionIds);
  const locationCleared =
    locationMissionIds.length > 0 && locationMissionIds.every((id) => completed.has(id));

  return { completedMissionIds, gated: progress.gated || locationCleared };
}

export interface DemoDistrictOptions {
  /**
   * The district the visitor is already playing in — where the missions they
   * have finished live. Keeps a run in one place instead of moving the map out
   * from under them between missions.
   */
  pinnedId?: string | null;
  /** Injectable for tests; defaults to `Math.random`. */
  random?: () => number;
}

/**
 * Which district the demo map opens on, out of the published districts of the
 * demo level that actually have somewhere to play.
 *
 * A fresh visitor gets a **random** one, so the demo shows off the city rather
 * than always opening on the same district a new student starts in. Once they
 * have finished a mission the choice is pinned to that district for the rest of
 * the run — a reset (the "Back" button on the sign-up wall) rolls again.
 *
 * Unlike the signed-in map, the demo never moves on to the next district: the
 * visitor only ever gets one location, so a single district is the whole demo.
 */
export function selectDemoDistrict<T extends { id: string; locations: unknown[] }>(
  districts: readonly T[],
  { pinnedId = null, random = Math.random }: DemoDistrictOptions = {}
): T | null {
  const playable = districts.filter((district) => district.locations.length > 0);
  if (playable.length === 0) return null;

  const pinned = pinnedId ? playable.find((district) => district.id === pinnedId) : undefined;
  if (pinned) return pinned;

  // Clamped rather than trusted: a random() of exactly 1 (or anything out of
  // range) would otherwise index past the end.
  const index = Math.min(playable.length - 1, Math.max(0, Math.floor(random() * playable.length)));
  return playable[index];
}
