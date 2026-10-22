import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ParentDashboardData } from "@slay/data";

import { ParentDashboard } from "./ParentDashboard";

const data = vi.hoisted(() => ({ signOut: vi.fn() }));
const supabase = vi.hoisted(() => ({}));
vi.mock("@slay/data", () => data);
vi.mock("~/lib/supabase", () => ({ supabase }));
vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));

afterEach(() => {
  vi.clearAllMocks();
});

function withQueries(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

const dashboard: ParentDashboardData = {
  student: { id: "s1", username: "anna", level: "elementary", mascotImageUrl: "/wardrobe/hat-crown.webp", xp: 340, coins: 85, lastActivityDate: "2026-10-21" },
  progress: {
    missionsCompleted: 12,
    currentStreak: 3,
    longestStreak: 7,
    locationsUnlocked: 4,
    totalLocations: 10,
    vocabularyCount: 46,
    tasksCompleted: 60,
    taskFamilies: [{ family: "words", count: 30 }],
    recentActivity: [{ missionId: "m1", title: "Buy some bread", completedAt: "2026-10-21T10:00:00Z", score: 90 }],
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
  placement: { totalCorrect: 31, totalQuestions: 40, levelScores: [{ level: "beginner", correct: 10, total: 10, passed: true }], recommendedLevel: "elementary", takenAt: "2026-10-12T10:00:00Z" },
};

describe("ParentDashboard", () => {
  it("shows the linked student's progress", () => {
    withQueries(<ParentDashboard locale="en" studentEmail="anna@school.org" data={dashboard} />);
    expect(screen.getByText("anna's progress")).toBeTruthy();
    expect(screen.getByLabelText("Today's look")).toBeTruthy();
    expect(screen.getByLabelText("Vocabulary Learned: 46 Words")).toBeTruthy();
    expect(screen.getByText("31 of 40 answers right")).toBeTruthy();
    expect(screen.getByText("15 min")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("4 of 10 locations unlocked")).toBeTruthy();
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.getByText("✓ Vocabulary · 10 words")).toBeTruthy();
    expect(screen.getByText("Buy some bread")).toBeTruthy();
    expect(screen.getByText("90%")).toBeTruthy();
  });

  it("speaks the parent's language, leaving authored content as written", () => {
    withQueries(<ParentDashboard locale="uk" studentEmail="anna@school.org" data={dashboard} />);
    expect(screen.getByText("Прогрес: anna")).toBeTruthy();
    expect(screen.getByText("Buy some bread")).toBeTruthy();
    expect(screen.getByText("Animals")).toBeTruthy();
  });

  it("explains why nothing is shown before a student is linked", () => {
    withQueries(<ParentDashboard locale="en" studentEmail="anna@school.org" pendingReason="student_not_registered" />);
    expect(screen.getByText("No student progress yet")).toBeTruthy();
    expect(screen.getByText(/"anna@school.org" hasn't joined Slay City yet/)).toBeTruthy();
  });

  it("logs out", async () => {
    data.signOut.mockResolvedValue({ ok: true });
    withQueries(<ParentDashboard locale="en" studentEmail={null} pendingReason="no_email" />);
    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
    await waitFor(() => expect(data.signOut).toHaveBeenCalledWith(supabase));
  });
});
