import { Redirect, useLocalSearchParams } from "expo-router";

import type { GroupTopicsData, TeacherGroup, TeacherTopicData } from "@slay/data";

import { CityMapPreview } from "~/features/map";
import { GrammarManager, GroupTopicsScreen, ReviewLocationScreen, TeacherDashboard, TeacherTopicScreen, VocabularyManager } from "~/features/teacher";

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
 * `?screen=group|topic|map|location` for a group's topics, one topic, the
 * city map preview and a stop's missions in review. Dev-only.
 */
export default function TeacherPreviewScreen() {
  const { screen } = useLocalSearchParams<{ screen?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  if (screen === "group") return <GroupTopicsScreen {...TOPICS} />;
  if (screen === "map")
    return (
      <CityMapPreview
        districts={[
          {
            id: "d1",
            name: "Old Town",
            orderIndex: 0,
            backgroundUrl: null,
            locations: [
              { id: "l1", name: "Bakery", description: "Bread, rolls and a very busy baker.", mapX: 30, mapY: 35, iconUrl: null, orderIndex: 0, state: "available", missionId: null, missionsCompleted: 0, totalMissions: 3, totalXp: 60, totalCoins: 15 },
              { id: "l2", name: "Park", description: null, mapX: 65, mapY: 60, iconUrl: null, orderIndex: 1, state: "available", missionId: null, missionsCompleted: 0, totalMissions: 2, totalXp: 40, totalCoins: 10 },
            ],
          },
          { id: "d2", name: "Harbour", orderIndex: 1, backgroundUrl: null, locations: [] },
        ] as never}
        levelName="Elementary"
        subtitle="Every district and mission"
        locationHref={(locationId) => ({ pathname: "/teacher/location/[locationId]", params: { locationId } })}
      />
    );
  if (screen === "location")
    return (
      <ReviewLocationScreen
        location={{ id: "l1", name: "Bakery", description: "Bread, rolls and a very busy baker.", districtName: "Old Town" }}
        missions={[
          { id: "m1", title: "Buy some bread", description: "Shopping words" },
          { id: "m2", title: "Count the rolls", description: "Numbers 1–20" },
          { id: "m3", title: "Thank the baker", description: null },
        ]}
      />
    );
  if (screen === "topic")
    return (
      <TeacherTopicScreen
        {...TOPIC}
        vocabularyEditor={
          <VocabularyManager
            topicId="t1"
            groupId="g1"
            initialWords={TOPIC.vocabWords}
            initialTaskCount={TOPIC.vocabTaskCount}
            reuseSources={[{ topicId: "t9", title: "Pets", groupName: "6-B · Thursday", wordCount: 8, pointCount: 0 }]}
          />
        }
        grammarEditor={
          <GrammarManager
            topicId="t1"
            groupId="g1"
            initialPoints={TOPIC.grammarPoints}
            initialTasks={[
              { taskType: "quiz", content: { question: "One cat, two ___.", options: ["cats", "cat", "cates"], correctIndex: 0 } },
              { taskType: "fill_blank", content: { sentence: "I have three ___.", answer: "dogs" } },
            ]}
            reuseSources={[]}
          />
        }
      />
    );
  return <TeacherDashboard groups={GROUPS} username="ms_kate" email="kate@school.org" />;
}
