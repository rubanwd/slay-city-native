import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";
import type { HomeworkGrammarPoint, HomeworkWord, MissionTaskViewModel } from "@slay/core";

import { getMyGroups, getTopicMessages, getUnreadCounts, type TopicMessage } from "./homework";

/** One topic card on the homework list. */
export interface HomeworkTopicSummary {
  id: string;
  title: string;
  description: string | null;
  /** Who assigned this topic — shown per card since a student can be in more than one group. */
  teacherUsername: string;
  /** How many learning modules (vocabulary, grammar) the topic has. */
  totalModules: number;
  /** How many of those modules the student has passed. */
  passedModules: number;
  /** Unread Q&A messages in this topic's thread. */
  unreadCount: number;
}

export interface HomeworkListData {
  /** Names of every group the student belongs to — almost always just one. */
  groupNames: string[];
  topics: HomeworkTopicSummary[];
}

/**
 * The homework list — the queries of upstream's server page
 * `src/app/homework/page.tsx`: every topic across every group the student is
 * in, newest first, with how many of its modules they've passed and how many
 * unread Q&A messages it has.
 */
export async function loadHomeworkList(db: SupabaseClient<Database>): Promise<HomeworkListData> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { groupNames: [], topics: [] };

  const groups = await getMyGroups(db);
  const groupNames = groups.map((g) => g.groupName);
  const teacherByGroup = new Map(groups.map((g) => [g.groupId, g.teacherUsername]));
  if (groups.length === 0) return { groupNames: [], topics: [] };

  const { data: topicRows, error } = await db
    .from("homework_topics")
    .select("id, group_id, title, description, order_index")
    .in(
      "group_id",
      groups.map((g) => g.groupId)
    )
    // Newest first: a teacher appends each new topic at the end of their
    // order, so the student sees the latest assignment at the top.
    .order("order_index", { ascending: false })
    .order("created_at", { ascending: false });
  // A failed read must not look like "no homework yet".
  if (error) throw error;

  const topics = topicRows ?? [];
  const topicIds = topics.map((t) => t.id);

  // A topic offers up to two learning modules (vocabulary, grammar); progress
  // is how many of the present modules the student has passed.
  const [vocabWordsRes, grammarPointsRes, vocabPassRes, grammarPassRes] = await Promise.all([
    topicIds.length > 0
      ? db.from("homework_vocab_words").select("topic_id").in("topic_id", topicIds)
      : Promise.resolve({ data: [] as { topic_id: string }[] }),
    topicIds.length > 0
      ? db.from("homework_grammar_points").select("topic_id").in("topic_id", topicIds)
      : Promise.resolve({ data: [] as { topic_id: string }[] }),
    db.from("homework_vocab_completions").select("topic_id").eq("student_id", user.id),
    db.from("homework_grammar_completions").select("topic_id").eq("student_id", user.id),
  ]);

  const topicsWithVocab = new Set((vocabWordsRes.data ?? []).map((r) => r.topic_id));
  const topicsWithGrammar = new Set((grammarPointsRes.data ?? []).map((r) => r.topic_id));
  const vocabPassed = new Set((vocabPassRes.data ?? []).map((r) => r.topic_id));
  const grammarPassed = new Set((grammarPassRes.data ?? []).map((r) => r.topic_id));
  const unreadByTopic = await getUnreadCounts(db);

  return {
    groupNames,
    topics: topics.map((topic) => {
      const hasVocab = topicsWithVocab.has(topic.id);
      const hasGrammar = topicsWithGrammar.has(topic.id);
      return {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        teacherUsername: teacherByGroup.get(topic.group_id) ?? "your teacher",
        totalModules: (hasVocab ? 1 : 0) + (hasGrammar ? 1 : 0),
        passedModules:
          (hasVocab && vocabPassed.has(topic.id) ? 1 : 0) + (hasGrammar && grammarPassed.has(topic.id) ? 1 : 0),
        unreadCount: unreadByTopic.get(topic.id) ?? 0,
      };
    }),
  };
}

export interface HomeworkTopicNote {
  text: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
}

export interface HomeworkTopicData {
  topic: { id: string; title: string; description: string | null };
  /** Extra context the teacher attached — text, a link and/or an image, all optional. */
  note: HomeworkTopicNote;
  /** The signed-in student — the Q&A thread marks their own messages. */
  currentUserId: string;
  messages: TopicMessage[];
  /** The vocabulary set, when the teacher attached one. */
  vocab: { words: HomeworkWord[]; tasks: MissionTaskViewModel[]; passed: boolean } | null;
  /** The grammar set, when the teacher attached one. */
  grammar: { points: HomeworkGrammarPoint[]; tasks: MissionTaskViewModel[]; passed: boolean } | null;
}

const toTask = (task: { id: string; task_type: MissionTaskViewModel["taskType"]; order_index: number; content: MissionTaskViewModel["content"] }) => ({
  id: task.id,
  taskType: task.task_type,
  orderIndex: task.order_index,
  content: task.content,
});

/**
 * One homework topic — the queries of upstream's server page
 * `src/app/homework/[topicId]/page.tsx`. Null when the topic doesn't exist or
 * isn't in one of the student's groups: RLS (`homework_topics_select`) hides
 * it, which reads the same as missing (the web's `notFound()`).
 */
export async function loadHomeworkTopic(
  db: SupabaseClient<Database>,
  topicId: string
): Promise<HomeworkTopicData | null> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const [topicRes, vocabWordsRes, vocabTasksRes, vocabPassRes, grammarPointsRes, grammarTasksRes, grammarPassRes] =
    await Promise.all([
      db
        .from("homework_topics")
        .select("id, title, description, note_text, note_link_url, note_image_url")
        .eq("id", topicId)
        .maybeSingle(),
      db
        .from("homework_vocab_words")
        .select("id, word, transcription, translation, image_url, order_index")
        .eq("topic_id", topicId)
        .order("order_index"),
      db.from("homework_vocab_tasks").select("id, task_type, order_index, content").eq("topic_id", topicId).order("order_index"),
      db.from("homework_vocab_completions").select("id").eq("topic_id", topicId).eq("student_id", user.id).maybeSingle(),
      db
        .from("homework_grammar_points")
        .select("id, title, explanation, example, order_index")
        .eq("topic_id", topicId)
        .order("order_index"),
      db.from("homework_grammar_tasks").select("id, task_type, order_index, content").eq("topic_id", topicId).order("order_index"),
      db.from("homework_grammar_completions").select("id").eq("topic_id", topicId).eq("student_id", user.id).maybeSingle(),
    ]);

  if (topicRes.error) throw topicRes.error;
  const topic = topicRes.data;
  if (!topic) return null;

  const words: HomeworkWord[] = (vocabWordsRes.data ?? []).map((w) => ({
    id: w.id,
    word: w.word,
    transcription: w.transcription,
    translation: w.translation,
    imageUrl: w.image_url,
    orderIndex: w.order_index,
  }));
  const points: HomeworkGrammarPoint[] = (grammarPointsRes.data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    explanation: p.explanation,
    example: p.example,
    orderIndex: p.order_index,
  }));

  return {
    topic: { id: topic.id, title: topic.title, description: topic.description },
    note: { text: topic.note_text, linkUrl: topic.note_link_url, imageUrl: topic.note_image_url },
    currentUserId: user.id,
    messages: await getTopicMessages(db, topicId),
    vocab:
      words.length > 0
        ? { words, tasks: (vocabTasksRes.data ?? []).map(toTask), passed: Boolean(vocabPassRes.data) }
        : null,
    grammar:
      points.length > 0
        ? { points, tasks: (grammarTasksRes.data ?? []).map(toTask), passed: Boolean(grammarPassRes.data) }
        : null,
  };
}
