import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";
import type { MissionTaskViewModel, MissionViewModel } from "@slay/core";

export interface MissionScreenData {
  mission: MissionViewModel;
  /** The location this mission belongs to — its icon and name head the screen. */
  location: { name: string; iconUrl: string | null } | null;
  tasks: MissionTaskViewModel[];
}

/**
 * A published mission and its published tasks, in order — the queries of
 * upstream's server page `src/app/mission/[missionId]/page.tsx`. Null when the
 * mission does not exist or is unpublished (the web's `notFound()`).
 */
export async function loadMission(db: SupabaseClient<Database>, missionId: string): Promise<MissionScreenData | null> {
  const [missionRes, tasksRes] = await Promise.all([
    db
      .from("missions")
      .select("id, title, description, xp_reward, coin_reward, locations(name, icon_url)")
      .eq("id", missionId)
      .eq("is_published", true)
      .maybeSingle(),
    db
      .from("mission_tasks")
      .select("id, task_type, order_index, content")
      .eq("mission_id", missionId)
      .eq("is_published", true)
      .order("order_index"),
  ]);

  // A failed read must not look like "this mission has no tasks".
  if (missionRes.error) throw missionRes.error;
  if (tasksRes.error) throw tasksRes.error;

  const mission = missionRes.data;
  if (!mission) {
    return null;
  }

  // The FK relationship comes back as a single related row (or null).
  const location = mission.locations as { name: string; icon_url: string | null } | null;

  return {
    mission: {
      id: mission.id,
      title: mission.title,
      description: mission.description,
      xpReward: mission.xp_reward,
      coinReward: mission.coin_reward,
    },
    location: location ? { name: location.name, iconUrl: location.icon_url } : null,
    tasks: (tasksRes.data ?? []).map((task) => ({
      id: task.id,
      taskType: task.task_type,
      orderIndex: task.order_index,
      content: task.content,
    })),
  };
}
