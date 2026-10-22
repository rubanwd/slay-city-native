import { Redirect } from "expo-router";

import type { TeacherGroup } from "@slay/data";

import { TeacherDashboard } from "~/features/teacher";

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

/** The teacher dashboard with made-up groups and no backend. Dev-only. */
export default function TeacherPreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <TeacherDashboard groups={GROUPS} username="ms_kate" email="kate@school.org" />;
}
