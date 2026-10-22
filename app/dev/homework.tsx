import { Redirect, useLocalSearchParams } from "expo-router";

import type { HomeworkTopicData } from "@slay/data";

import { HomeworkScreen, HomeworkTopicScreen } from "~/features/homework";

const TOPIC: HomeworkTopicData = {
  topic: { id: "t1", title: "Animals", description: "Pets and farm animals" },
  note: { text: "Read page 12 before you start. Listen to every word twice!", linkUrl: "https://example.com/animals", imageUrl: null },
  currentUserId: "me",
  messages: [
    { id: "m1", authorId: "t", authorUsername: "ms_kate", authorIsTeacher: true, body: "Any questions about the words?", createdAt: "2026-10-22T09:00:00Z" },
    { id: "m2", authorId: "me", authorUsername: "sam", authorIsTeacher: false, body: "How do you say «кролик»?", createdAt: "2026-10-22T09:05:00Z" },
    { id: "m3", authorId: "t", authorUsername: "ms_kate", authorIsTeacher: true, body: "Rabbit 🐰", createdAt: "2026-10-22T09:06:00Z" },
  ],
  vocab: {
    words: [
      { id: "w1", word: "cat", transcription: "/kæt/", translation: "кіт", imageUrl: null, orderIndex: 0 },
      { id: "w2", word: "rabbit", transcription: "/ˈræbɪt/", translation: "кролик", imageUrl: null, orderIndex: 1 },
    ],
    tasks: [{ id: "q1", taskType: "quiz", orderIndex: 0, content: { question: "Кролик is…", options: ["cat", "rabbit"], correctIndex: 1 } }],
    passed: false,
  },
  grammar: {
    points: [{ id: "g1", title: "Plural nouns", explanation: "Add -s to most nouns.\nSome change: mouse → mice.", example: "one cat, two cats", orderIndex: 0 }],
    tasks: [],
    passed: true,
  },
};

/**
 * The homework screens with made-up data and no backend — `?view=topic` shows
 * a topic, otherwise the list. Dev-only.
 */
export default function HomeworkPreviewScreen() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  if (!__DEV__) return <Redirect href="/" />;

  if (view === "topic") return <HomeworkTopicScreen {...TOPIC} />;
  return (
    <HomeworkScreen
      groupNames={["5-A"]}
      topics={[
        { id: "t2", title: "Food and drinks", description: "Fruit, vegetables and what we drink at breakfast", teacherUsername: "ms_kate", totalModules: 2, passedModules: 1, unreadCount: 2 },
        { id: "t1", title: "Animals", description: "Pets and farm animals", teacherUsername: "ms_kate", totalModules: 2, passedModules: 2, unreadCount: 0 },
        { id: "t0", title: "My family", description: null, teacherUsername: "ms_kate", totalModules: 0, passedModules: 0, unreadCount: 0 },
      ]}
    />
  );
}
