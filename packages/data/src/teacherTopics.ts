import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";
import { buildTopicSources, type GrammarDraftTask, type TopicSource } from "@slay/core";

import {
  createHomeworkTopic,
  updateHomeworkTopic,
  type GuardedInsertResult,
  type GuardedWriteResult,
  type HomeworkTopicFields,
} from "./guardedWrites";
import { getTopicMessages, getUnreadCounts, type TopicMessage } from "./homework";

/* ── The topic form ────────────────────────────────────────────────────────── */

/** What the teacher typed, before validation. */
export interface TopicFormInput {
  title: string;
  description: string;
  noteLinkUrl: string;
  /** A public Storage URL from the image field, or empty. */
  noteImageUrl: string;
}

/** Parses an optional http(s) URL: empty is "none" (null), present-but-invalid is rejected (undefined). */
function parseOptionalUrl(raw: string): string | null | undefined {
  const value = raw.trim();
  if (value === "") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }
  return value;
}

/**
 * Upstream's `teacher/actions.ts` checks, in its order and words. The RPCs
 * re-check what matters in SQL; this gives a readable message first.
 */
export function parseTopicForm(
  input: TopicFormInput,
  orderIndex: number
): { ok: true; fields: HomeworkTopicFields } | { ok: false; error: string } {
  const title = input.title.trim();
  const description = input.description.trim();
  const noteLinkUrl = parseOptionalUrl(input.noteLinkUrl);
  const noteImageUrl = parseOptionalUrl(input.noteImageUrl);

  if (!title) return { ok: false, error: "Title is required." };
  if (!Number.isInteger(orderIndex) || orderIndex < 0) return { ok: false, error: "Order must be a non-negative whole number." };
  if (noteLinkUrl === undefined) return { ok: false, error: "Link must be a valid http(s) URL." };
  if (noteImageUrl === undefined) return { ok: false, error: "Image URL must be valid." };

  return { ok: true, fields: { title, description: description || null, orderIndex, noteLinkUrl, noteImageUrl } };
}

/** Upstream's `createHomeworkTopic` action: validate, then `create_homework_topic`. */
export async function createTopic(
  db: SupabaseClient<Database>,
  groupId: string,
  input: TopicFormInput,
  orderIndex: number
): Promise<GuardedInsertResult> {
  const parsed = parseTopicForm(input, orderIndex);
  if (!parsed.ok) return parsed;
  return createHomeworkTopic(db, groupId, parsed.fields);
}

/** Upstream's `updateHomeworkTopic` action. The group is not sent: a topic can't change group this way. */
export async function updateTopic(
  db: SupabaseClient<Database>,
  topicId: string,
  input: TopicFormInput,
  orderIndex: number
): Promise<GuardedWriteResult> {
  const parsed = parseTopicForm(input, orderIndex);
  if (!parsed.ok) return parsed;
  return updateHomeworkTopic(db, topicId, parsed.fields);
}

/* ── A group's topic list ──────────────────────────────────────────────────── */

export interface TeacherTopicRow {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  noteText: string | null;
  noteLinkUrl: string | null;
  noteImageUrl: string | null;
}

export interface TeacherTopicSummary extends TeacherTopicRow {
  wordCount: number;
  grammarCount: number;
  unreadCount: number;
}

export interface GroupTopicsData {
  group: { id: string; name: string };
  /** Newest first, as the student's Homework list orders them. */
  topics: TeacherTopicSummary[];
  /** One past the highest order in use — a new topic sorts above every other. */
  nextOrder: number;
}

const TOPIC_COLUMNS = "id, title, description, order_index, note_text, note_link_url, note_image_url";

type TopicDbRow = {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  note_text: string | null;
  note_link_url: string | null;
  note_image_url: string | null;
};

const toTopicRow = (t: TopicDbRow): TeacherTopicRow => ({
  id: t.id,
  title: t.title,
  description: t.description,
  orderIndex: t.order_index,
  noteText: t.note_text,
  noteLinkUrl: t.note_link_url,
  noteImageUrl: t.note_image_url,
});

/** The group, if it is this teacher's — null otherwise (upstream redirects home). */
async function ownGroup(db: SupabaseClient<Database>, groupId: string, teacherId: string) {
  const { data, error } = await db
    .from("teacher_groups")
    .select("id, name")
    .eq("id", groupId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function signedInId(db: SupabaseClient<Database>): Promise<string> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}

/**
 * The queries of upstream's `src/app/teacher/groups/[groupId]/page.tsx`: the
 * group's topics with their word and rule counts and unread Q&A. Null when
 * the group is not the signed-in teacher's.
 */
export async function loadGroupTopics(db: SupabaseClient<Database>, groupId: string): Promise<GroupTopicsData | null> {
  const teacherId = await signedInId(db);
  const group = await ownGroup(db, groupId, teacherId);
  if (!group) return null;

  const { data: topics, error } = await db
    .from("homework_topics")
    .select(TOPIC_COLUMNS)
    .eq("group_id", groupId)
    .order("order_index", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const topicRows = topics ?? [];
  const topicIds = topicRows.map((t) => t.id);
  const [wordsRes, pointsRes, unread] = await Promise.all([
    db.from("homework_vocab_words").select("topic_id").in("topic_id", topicIds),
    db.from("homework_grammar_points").select("topic_id").in("topic_id", topicIds),
    getUnreadCounts(db),
  ]);

  const count = (rows: { topic_id: string }[] | null) => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) counts.set(row.topic_id, (counts.get(row.topic_id) ?? 0) + 1);
    return counts;
  };
  const words = count(wordsRes.data);
  const points = count(pointsRes.data);

  return {
    group,
    topics: topicRows.map((t) => ({
      ...toTopicRow(t),
      wordCount: words.get(t.id) ?? 0,
      grammarCount: points.get(t.id) ?? 0,
      unreadCount: unread.get(t.id) ?? 0,
    })),
    // One past the highest index rather than the count: after a delete the count
    // can repeat an index still in use, and the new topic would not sort on top.
    nextOrder: topicRows.reduce((max, t) => Math.max(max, t.order_index + 1), 0),
  };
}

/* ── One topic ─────────────────────────────────────────────────────────────── */

export interface TeacherVocabWord {
  word: string;
  transcription: string | null;
  translation: string;
  imageUrl: string | null;
}

export interface TeacherGrammarPoint {
  title: string;
  explanation: string;
  example: string | null;
}

export interface CompletionRow {
  studentId: string;
  username: string;
  passed: boolean;
}

export interface TeacherTopicData {
  group: { id: string; name: string };
  topic: TeacherTopicRow;
  teacherId: string;
  vocabWords: TeacherVocabWord[];
  vocabTaskCount: number;
  grammarPoints: TeacherGrammarPoint[];
  grammarTasks: GrammarDraftTask[];
  vocabRows: CompletionRow[];
  grammarRows: CompletionRow[];
  /** Topics in this teacher's groups with content to copy from, never this one. */
  reuseSources: TopicSource[];
  messages: TopicMessage[];
  unreadCount: number;
}

/**
 * Port of upstream's `getReusableTopicSources`: every topic across this
 * teacher's groups that carries vocabulary or grammar, labelled by group, for
 * the "copy from another topic" picker.
 */
export async function getReusableTopicSources(
  db: SupabaseClient<Database>,
  teacherId: string,
  excludeTopicId?: string
): Promise<TopicSource[]> {
  const { data: groups } = await db.from("teacher_groups").select("id, name").eq("teacher_id", teacherId);
  if (!groups || groups.length === 0) return [];

  const { data: topics } = await db
    .from("homework_topics")
    .select("id, group_id, title, order_index")
    .in(
      "group_id",
      groups.map((g) => g.id)
    )
    .order("order_index", { ascending: true });
  const topicRows = topics ?? [];
  if (topicRows.length === 0) return [];

  const topicIds = topicRows.map((t) => t.id);
  const [wordsRes, pointsRes] = await Promise.all([
    db.from("homework_vocab_words").select("topic_id").in("topic_id", topicIds),
    db.from("homework_grammar_points").select("topic_id").in("topic_id", topicIds),
  ]);

  return buildTopicSources({
    topics: topicRows.map((t) => ({ id: t.id, groupId: t.group_id, title: t.title, orderIndex: t.order_index })),
    groupNames: new Map(groups.map((g) => [g.id, g.name])),
    vocabWordTopicIds: (wordsRes.data ?? []).map((r) => r.topic_id),
    grammarPointTopicIds: (pointsRes.data ?? []).map((r) => r.topic_id),
    excludeTopicId,
  });
}

/**
 * The queries of upstream's `src/app/teacher/groups/[groupId]/topics/[topicId]/page.tsx`:
 * the topic, its vocabulary and grammar, who in the group has passed each, the
 * topics to copy from, and the Q&A thread. Null when the group is not the
 * teacher's or the topic is not in it.
 */
export async function loadTeacherTopic(
  db: SupabaseClient<Database>,
  groupId: string,
  topicId: string
): Promise<TeacherTopicData | null> {
  const teacherId = await signedInId(db);
  const group = await ownGroup(db, groupId, teacherId);
  if (!group) return null;

  const { data: topic, error } = await db
    .from("homework_topics")
    .select(TOPIC_COLUMNS)
    .eq("id", topicId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) throw error;
  if (!topic) return null;

  const [
    vocabWordsRes,
    vocabTasksRes,
    grammarPointsRes,
    grammarTasksRes,
    membersRes,
    vocabCompletionsRes,
    grammarCompletionsRes,
    reuseSources,
    messages,
    unread,
  ] = await Promise.all([
    db
      .from("homework_vocab_words")
      .select("word, transcription, translation, image_url, order_index")
      .eq("topic_id", topicId)
      .order("order_index"),
    db.from("homework_vocab_tasks").select("id").eq("topic_id", topicId),
    db.from("homework_grammar_points").select("title, explanation, example, order_index").eq("topic_id", topicId).order("order_index"),
    db.from("homework_grammar_tasks").select("task_type, content, order_index").eq("topic_id", topicId).order("order_index"),
    // `teacher_group_members` with member usernames is the RLS-allowed path to student names.
    db.from("teacher_group_members").select("student_id, profiles(username)").eq("group_id", groupId),
    db.from("homework_vocab_completions").select("student_id").eq("topic_id", topicId),
    db.from("homework_grammar_completions").select("student_id").eq("topic_id", topicId),
    getReusableTopicSources(db, teacherId, topicId),
    getTopicMessages(db, topicId),
    getUnreadCounts(db),
  ]);

  const members = membersRes.data ?? [];
  const roster = (passedIds: { student_id: string }[] | null): CompletionRow[] => {
    const passed = new Set((passedIds ?? []).map((r) => r.student_id));
    return members.map((m) => ({ studentId: m.student_id, username: m.profiles?.username ?? "Unknown", passed: passed.has(m.student_id) }));
  };

  return {
    group,
    topic: toTopicRow(topic),
    teacherId,
    vocabWords: (vocabWordsRes.data ?? []).map((w) => ({
      word: w.word,
      transcription: w.transcription,
      translation: w.translation,
      imageUrl: w.image_url,
    })),
    vocabTaskCount: vocabTasksRes.data?.length ?? 0,
    grammarPoints: (grammarPointsRes.data ?? []).map((p) => ({ title: p.title, explanation: p.explanation, example: p.example })),
    grammarTasks: (grammarTasksRes.data ?? []).map((t) => ({ taskType: t.task_type, content: t.content })),
    vocabRows: roster(vocabCompletionsRes.data),
    grammarRows: roster(grammarCompletionsRes.data),
    reuseSources,
    messages,
    unreadCount: unread.get(topicId) ?? 0,
  };
}
