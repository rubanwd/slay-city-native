import { Redirect, useLocalSearchParams } from "expo-router";

import type { ParentDashboardData } from "@slay/data";

import { ParentDashboard, ParentProfileScreen } from "~/features/parent";

const DASHBOARD: ParentDashboardData = {
  student: {
    id: "s1",
    username: "anna",
    level: "elementary",
    mascotImageUrl: "/wardrobe/hat-crown.webp",
    xp: 340,
    coins: 85,
    lastActivityDate: "2026-10-21",
  },
  progress: {
    missionsCompleted: 12,
    currentStreak: 3,
    longestStreak: 7,
    locationsUnlocked: 4,
    totalLocations: 10,
    vocabularyCount: 46,
    tasksCompleted: 60,
    taskFamilies: [{ family: "words", count: 30 }],
    recentActivity: [
      { missionId: "m1", title: "Buy some bread", completedAt: "2026-10-21T10:00:00Z", score: 90 },
    ],
  },
  studyTime: {
    todaySeconds: 900,
    weekSeconds: 5400,
    totalSeconds: 36000,
    week: [
      { day: "2026-10-15", seconds: 0 },
      { day: "2026-10-16", seconds: 600 },
      { day: "2026-10-17", seconds: 1200 },
      { day: "2026-10-18", seconds: 0 },
      { day: "2026-10-19", seconds: 1800 },
      { day: "2026-10-20", seconds: 900 },
      { day: "2026-10-21", seconds: 900 },
    ],
  },
  homework: [
    {
      topicId: "t1",
      title: "Animals",
      groupName: "5-A",
      teacherUsername: "ms_kate",
      wordCount: 10,
      grammarCount: 1,
      vocabCompletedAt: "2026-10-20T10:00:00Z",
      grammarCompletedAt: null,
      started: true,
      passed: false,
    },
  ],
  placement: {
    totalCorrect: 31,
    totalQuestions: 40,
    levelScores: [{ level: "beginner", correct: 10, total: 10, passed: true }],
    recommendedLevel: "elementary",
    takenAt: "2026-10-12T10:00:00Z",
  },
};

/**
 * The parent dashboard with a made-up student and no backend; `?locale=uk|ru`
 * to see it translated, `?screen=pending` for the not-linked state,
 * `?screen=profile` for the parent's profile (`&student=none` before a link).
 * Dev-only.
 */
export default function ParentPreviewScreen() {
  const { screen, locale, student } = useLocalSearchParams<{ screen?: string; locale?: string; student?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  const language = locale === "uk" || locale === "ru" ? locale : "en";
  if (screen === "profile")
    return (
      <ParentProfileScreen
        username="mum"
        email="mum@home.org"
        student={student === "none" ? null : { username: "anna", level: "elementary" }}
        locale={language}
        manualLocale={language !== "en"}
        detectedLocale="en"
        onChooseLocale={() => {}}
      />
    );
  if (screen === "pending")
    return (
      <ParentDashboard
        locale={language}
        studentEmail="anna@school.org"
        pendingReason="student_not_registered"
      />
    );
  return <ParentDashboard locale={language} studentEmail="anna@school.org" data={DASHBOARD} />;
}
