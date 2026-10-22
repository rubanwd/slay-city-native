import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, KnowledgeLevel } from "@slay/core/types";
import {
  buildLocationProgress,
  buildMapViewModel,
  knowledgeLevelLabel,
  sumLocationRewards,
  type MapDistrictViewModel,
  type MissionTaskViewModel,
} from "@slay/core";

import { getMyLevel } from "./levels";
import { loadMission, type MissionScreenData } from "./missionScreen";

/** Adults never enter a mission from the map, so no stop points at a playable one. */
const NO_NEXT_MISSIONS: ReadonlyMap<string, string> = new Map<string, string>();

/**
 * The missions every one of `profileIds` has completed — "every", so a ✓ means
 * everyone the viewer follows is done there. RLS decides what is readable; a
 * profile the viewer may not read contributes nothing.
 */
async function loadSharedCompletedMissions(db: SupabaseClient<Database>, profileIds: readonly string[]): Promise<Set<string>> {
  if (profileIds.length === 0) return new Set();
  const { data } = await db
    .from("user_progress")
    .select("profile_id, mission_id")
    .in("profile_id", [...profileIds])
    .not("completed_at", "is", null);

  // A profile can replay a mission, so count distinct profiles per mission.
  const profilesByMission = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const profiles = profilesByMission.get(row.mission_id) ?? new Set<string>();
    profiles.add(row.profile_id);
    profilesByMission.set(row.mission_id, profiles);
  }
  return new Set([...profilesByMission].filter(([, profiles]) => profiles.size === profileIds.length).map(([id]) => id));
}

/**
 * Port of upstream's `map/previewMap.ts` `loadMapPreview`: every published
 * district of a level with its published locations and how much each holds —
 * the read-only map parents and teachers browse. `followedProfileIds` are whose
 * progress it reflects (a parent's student); none, and it is content only.
 */
export async function loadMapPreview(
  db: SupabaseClient<Database>,
  level: KnowledgeLevel,
  followedProfileIds: readonly string[] = []
): Promise<MapDistrictViewModel[]> {
  const [districtsRes, locationsRes, missionsRes, completedMissionIds] = await Promise.all([
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
    db.from("missions").select("id, location_id, order_index, xp_reward, coin_reward").eq("is_published", true).order("order_index"),
    loadSharedCompletedMissions(db, followedProfileIds),
  ]);
  // A failed read must not look like an empty city.
  if (districtsRes.error) throw districtsRes.error;
  if (locationsRes.error) throw locationsRes.error;
  if (missionsRes.error) throw missionsRes.error;

  const districts = districtsRes.data ?? [];
  const publishedDistrictIds = new Set(districts.map((d) => d.id));
  const locations = (locationsRes.data ?? []).filter((l) => publishedDistrictIds.has(l.district_id));
  const missions = missionsRes.data ?? [];
  const { completedLocationIds, missionCountsByLocation } = buildLocationProgress(missions, completedMissionIds);

  return buildMapViewModel(districts, locations, completedLocationIds, NO_NEXT_MISSIONS, sumLocationRewards(missions), missionCountsByLocation);
}

export interface TeacherMapData {
  districts: MapDistrictViewModel[];
  levelName: string;
}

/**
 * The queries of upstream's `src/app/teacher/map/page.tsx`: the whole city at
 * the signed-in account's own level, with no student's progress on it.
 */
export async function loadTeacherMap(db: SupabaseClient<Database>): Promise<TeacherMapData> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const level = await getMyLevel(db, user.id);
  return { districts: await loadMapPreview(db, level), levelName: knowledgeLevelLabel(level) };
}

export interface ReviewLocationData {
  location: { id: string; name: string; description: string | null; districtName: string | null };
  missions: { id: string; title: string; description: string | null }[];
}

/** Upstream's `src/app/teacher/location/[locationId]/page.tsx`: every published mission at a location. Null if unpublished. */
export async function loadReviewLocation(db: SupabaseClient<Database>, locationId: string): Promise<ReviewLocationData | null> {
  const [locationRes, missionsRes] = await Promise.all([
    db.from("locations").select("id, name, description, districts(name)").eq("id", locationId).eq("is_published", true).maybeSingle(),
    db.from("missions").select("id, title, description, order_index").eq("location_id", locationId).eq("is_published", true).order("order_index"),
  ]);
  if (locationRes.error) throw locationRes.error;
  const location = locationRes.data;
  if (!location) return null;
  const district = location.districts as { name: string } | null;
  return {
    location: { id: location.id, name: location.name, description: location.description, districtName: district?.name ?? null },
    missions: (missionsRes.data ?? []).map((m) => ({ id: m.id, title: m.title, description: m.description })),
  };
}

export interface ReviewMissionData extends MissionScreenData {
  locationId: string;
  /** The next mission at the same location, so a review runs straight on. */
  next: { id: string; title: string } | null;
  tasks: MissionTaskViewModel[];
}

/** Upstream's `src/app/teacher/mission/[missionId]/page.tsx`: the mission, its tasks, and the one after it. */
export async function loadReviewMission(db: SupabaseClient<Database>, missionId: string): Promise<ReviewMissionData | null> {
  const [mission, locationRes] = await Promise.all([
    loadMission(db, missionId),
    db.from("missions").select("location_id").eq("id", missionId).eq("is_published", true).maybeSingle(),
  ]);
  const locationId = locationRes.data?.location_id;
  if (!mission || !locationId) return null;

  const { data: siblings } = await db
    .from("missions")
    .select("id, title, order_index")
    .eq("location_id", locationId)
    .eq("is_published", true)
    .order("order_index");
  const ordered = siblings ?? [];
  const next = ordered[ordered.findIndex((row) => row.id === missionId) + 1] ?? null;
  return { ...mission, locationId, next: next ? { id: next.id, title: next.title } : null };
}
