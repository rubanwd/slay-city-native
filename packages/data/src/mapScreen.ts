import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";
import {
  buildLocationProgress,
  buildMapViewModel,
  isLevelCompleted,
  KNOWLEDGE_LEVEL_LABELS,
  nextKnowledgeLevel,
  selectActiveDistrict,
  sumLocationRewards,
  type MapDistrictViewModel,
} from "@slay/core";

import { hasAnyGroup } from "./homework";
import { getMyLevel } from "./levels";
import { loadMascotImage } from "./wardrobe";

/** What to say when the player has finished every district in their level. */
export interface LevelStatus {
  /** True once every district of the player's level is cleared. */
  completed: boolean;
  /** Display name of the level they just finished, e.g. "Elementary". */
  levelName: string;
  /** The level above it, or null at the top of the ladder. */
  nextLevelName: string | null;
}

export interface HudStats {
  xp: number;
  coins: number;
  level: number;
  currentStreak: number;
}

export interface MapScreenData {
  /** The district the player is currently in (`selectActiveDistrict`). */
  district: MapDistrictViewModel | null;
  hud: HudStats;
  /** The you-are-here marker: the equipped item's artwork or the default snake. */
  mascotImageUrl: string;
  /** True when the student is in a teacher group — shows the Homework tab. */
  showHomework: boolean;
  levelStatus: LevelStatus;
}

/**
 * Everything the student map shows — a port of upstream's server page
 * `src/app/map/page.tsx`: the same queries, assembled by the same
 * `@slay/core` functions, so a district looks and progresses identically on
 * both platforms.
 *
 * The map only ever shows the districts of the level the student is studying;
 * switching level swaps the whole map, while per-mission progress is untouched.
 */
export async function loadMapScreen(db: SupabaseClient<Database>): Promise<MapScreenData> {
  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser();
  if (userError || !user) {
    throw userError ?? new Error("Not signed in.");
  }

  const level = await getMyLevel(db, user.id);

  const [districtsRes, locationsRes, missionsRes, progressRes, statsRes, mascotImageUrl, showHomework] =
    await Promise.all([
      db
        .from("districts")
        .select("id, name, order_index, background_image_url")
        .eq("is_published", true)
        .eq("level", level)
        .order("order_index"),
      db
        .from("locations")
        .select("id, district_id, name, description, order_index, map_x, map_y, icon_url")
        .eq("is_published", true)
        .order("order_index"),
      db
        .from("missions")
        .select("id, location_id, order_index, xp_reward, coin_reward")
        .eq("is_published", true)
        .order("order_index"),
      db.from("user_progress").select("mission_id, completed_at").eq("profile_id", user.id),
      db.from("user_stats").select("xp, coins, level, current_streak").eq("profile_id", user.id).maybeSingle(),
      loadMascotImage(db, user.id),
      hasAnyGroup(db),
    ]);

  // A failed read must not render as an empty map — the player would think
  // their progress was gone.
  const failed = [districtsRes, locationsRes, missionsRes, progressRes, statsRes].find((res) => res.error);
  if (failed?.error) {
    throw failed.error;
  }

  const districts = districtsRes.data ?? [];
  const publishedDistrictIds = new Set(districts.map((d) => d.id));
  const locations = (locationsRes.data ?? []).filter((loc) => publishedDistrictIds.has(loc.district_id));

  const completedMissionIds = new Set(
    (progressRes.data ?? []).filter((row) => row.completed_at !== null).map((row) => row.mission_id),
  );

  const { completedLocationIds, nextMissionIdByLocation, missionCountsByLocation } = buildLocationProgress(
    missionsRes.data ?? [],
    completedMissionIds,
  );

  const mapDistricts = buildMapViewModel(
    districts,
    locations,
    completedLocationIds,
    nextMissionIdByLocation,
    sumLocationRewards(missionsRes.data ?? []),
    missionCountsByLocation,
  );

  // Every district of this level done means no higher level had content to
  // move the player to (`complete_mission` promotes them when one does), so
  // the map offers a replay.
  const nextLevel = nextKnowledgeLevel(level);
  const stats = statsRes.data;

  return {
    district: selectActiveDistrict(mapDistricts),
    hud: {
      xp: stats?.xp ?? 0,
      coins: stats?.coins ?? 0,
      level: stats?.level ?? 1,
      currentStreak: stats?.current_streak ?? 0,
    },
    mascotImageUrl,
    showHomework,
    levelStatus: {
      completed: isLevelCompleted(mapDistricts),
      levelName: KNOWLEDGE_LEVEL_LABELS[level],
      nextLevelName: nextLevel ? KNOWLEDGE_LEVEL_LABELS[nextLevel] : null,
    },
  };
}
