import { Redirect, useLocalSearchParams } from "expo-router";

import type { GroupTopicsData, TeacherGroup, TeacherTopicData } from "@slay/data";

import { GroupTopicsScreen, TeacherDashboard, TeacherTopicScreen } from "~/features/teacher";

const GROUPS: TeacherGroup[] = [
  {
    id: "g1",
    name: "5-A · Monday",
    students: [
      {
        id: "s1",
        username: "anna",
        missionsCompleted: 12,
        topicResults: [
          { topicId: "t1", title: "Animals", passed: true },
          { topicId: "t2", title: "Food & drinks", passed: true },
          { topicId: "t3", title: "Past Simple", passed: false },
        ],
        placement: { totalCorrect: 31, totalQuestions: 40, levelScores: [], recommendedLevel: "elementary", takenAt: "2026-10-12T10:00:00Z" },
      },
      { id: "s2", username: "bohdan", missionsCompleted: 4, topicResults: [{ topicId: "t1", title: "Animals", passed: false }], placement: null },
      { id: "s3", username: "sam_k", missionsCompleted: 27, topicResults: [], placement: null },
    ],
  },
  { id: "g2", name: "6-B · Thursday", students: [] },
];

const summary = (id: string, title: string, extra: Partial<GroupTopicsData["topics"][number]> = {}) => ({
  id,
  title,
  description: null,
  orderIndex: 0,
  noteText: null,
  noteLinkUrl: null,
  noteImageUrl: null,
  wordCount: 0,
  grammarCount: 0,
  unreadCount: 0,
  ...extra,
});

const TOPICS: GroupTopicsData = {
  group: { id: "g1", name: "5-A · Monday" },
  topics: [
    summary("t3", "Past Simple", { description: "Regular and irregular verbs", grammarCount: 3, unreadCount: 2 }),
    summary("t2", "Food & drinks", { wordCount: 14, noteLinkUrl: "https://example.com" }),
    summary("t1", "Animals", { wordCount: 10, grammarCount: 1 }),
  ],
  nextOrder: 3,
};

const TOPIC: TeacherTopicData = {
  group: TOPICS.group,
  topic: { id: "t1", title: "Animals", description: "Pets and farm animals", orderIndex: 0, noteText: null, noteLinkUrl: "https://example.com/animals", noteImageUrl: null },
  teacherId: "me",
  vocabWords: [
    { word: "cat", transcription: "/kæt/", translation: "кіт", imageUrl: null },
    { word: "rabbit", transcription: "/ˈræbɪt/", translation: "кролик", imageUrl: null },
  ],
  vocabTaskCount: 6,
  grammarPoints: [{ title: "Plural nouns", explanation: "Add -s to most nouns: cat → cats.", example: "Two cats." }],
  grammarTasks: [],
  vocabRows: [
    { studentId: "s1", username: "anna", passed: true },
    { studentId: "s2", username: "bohdan", passed: false },
  ],
  grammarRows: [
    { studentId: "s1", username: "anna", passed: false },
    { studentId: "s2", username: "bohdan", passed: false },
  ],
  reuseSources: [],
  messages: [],
  unreadCount: 1,
};

/**
 * The teacher console with made-up data and no backend: the dashboard, or
 * `?screen=group` / `?screen=topic` for a group's topics and one topic. Dev-only.
 */
export default function TeacherPreviewScreen() {
  const { screen } = useLocalSearchParams<{ screen?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  if (screen === "group") return <GroupTopicsScreen {...TOPICS} />;
  if (screen === "topic") return <TeacherTopicScreen {...TOPIC} />;
  return <TeacherDashboard groups={GROUPS} username="ms_kate" email="kate@school.org" />;
}
