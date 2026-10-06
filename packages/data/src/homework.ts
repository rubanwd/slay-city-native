import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";

export type HomeworkTaskCompletionResult =
  | { ok: true; xpEarned: number; alreadyPassed: boolean }
  | { ok: false; error: string };

/**
 * Records that the signed-in student finished a topic's whole vocabulary flow
 * (all word cards + the test) and grants XP for a first-time pass. The reward
 * is applied inside the `complete_homework_vocab` SECURITY DEFINER function —
 * the client has no UPDATE grant on user_stats, so XP can only be added
 * server-side, and its unique completion row makes the grant idempotent
 * (replaying a passed topic returns `alreadyPassed` with `xpEarned: 0`).
 */
export async function completeHomeworkVocab(
  db: SupabaseClient<Database>,
  topicId: string
): Promise<HomeworkTaskCompletionResult> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to save your progress." };
  }

  const { data, error } = await db
    .rpc("complete_homework_vocab", { p_topic_id: topicId })
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, xpEarned: data.xp_earned, alreadyPassed: data.already_completed };
}

/**
 * Records that the signed-in student finished a topic's whole grammar flow
 * (all rule cards + the test) and grants XP for a first-time pass. Mirrors
 * {@link completeHomeworkVocab}: the `complete_homework_grammar` SECURITY
 * DEFINER function performs the idempotent XP grant server-side.
 */
export async function completeHomeworkGrammar(
  db: SupabaseClient<Database>,
  topicId: string
): Promise<HomeworkTaskCompletionResult> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to save your progress." };
  }

  const { data, error } = await db
    .rpc("complete_homework_grammar", { p_topic_id: topicId })
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, xpEarned: data.xp_earned, alreadyPassed: data.already_completed };
}

export interface MyGroup {
  groupId: string;
  groupName: string;
  teacherId: string;
  teacherUsername: string;
}

/**
 * The groups the signed-in student belongs to. Backed by the `my_groups()`
 * SECURITY DEFINER RPC — a student has no direct SELECT on
 * `teacher_group_members` or another user's `profiles` row, so this is the
 * only way to read either.
 */
export async function getMyGroups(db: SupabaseClient<Database>): Promise<MyGroup[]> {
  const { data } = await db.rpc("my_groups");
  return (data ?? []).map((row) => ({
    groupId: row.group_id,
    groupName: row.group_name,
    teacherId: row.teacher_id,
    teacherUsername: row.teacher_username,
  }));
}

/** Whether the student belongs to at least one teacher group — gates the Homework nav tab. */
export async function hasAnyGroup(db: SupabaseClient<Database>): Promise<boolean> {
  const groups = await getMyGroups(db);
  return groups.length > 0;
}

/** One message in a topic's shared Q&A thread, with its author resolved. */
export interface TopicMessage {
  id: string;
  authorId: string;
  authorUsername: string;
  authorIsTeacher: boolean;
  body: string;
  createdAt: string;
}

/**
 * The Q&A thread for one topic, newest last. Backed by the
 * `get_topic_messages()` SECURITY DEFINER RPC — the only path to another
 * user's username, since neither a student nor a teacher has direct SELECT on
 * other people's `profiles` rows.
 */
export async function getTopicMessages(
  db: SupabaseClient<Database>,
  topicId: string
): Promise<TopicMessage[]> {
  const { data } = await db.rpc("get_topic_messages", { p_topic_id: topicId });
  return (data ?? []).map((row) => ({
    id: row.id,
    authorId: row.author_id,
    authorUsername: row.author_username,
    authorIsTeacher: row.author_is_teacher,
    body: row.body,
    createdAt: row.created_at,
  }));
}

/**
 * How many unread Q&A messages the signed-in user has per topic, across every
 * topic they can see. Keyed by topic id; absent topics have none. Backed by
 * the `get_unread_topics()` RPC — "unread" means a message from someone else
 * newer than the user's last read of that topic.
 */
export async function getUnreadCounts(
  db: SupabaseClient<Database>
): Promise<Map<string, number>> {
  const { data } = await db.rpc("get_unread_topics");
  return new Map((data ?? []).map((row) => [row.topic_id, row.unread_count]));
}
