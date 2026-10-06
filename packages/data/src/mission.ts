import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";

export type MissionCompletionResult =
  | {
      ok: true;
      /** True when the user had already completed this mission — no rewards re-granted. */
      alreadyCompleted: boolean;
      xpEarned: number;
      coinsEarned: number;
      /**
       * Streak values after this completion, or null if the streak update
       * failed. The mission still counts as completed either way.
       */
      currentStreak: number | null;
      longestStreak: number | null;
    }
  | { ok: false; error: string };

/**
 * Records completion of a mission and grants its rewards.
 *
 * All the privileged work — inserting the progress row and incrementing
 * user_stats — happens inside the `complete_mission` SECURITY DEFINER function.
 * The signed-in user has no UPDATE grant on user_stats, so XP/coins can only
 * ever be changed server-side through that function, which also guards (via a
 * unique index) against granting rewards twice.
 */
export async function submitMissionCompletion(
  db: SupabaseClient<Database>,
  missionId: string,
  /**
   * Share of the mission's reward to grant, in [0, 1]. Below 1 when the player
   * chose to finish a game early (e.g. found only some of the word-search
   * words). Clamped here, so it can only ever reduce the reward.
   */
  rewardFraction = 1
): Promise<MissionCompletionResult> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to complete a mission." };
  }

  const { data, error } = await db.rpc("complete_mission", {
    p_mission_id: missionId,
    p_reward_fraction: Math.min(1, Math.max(0, rewardFraction)),
  });

  if (error) {
    if (error.message.includes("Mission not found")) {
      return { ok: false, error: "Mission not found." };
    }
    return { ok: false, error: error.message };
  }

  const result = data?.[0];
  if (!result) {
    return { ok: false, error: "Mission could not be completed." };
  }

  // Update the daily streak after the progress row exists. This is
  // best-effort: the mission is already recorded and rewards granted, so a
  // streak hiccup must never fail the whole submission. The update-streak Edge
  // Function is idempotent per day, so calling it on every completion
  // (including a same-day replay) can never double-count the streak.
  const { currentStreak, longestStreak } = await updateStreak(db, user.id);

  return {
    ok: true,
    alreadyCompleted: result.already_completed,
    xpEarned: result.xp_earned,
    coinsEarned: result.coins_earned,
    currentStreak,
    longestStreak,
  };
}

type StreakValues = { currentStreak: number | null; longestStreak: number | null };

/**
 * Invokes the `update-streak` Edge Function, which owns all writes to
 * user_stats (the client has no UPDATE grant there). Failures are swallowed
 * and reported as null streaks so they can't block a completed mission.
 */
async function updateStreak(
  db: SupabaseClient<Database>,
  profileId: string
): Promise<StreakValues> {
  // Forward the caller's access token so the Edge Function can verify the JWT
  // and confirm the profile_id belongs to this user.
  const {
    data: { session },
  } = await db.auth.getSession();
  if (!session) {
    return { currentStreak: null, longestStreak: null };
  }

  const { data, error } = await db.functions.invoke<{
    current_streak: number;
    longest_streak: number;
    last_activity_date: string;
  }>("update-streak", {
    body: { profile_id: profileId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error || !data) {
    return { currentStreak: null, longestStreak: null };
  }

  return {
    currentStreak: data.current_streak,
    longestStreak: data.longest_streak,
  };
}

/**
 * Lets a player replay every mission at a location they've already completed.
 * Wipes only that location's own progress rows for the caller — every other
 * location, and the caller's overall XP/coins/streak, are untouched. Rewards
 * are re-granted the next time each mission is completed, so replaying pays
 * out again.
 */
export async function resetLocationProgress(
  db: SupabaseClient<Database>,
  locationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to restart this location." };
  }

  const { error } = await db.rpc("reset_location_progress", {
    p_location_id: locationId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
