import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TeacherGroup } from "@slay/data";

import { TeacherDashboard } from "./TeacherDashboard";
import { TeacherDashboardLoader } from "./TeacherDashboardLoader";

const data = vi.hoisted(() => ({ loadTeacherDashboard: vi.fn(), signOut: vi.fn() }));
const supabase = vi.hoisted(() => ({}));
const nav = vi.hoisted(() => ({ push: vi.fn(), navigate: vi.fn() }));

vi.mock("@slay/data", () => data);
vi.mock("expo-router", () => ({ useRouter: () => nav }));
vi.mock("~/lib/supabase", () => ({ supabase }));
vi.mock("~/features/auth", () => ({ SignOutButton: () => <button>Log Out</button> }));

afterEach(() => {
  vi.clearAllMocks();
});

function withQueries(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
}

const groups: TeacherGroup[] = [
  {
    id: "g1",
    name: "5-A",
    students: [
      {
        id: "s1",
        username: "anna",
        missionsCompleted: 7,
        topicResults: [
          { topicId: "t1", title: "Animals", passed: true },
          { topicId: "t2", title: "Food", passed: false },
        ],
        placement: { totalCorrect: 30, totalQuestions: 40, levelScores: [], recommendedLevel: "elementary", takenAt: "2026-10-01T10:00:00Z" },
      },
      { id: "s2", username: "bo", missionsCompleted: 0, topicResults: [], placement: null },
    ],
  },
  { id: "g2", name: "6-B", students: [] },
];

describe("TeacherDashboard", () => {
  it("shows each group with its students' key numbers", () => {
    withQueries(<TeacherDashboard groups={groups} username="ms_kate" email="kate@school.org" />);
    expect(screen.getByText("ms_kate")).toBeTruthy();
    expect(screen.getByText("2 groups")).toBeTruthy();
    expect(screen.getByText("5-A")).toBeTruthy();
    expect(screen.getByText("2 students")).toBeTruthy();
    expect(screen.getByRole("button", { name: "anna, topics 1 of 2, 7 missions" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "bo, 0 missions" })).toBeTruthy();
    expect(screen.getByText("No students in this group yet.")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "5-A homework" }));
    expect(nav.push).toHaveBeenCalledWith({ pathname: "/teacher/groups/[groupId]", params: { groupId: "g1" } });
  });

  it("expands a student to their level test and topic passes", () => {
    withQueries(<TeacherDashboard groups={groups} username="ms_kate" email={null} />);
    const anna = screen.getByRole("button", { name: /^anna/ });
    expect(anna.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(anna);
    expect(anna.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/Elementary \(30\/\s*40\) · 01\/10\/2026/)).toBeTruthy();
    expect(screen.getByLabelText("Animals, passed")).toBeTruthy();
    expect(screen.getByLabelText("Food, not passed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^bo/ }));
    expect(screen.getByText("not taken yet", { exact: false })).toBeTruthy();
    expect(screen.getByText("No homework topics yet.")).toBeTruthy();
  });

  it("says when no groups are assigned", () => {
    withQueries(<TeacherDashboard groups={[]} username={null} email="kate@school.org" />);
    expect(screen.getByText("kate@school.org")).toBeTruthy();
    expect(screen.getByText("No groups assigned yet")).toBeTruthy();
  });

  it("logs out", async () => {
    data.signOut.mockResolvedValue({ ok: true });
    withQueries(<TeacherDashboard groups={[]} username="ms_kate" email={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
    await waitFor(() => expect(data.signOut).toHaveBeenCalledWith(supabase));
  });
});

describe("TeacherDashboardLoader", () => {
  it("loads the dashboard, and offers a retry when it can't", async () => {
    data.loadTeacherDashboard.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ groups, username: "ms_kate", email: null });
    withQueries(<TeacherDashboardLoader />);
    expect(await screen.findByText(/Could not load your groups/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("5-A")).toBeTruthy();
  });
});
