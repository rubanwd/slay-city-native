import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";

import { getParentProgressSummary } from "./parent";
import { getLatestPlacementAttempts, type PlacementAttemptSummary } from "./placement";

/** One topic's pass state for a given student. */
export interface TeacherTopicResult {
  topicId: string;
  title: string;
  /** True when the student has passed every module (vocabulary/grammar) the topic has. */
  passed: boolean;
}

export interface TeacherGroupStudent {
  id: string;
  username: string;
  /** Total missions the student has completed across the map. */
  missionsCompleted: number;
  /** Per-topic pass results for this group's homework topics (only topics with content). */
  topicResults: TeacherTopicResult[];
  /** The student's latest placement-test result, or null if they never took it. */
  placement: PlacementAttemptSummary | null;
}

export interface TeacherGroup {
  id: string;
  name: string;
  students: TeacherGroupStudent[];
}

/**
 * Port of upstream's `teacher/queries.ts` `getTeacherGroups`: a teacher's
 * groups with their students. Each student shows their completed missions
 * and, per homework topic in the group, whether they passed it — every
 * module the topic has (vocabulary and/or grammar) completed. Topics with no
 * content yet are left out: there is nothing to pass.
 *
 * `teacher_groups_select_own_or_admin` (`teacher_id = auth.uid()`) is what
 * keeps a teacher to their own groups; the filter on `teacherId` here only
 * says which teacher, it is not the boundary.
 */
export async function getTeacherGroups(db: SupabaseClient<Database>, teacherId: string): Promise<TeacherGroup[]> {
  const { data: groups, error } = await db
    .from("teacher_groups")
    .select("id, name, created_at")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: true });
  // A failed read must not look like a teacher with no groups.
  if (error) throw error;
  if (!groups || groups.length === 0) return [];

  const groupIds = groups.map((group) => group.id);

  const [{ data: members }, { data: topics }] = await Promise.all([
    db.from("teacher_group_members").select("group_id, student_id, profiles(username)").in("group_id", groupIds),
    db
      .from("homework_topics")
      .select("id, group_id, title, order_index")
      .in("group_id", groupIds)
      // Newest first, like every other topic list.
      .order("order_index", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const topicRows = topics ?? [];
  const topicIds = topicRows.map((t) => t.id);

  // Which modules each topic has, and every student's passes across all topics.
  const [vocabWordsRes, grammarPointsRes, vocabComplRes, grammarComplRes] =
    topicIds.length > 0
      ? await Promise.all([
          db.from("homework_vocab_words").select("topic_id").in("topic_id", topicIds),
          db.from("homework_grammar_points").select("topic_id").in("topic_id", topicIds),
          db.from("homework_vocab_completions").select("topic_id, student_id").in("topic_id", topicIds),
          db.from("homework_grammar_completions").select("topic_id, student_id").in("topic_id", topicIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const topicsWithVocab = new Set((vocabWordsRes.data ?? []).map((r) => r.topic_id));
  const topicsWithGrammar = new Set((grammarPointsRes.data ?? []).map((r) => r.topic_id));
  const vocabPass = new Set((vocabComplRes.data ?? []).map((r) => `${r.topic_id}:${r.student_id}`));
  const grammarPass = new Set((grammarComplRes.data ?? []).map((r) => `${r.topic_id}:${r.student_id}`));

  // Topics that actually have something to pass, grouped by their group.
  const topicsByGroup = new Map<string, { id: string; title: string }[]>();
  for (const t of topicRows) {
    if (!topicsWithVocab.has(t.id) && !topicsWithGrammar.has(t.id)) continue;
    const list = topicsByGroup.get(t.group_id) ?? [];
    list.push({ id: t.id, title: t.title });
    topicsByGroup.set(t.group_id, list);
  }

  const membersByGroup = new Map<string, { studentId: string; username: string }[]>();
  for (const row of members ?? []) {
    const list = membersByGroup.get(row.group_id) ?? [];
    list.push({ studentId: row.student_id, username: row.profiles?.username ?? "Unknown" });
    membersByGroup.set(row.group_id, list);
  }

  const topicResultsFor = (groupId: string, studentId: string): TeacherTopicResult[] =>
    (topicsByGroup.get(groupId) ?? []).map((topic) => {
      const key = `${topic.id}:${studentId}`;
      const needsVocab = topicsWithVocab.has(topic.id);
      const needsGrammar = topicsWithGrammar.has(topic.id);
      const passed = (!needsVocab || vocabPass.has(key)) && (!needsGrammar || grammarPass.has(key));
      return { topicId: topic.id, title: topic.title, passed };
    });

  const studentIds = [...new Set((members ?? []).map((row) => row.student_id))];
  const [placementByStudent, progress] = await Promise.all([
    getLatestPlacementAttempts(db, studentIds),
    // One summary per student, shared when a student sits in two of this teacher's groups.
    Promise.all(studentIds.map(async (id) => [id, await getParentProgressSummary(db, id)] as const)).then(
      (entries) => new Map(entries),
    ),
  ]);

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    students: (membersByGroup.get(group.id) ?? []).map((member) => ({
      id: member.studentId,
      username: member.username,
      missionsCompleted: progress.get(member.studentId)?.missionsCompleted ?? 0,
      topicResults: topicResultsFor(group.id, member.studentId),
      placement: placementByStudent.get(member.studentId) ?? null,
    })),
  }));
}

export interface TeacherDashboardData {
  groups: TeacherGroup[];
  /** Display name chosen at signup; null only for profiles predating onboarding. */
  username: string | null;
  email: string | null;
}

/** The queries of upstream's `src/app/teacher/page.tsx`, for the signed-in teacher. */
export async function loadTeacherDashboard(db: SupabaseClient<Database>): Promise<TeacherDashboardData> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const [groups, profileRes] = await Promise.all([
    getTeacherGroups(db, user.id),
    db.from("profiles").select("username").eq("id", user.id).maybeSingle(),
  ]);
  return { groups, username: profileRes.data?.username ?? null, email: user.email ?? null };
}
