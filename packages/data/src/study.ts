import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";
import { summarizeStudyTime, utcDayKey, type StudyTimeSummary } from "@slay/core";

export type { StudyTimeSummary } from "@slay/core";

/**
 * How long one heartbeat of study time covers, in seconds. Kept in sync with
 * the clamp inside `record_study_time` (20260725000004_study_time.sql), which
 * refuses anything larger than two minutes.
 */
export const STUDY_HEARTBEAT_SECONDS = 30;

/**
 * Adds one heartbeat of study time to the signed-in student's day.
 *
 * All the real work — clamping the interval, ignoring non-students, folding
 * the value into the (student, day) row — happens inside `record_study_time`;
 * the client has no write grant on the table. Failures are swallowed on
 * purpose: a lost heartbeat costs half a minute of reporting accuracy and must
 * never interrupt a child mid-mission.
 */
export async function recordStudyTime(
  db: SupabaseClient<Database>,
  seconds: number
): Promise<void> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return;

  await db.rpc("record_study_time", { p_seconds: Math.round(seconds) });
}

/**
 * How long a profile has spent on learning screens — today, over the last
 * seven days, and in total.
 *
 * Reads `study_time_daily` directly: RLS decides whose rows are visible (own,
 * a linked student's, a taught student's), so a caller who may not see them
 * gets an empty summary rather than an error.
 */
export async function getStudyTimeSummary(
  db: SupabaseClient<Database>,
  profileId: string
): Promise<StudyTimeSummary> {
  const { data } = await db
    .from("study_time_daily")
    .select("day, seconds")
    .eq("profile_id", profileId);

  return summarizeStudyTime(data ?? [], utcDayKey(new Date()));
}
