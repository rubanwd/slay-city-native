import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, KnowledgeLevel } from "@slay/core/types";
import {
  DEFAULT_KNOWLEDGE_LEVEL,
  isKnowledgeLevel,
  knowledgeLevelLabel,
  sortKnowledgeLevels,
} from "@slay/core";

export type ChangeLevelResult = { ok: true } | { ok: false; error: string };

/**
 * Clears the player's progress across their whole current level so they can
 * play it again. Offered on the map when a level is finished and the next one
 * has no content yet — the alternative to a dead end.
 *
 * XP, coins and streaks are kept; the missions simply pay out again as they
 * are replayed, exactly like the per-location restart.
 */
export async function restartMyLevel(db: SupabaseClient<Database>): Promise<ChangeLevelResult> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to replay a level." };
  }

  const { error } = await db.rpc("reset_level_progress");
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Switches the signed-in student to another knowledge level, changing which
 * districts their map shows. Progress is per-mission, so nothing is lost:
 * switching back restores exactly what they had finished there.
 *
 * The "is this level actually available?" rule lives in
 * `set_my_knowledge_level` (SECURITY DEFINER), so a hand-crafted request can't
 * park a student on an empty level.
 */
export async function changeMyLevel(
  db: SupabaseClient<Database>,
  level: string
): Promise<ChangeLevelResult> {
  if (!isKnowledgeLevel(level)) {
    return { ok: false, error: "Pick a level from the list." };
  }

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to change your level." };
  }

  const { error } = await db.rpc("set_my_knowledge_level", { p_level: level });
  if (error) {
    return {
      ok: false,
      error: `Couldn't switch to ${knowledgeLevelLabel(level)}. ${error.message}`,
    };
  }

  return { ok: true };
}

/**
 * The levels a student is allowed to pick right now: those with at least one
 * published district that has at least one published location. Backed by the
 * `available_knowledge_levels()` SECURITY DEFINER RPC, so the answer is the
 * same for a student and an admin.
 *
 * Returns an empty list if the RPC fails — callers must handle "no level to
 * pick" anyway, since a fresh database has no published content at all.
 */
export async function getAvailableLevels(
  db: SupabaseClient<Database>
): Promise<KnowledgeLevel[]> {
  const { data } = await db.rpc("available_knowledge_levels");
  const levels = (data ?? []).filter(isKnowledgeLevel);
  return sortKnowledgeLevels(levels);
}

/**
 * Whether the profile has completed every published mission of every published
 * location of every published district in a level — the condition that
 * graduates a player to the next level (`advance_my_level_if_cleared`).
 *
 * A level with no published missions is never "cleared": there was nothing to
 * finish.
 */
export async function isLevelCleared(
  db: SupabaseClient<Database>,
  profileId: string,
  level: KnowledgeLevel
): Promise<boolean> {
  const { data: districts } = await db
    .from("districts")
    .select("id")
    .eq("level", level)
    .eq("is_published", true);

  const districtIds = (districts ?? []).map((district) => district.id);
  if (districtIds.length === 0) return false;

  const { data: locations } = await db
    .from("locations")
    .select("id")
    .in("district_id", districtIds)
    .eq("is_published", true);

  const locationIds = (locations ?? []).map((location) => location.id);
  if (locationIds.length === 0) return false;

  const { data: missions } = await db
    .from("missions")
    .select("id")
    .in("location_id", locationIds)
    .eq("is_published", true);

  const missionIds = (missions ?? []).map((mission) => mission.id);
  if (missionIds.length === 0) return false;

  const { data: progress } = await db
    .from("user_progress")
    .select("mission_id, completed_at")
    .eq("profile_id", profileId)
    .in("mission_id", missionIds);

  const completed = new Set(
    (progress ?? []).filter((row) => row.completed_at !== null).map((row) => row.mission_id)
  );

  return missionIds.every((id) => completed.has(id));
}

/**
 * The level the signed-in student is studying. Falls back to the default level
 * for profiles that predate this column or when the profile row is missing.
 */
export async function getMyLevel(
  db: SupabaseClient<Database>,
  profileId: string
): Promise<KnowledgeLevel> {
  const { data } = await db
    .from("profiles")
    .select("level")
    .eq("id", profileId)
    .maybeSingle();

  return isKnowledgeLevel(data?.level) ? data.level : DEFAULT_KNOWLEDGE_LEVEL;
}
