import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, KnowledgeLevel } from "@slay/core/types";
import {
  DEFAULT_KNOWLEDGE_LEVEL,
  isKnowledgeLevel,
  newestTopicsFirst,
  toHomeworkTopicProgress,
  type HomeworkTopicProgress,
  type MapDistrictViewModel,
} from "@slay/core";

import { loadMapPreview } from "./mapPreview";
import { getLinkedStudent, getParentProgressSummary, linkStudentByEmail, type ParentProgressSummary } from "./parent";
import { getLatestPlacementAttempt, type PlacementAttemptSummary } from "./placement";
import { getStudyTimeSummary, type StudyTimeSummary } from "./study";
import { loadMascotImage } from "./wardrobe";

/** Who the student is right now — identity, level and the rewards they hold. */
export interface StudentSnapshot {
  id: string;
  username: string | null;
  /** The English level the student chose for themselves. */
  level: KnowledgeLevel;
  /** The look they wear — their equipped wardrobe item, or the plain snake. */
  mascotImageUrl: string;
  xp: number;
  coins: number;
  /** Last day the streak job saw activity (`YYYY-MM-DD`), or null before the first. */
  lastActivityDate: string | null;
}

export interface ParentDashboardData {
  student: StudentSnapshot;
  progress: ParentProgressSummary;
  studyTime: StudyTimeSummary;
  homework: HomeworkTopicProgress[];
  /** Latest placement result; null if never taken. */
  placement: PlacementAttemptSummary | null;
}

/**
 * Port of upstream's `parent/queries.ts` `getParentDashboardData`: everything
 * the parent dashboard shows about one student, in one pass. Each piece is
 * behind its own RLS rule or SECURITY DEFINER check, so a caller who is not
 * this student's parent gets empty sections, never another family's data.
 */
export async function getParentDashboardData(db: SupabaseClient<Database>, studentId: string): Promise<ParentDashboardData> {
  const [profileRes, statsRes, mascotImageUrl, progress, studyTime, homeworkRes, placement] = await Promise.all([
    db.from("profiles").select("username, level").eq("id", studentId).maybeSingle(),
    db.from("user_stats").select("xp, coins, last_activity_date").eq("profile_id", studentId).maybeSingle(),
    loadMascotImage(db, studentId),
    getParentProgressSummary(db, studentId),
    getStudyTimeSummary(db, studentId),
    db.rpc("parent_student_homework", { p_student_id: studentId }),
    getLatestPlacementAttempt(db, studentId),
  ]);

  return {
    student: {
      id: studentId,
      username: profileRes.data?.username ?? null,
      level: isKnowledgeLevel(profileRes.data?.level) ? profileRes.data.level : DEFAULT_KNOWLEDGE_LEVEL,
      mascotImageUrl,
      xp: statsRes.data?.xp ?? 0,
      coins: statsRes.data?.coins ?? 0,
      lastActivityDate: statsRes.data?.last_activity_date ?? null,
    },
    progress,
    studyTime,
    homework: newestTopicsFirst(homeworkRes.data ?? []).map(toHomeworkTopicProgress),
    placement,
  };
}

/** Why no student progress is shown yet — `link_student_by_email`'s reason codes, plus `no_email`. */
export type PendingReason = "student_not_registered" | "student_no_profile" | "not_a_student" | "no_email" | string;

export type ParentDashboardState =
  | { kind: "pending"; studentEmail: string | null; reason: PendingReason }
  | { kind: "linked"; studentEmail: string | null; data: ParentDashboardData };

/**
 * The queries of upstream's `src/app/parent/page.tsx`: the parent's linked
 * student, or — the student may register before or after the parent — an
 * attempt to link by the email the parent signed up with
 * (`user_metadata.student_email`), every visit, until it succeeds. Until then
 * the dashboard says why, rather than showing zeros.
 */
export async function loadParentDashboard(db: SupabaseClient<Database>): Promise<ParentDashboardState> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const studentEmail = typeof user.user_metadata?.student_email === "string" ? (user.user_metadata.student_email as string) : null;

  const { data: links, error } = await db
    .from("parent_student_links")
    .select("student_id")
    .eq("parent_id", user.id)
    .order("created_at")
    .limit(1);
  if (error) throw error;

  let studentId = links?.[0]?.student_id ?? null;
  let reason: PendingReason = studentId ? "ok" : studentEmail ? "student_not_registered" : "no_email";

  if (!studentId && studentEmail) {
    const result = await linkStudentByEmail(db, studentEmail);
    if (result.linked) studentId = result.studentId;
    else reason = result.reason;
  }

  if (!studentId) return { kind: "pending", studentEmail, reason };
  return { kind: "linked", studentEmail, data: await getParentDashboardData(db, studentId) };
}

export interface ParentMapData {
  districts: MapDistrictViewModel[];
  level: KnowledgeLevel;
  /** The linked student's name for the ✓ line; null before one is linked. */
  studentName: string | null;
  linked: boolean;
}

/**
 * Upstream's `src/app/parent/map/page.tsx`: the city at the *student's* level,
 * with what they have finished marked ✓. Before a student is linked, the
 * default level with no progress on it.
 */
export async function loadParentMap(db: SupabaseClient<Database>): Promise<ParentMapData> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const student = await getLinkedStudent(db, user.id);
  const level = student?.level ?? DEFAULT_KNOWLEDGE_LEVEL;
  return {
    districts: await loadMapPreview(db, level, student ? [student.id] : []),
    level,
    studentName: student?.username ?? null,
    linked: student !== null,
  };
}
