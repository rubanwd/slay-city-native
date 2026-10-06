import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, KnowledgeLevel } from "@slay/core/types";
import { DEFAULT_KNOWLEDGE_LEVEL, isKnowledgeLevel, taskFamilyOf, TASK_FAMILIES, type TaskFamily } from "@slay/core";

export type LinkStudentResult =
  | { linked: true; studentId: string }
  | { linked: false; reason: string };

/**
 * Resolves a parent's registered student email to a student profile and
 * records the link in `parent_student_links`, via the `link_student_by_email`
 * SECURITY DEFINER RPC. Called once per session on the parent dashboard — the
 * student may register before or after the parent, so this is how the two
 * accounts find each other once both exist.
 */
export async function linkStudentByEmail(
  db: SupabaseClient<Database>,
  studentEmail: string
): Promise<LinkStudentResult> {
  const { data, error } = await db.rpc("link_student_by_email", {
    p_student_email: studentEmail,
  });

  if (error) {
    return { linked: false, reason: error.message };
  }

  const row = data?.[0];
  if (row?.linked && row.student_id) {
    return { linked: true, studentId: row.student_id };
  }
  return { linked: false, reason: row?.reason ?? "student_not_registered" };
}

/** The student a parent follows, once the accounts are linked. */
export interface LinkedStudent {
  id: string;
  username: string | null;
  /** The knowledge level the student picked — the parent has none of their own. */
  level: KnowledgeLevel;
}

/**
 * The student account linked to this parent, or null while none is (the
 * student hasn't registered yet). Reads the link {@link linkStudentByEmail}
 * establishes — this is the read-only half, used by screens that show the
 * student's progress without owning the linking flow.
 */
export async function getLinkedStudent(
  db: SupabaseClient<Database>,
  parentId: string
): Promise<LinkedStudent | null> {
  const { data: links } = await db
    .from("parent_student_links")
    .select("student_id")
    .eq("parent_id", parentId)
    .order("created_at")
    .limit(1);

  const studentId = links?.[0]?.student_id;
  if (!studentId) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("username, level")
    .eq("id", studentId)
    .maybeSingle();

  return {
    id: studentId,
    username: profile?.username ?? null,
    level: isKnowledgeLevel(profile?.level) ? profile.level : DEFAULT_KNOWLEDGE_LEVEL,
  };
}

/** How many finished tasks fall into one kind of practice. */
export interface TaskFamilyCount {
  family: TaskFamily;
  count: number;
}

export interface RecentActivityItem {
  /** The completed mission's id. */
  missionId: string;
  /** Human-readable mission title, or a fallback if the mission was unpublished/removed. */
  title: string;
  /** ISO timestamp the mission was completed. */
  completedAt: string;
  /** Score recorded for the completion, if any. */
  score: number | null;
}

export interface ParentProgressSummary {
  /** Total missions the student has completed. */
  missionsCompleted: number;
  /** Current daily streak. */
  currentStreak: number;
  /** Best daily streak ever reached. */
  longestStreak: number;
  /** Distinct locations the student has unlocked (i.e. completed at least one mission in). */
  locationsUnlocked: number;
  /** Total published locations available in the game. */
  totalLocations: number;
  /** Count of vocabulary tasks belonging to completed missions. */
  vocabularyCount: number;
  /** Every published task inside the missions the student has finished. */
  tasksCompleted: number;
  /** Those same tasks grouped into the three kinds of practice, biggest first. */
  taskFamilies: TaskFamilyCount[];
  /** Up to the five most recently completed missions, newest first. */
  recentActivity: RecentActivityItem[];
}

/**
 * Read-only progress summary for the parent dashboard.
 *
 * Joins `user_progress` (completed missions), `user_stats` (streaks),
 * `missions` (titles for recent activity) and `mission_tasks` (the tasks
 * actually played). Every figure is derived from missions actually marked
 * complete (`completed_at IS NOT NULL`), so the dashboard only ever reflects
 * real work.
 */
export async function getParentProgressSummary(
  db: SupabaseClient<Database>,
  profileId: string
): Promise<ParentProgressSummary> {
  const [progressRes, statsRes, totalLocationsRes] = await Promise.all([
    db
      .from("user_progress")
      .select("mission_id, location_id, completed_at, score, missions(title)")
      .eq("profile_id", profileId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false }),
    db
      .from("user_stats")
      .select("current_streak, longest_streak")
      .eq("profile_id", profileId)
      .maybeSingle(),
    db
      .from("locations")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true),
  ]);

  const completed = progressRes.data ?? [];

  const completedMissionIds = [...new Set(completed.map((row) => row.mission_id))];
  const unlockedLocationIds = new Set(completed.map((row) => row.location_id));

  let vocabularyCount = 0;
  let tasksCompleted = 0;
  const countsByFamily = new Map<TaskFamily, number>();

  if (completedMissionIds.length > 0) {
    const { data: tasks } = await db
      .from("mission_tasks")
      .select("task_type")
      .eq("is_published", true)
      .in("mission_id", completedMissionIds);

    for (const task of tasks ?? []) {
      tasksCompleted += 1;
      if (task.task_type === "vocabulary") vocabularyCount += 1;
      const family = taskFamilyOf(task.task_type);
      countsByFamily.set(family, (countsByFamily.get(family) ?? 0) + 1);
    }
  }

  const taskFamilies = TASK_FAMILIES.map((family) => ({
    family,
    count: countsByFamily.get(family) ?? 0,
  }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  const recentActivity: RecentActivityItem[] = completed.slice(0, 5).map((row) => ({
    missionId: row.mission_id,
    title: row.missions?.title ?? "Mission",
    // `completed_at` is guaranteed non-null by the query filter above.
    completedAt: row.completed_at as string,
    score: row.score,
  }));

  return {
    missionsCompleted: completed.length,
    currentStreak: statsRes.data?.current_streak ?? 0,
    longestStreak: statsRes.data?.longest_streak ?? 0,
    locationsUnlocked: unlockedLocationIds.size,
    totalLocations: totalLocationsRes.count ?? 0,
    vocabularyCount,
    tasksCompleted,
    taskFamilies,
    recentActivity,
  };
}
