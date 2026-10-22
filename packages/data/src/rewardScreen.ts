import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, KnowledgeLevel } from "@slay/core/types";
import {
  buildLocationProgress,
  KNOWLEDGE_LEVEL_LABELS,
  knowledgeLevelOrder,
  nextKnowledgeLevel,
  taskTypeLabel,
} from "@slay/core";

import { getMyLevel, isLevelCleared } from "./levels";

export type RewardMilestone = "location" | "district" | "level";

export interface RewardScreenData {
  missionTitle: string;
  /**
   * What the completion row recorded — the web's fallback when the reward
   * screen is reached without the `complete_mission` result in hand (a
   * reopened link). Falls back to the mission's full reward for completions
   * recorded before per-completion amounts were tracked.
   */
  recordedXp: number;
  recordedCoins: number;
  taskNames: string[];
  locationName: string | null;
  missionsCompletedAtLocation: number;
  totalMissionsAtLocation: number;
  milestone: RewardMilestone | null;
  /** The level just finished — set with `milestone: "level"`. */
  clearedLevelName: string | null;
  /** The level above the one just finished, or null at the top of the ladder. */
  nextLevelName: string | null;
  /** The level the player was moved up to; null when the next one has no content yet. */
  advancedToLevelName: string | null;
  /** Where Continue goes: the map, focused on this location, with the milestone to announce. */
  continueTo: { focus?: string; milestone?: RewardMilestone; name?: string };
}

/**
 * Everything the reward screen shows — the queries and the milestone logic of
 * upstream's server page `src/app/mission/[missionId]/reward/page.tsx`.
 *
 * Null when the mission does not exist or is unpublished (the web's
 * `notFound()`), and `"not-completed"` when the signed-in player has no
 * completion for it, which the web answers with a redirect to the map: there
 * is no reward to show.
 */
export async function loadRewardScreen(
  db: SupabaseClient<Database>,
  missionId: string
): Promise<RewardScreenData | "not-completed" | null> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return "not-completed";

  const { data: mission, error: missionError } = await db
    .from("missions")
    .select("id, title, xp_reward, coin_reward, location_id, locations(id, name, district_id, districts(level))")
    .eq("id", missionId)
    .eq("is_published", true)
    .maybeSingle();
  if (missionError) throw missionError;
  if (!mission) return null;

  const { data: progress, error: progressError } = await db
    .from("user_progress")
    .select("id, xp_earned, coins_earned")
    .eq("profile_id", user.id)
    .eq("mission_id", missionId)
    .maybeSingle();
  if (progressError) throw progressError;
  if (!progress) return "not-completed";

  const { data: tasks } = await db
    .from("mission_tasks")
    .select("task_type")
    .eq("mission_id", missionId)
    .eq("is_published", true)
    .order("order_index");

  // The FK relationship comes back as a single related row (or null).
  const location = mission.locations as {
    id: string;
    name: string;
    district_id: string;
    districts: { level: KnowledgeLevel } | null;
  } | null;

  // Where this completion leaves the player: how many missions are left at
  // this location, and whether it also cleared the location, the district or
  // the whole level.
  let missionsCompletedAtLocation = 0;
  let totalMissionsAtLocation = 0;
  let milestone: RewardMilestone | null = null;
  let clearedLevelName: string | null = null;
  let nextLevelName: string | null = null;
  let advancedToLevelName: string | null = null;

  if (location) {
    const { data: districtLocations } = await db
      .from("locations")
      .select("id")
      .eq("district_id", location.district_id)
      .eq("is_published", true);

    const districtLocationIds = (districtLocations ?? []).map((loc) => loc.id);

    const [districtMissionsRes, progressRes] = await Promise.all([
      db
        .from("missions")
        .select("id, location_id, order_index")
        .in("location_id", districtLocationIds)
        .eq("is_published", true),
      db.from("user_progress").select("mission_id, completed_at").eq("profile_id", user.id),
    ]);

    const completedMissionIds = new Set(
      (progressRes.data ?? []).filter((row) => row.completed_at !== null).map((row) => row.mission_id)
    );

    const { completedLocationIds, missionCountsByLocation } = buildLocationProgress(
      districtMissionsRes.data ?? [],
      completedMissionIds
    );

    const counts = missionCountsByLocation.get(location.id);
    missionsCompletedAtLocation = counts?.completed ?? 0;
    totalMissionsAtLocation = counts?.total ?? 0;

    const isLocationComplete = completedLocationIds.has(location.id);
    const isDistrictComplete =
      districtLocationIds.length > 0 && districtLocationIds.every((id) => completedLocationIds.has(id));

    if (isDistrictComplete) {
      milestone = "district";
    } else if (isLocationComplete) {
      milestone = "location";
    }

    // Clearing the level implies clearing this district, so only look when the
    // district is done. `complete_mission` has already moved the player up if
    // a higher level has content — comparing their level to this one's says
    // whether that happened.
    const missionLevel = location.districts?.level ?? null;
    if (isDistrictComplete && missionLevel && (await isLevelCleared(db, user.id, missionLevel))) {
      milestone = "level";
      clearedLevelName = KNOWLEDGE_LEVEL_LABELS[missionLevel];

      const next = nextKnowledgeLevel(missionLevel);
      nextLevelName = next ? KNOWLEDGE_LEVEL_LABELS[next] : null;

      const currentLevel = await getMyLevel(db, user.id);
      if (knowledgeLevelOrder(currentLevel) > knowledgeLevelOrder(missionLevel)) {
        advancedToLevelName = KNOWLEDGE_LEVEL_LABELS[currentLevel];
      }
    }
  }

  const continueTo: RewardScreenData["continueTo"] = {};
  if (location) continueTo.focus = location.id;
  if (milestone) continueTo.milestone = milestone;
  if (milestone === "location" && location) continueTo.name = location.name;
  if (milestone === "level" && advancedToLevelName) continueTo.name = advancedToLevelName;

  return {
    missionTitle: mission.title,
    recordedXp: progress.xp_earned ?? mission.xp_reward,
    recordedCoins: progress.coins_earned ?? mission.coin_reward,
    taskNames: (tasks ?? []).map((task) => taskTypeLabel(task.task_type)),
    locationName: location?.name ?? null,
    missionsCompletedAtLocation,
    totalMissionsAtLocation,
    milestone,
    clearedLevelName,
    nextLevelName,
    advancedToLevelName,
    continueTo,
  };
}
