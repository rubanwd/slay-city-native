import { callRpc, firstRow, type Db } from "./rpc";

export type HomeworkCompletion = Awaited<ReturnType<typeof callRpc<"complete_homework_vocab">>>[number];
export type UnreadTopic = Awaited<ReturnType<typeof callRpc<"get_unread_topics">>>[number];
export type TopicMessage = Awaited<ReturnType<typeof callRpc<"get_topic_messages">>>[number];

export async function completeHomeworkVocab(db: Db, topicId: string): Promise<HomeworkCompletion> {
  const rows = await callRpc(db, "complete_homework_vocab", { p_topic_id: topicId });
  return firstRow(rows, "complete_homework_vocab");
}

export async function completeHomeworkGrammar(db: Db, topicId: string): Promise<HomeworkCompletion> {
  const rows = await callRpc(db, "complete_homework_grammar", { p_topic_id: topicId });
  return firstRow(rows, "complete_homework_grammar");
}

export async function getUnreadTopics(db: Db): Promise<UnreadTopic[]> {
  return callRpc(db, "get_unread_topics");
}

export async function getTopicMessages(db: Db, topicId: string): Promise<TopicMessage[]> {
  return callRpc(db, "get_topic_messages", { p_topic_id: topicId });
}
