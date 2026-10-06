import { describe, expect, it, vi } from "vitest";

import { getLinkedStudent, getParentProgressSummary, linkStudentByEmail } from "./parent";

describe("linkStudentByEmail", () => {
  it("calls link_student_by_email with the student's email", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ linked: true, reason: "ok", student_id: "student-1" }],
      error: null,
    });
    const db = { rpc } as never;

    expect(await linkStudentByEmail(db, "kid@example.com")).toEqual({
      linked: true,
      studentId: "student-1",
    });
    expect(rpc).toHaveBeenCalledWith("link_student_by_email", { p_student_email: "kid@example.com" });
  });

  it("reports the reason when the student hasn't registered yet", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ linked: false, reason: "student_not_registered", student_id: null }],
      error: null,
    });
    const db = { rpc } as never;

    expect(await linkStudentByEmail(db, "kid@example.com")).toEqual({
      linked: false,
      reason: "student_not_registered",
    });
  });

  it("propagates an RPC error as the reason", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const db = { rpc } as never;

    expect(await linkStudentByEmail(db, "kid@example.com")).toEqual({ linked: false, reason: "boom" });
  });
});

describe("getLinkedStudent", () => {
  it("returns null when no link exists", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [] }) }),
        }),
      }),
    });
    const db = { from } as never;

    expect(await getLinkedStudent(db, "parent-1")).toBeNull();
  });

  it("resolves the linked student's profile", async () => {
    const from = vi.fn((table: string) => {
      if (table === "parent_student_links") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => Promise.resolve({ data: [{ student_id: "student-1" }] }) }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { username: "Kid", level: "beginner" } }),
          }),
        }),
      };
    });
    const db = { from } as never;

    expect(await getLinkedStudent(db, "parent-1")).toEqual({
      id: "student-1",
      username: "Kid",
      level: "beginner",
    });
  });
});

describe("getParentProgressSummary", () => {
  it("summarises completed missions, streaks and task families", async () => {
    const from = vi.fn((table: string) => {
      if (table === "user_progress") {
        return {
          select: () => ({
            eq: () => ({
              not: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      {
                        mission_id: "m1",
                        location_id: "l1",
                        completed_at: "2026-10-01T00:00:00Z",
                        score: 90,
                        missions: { title: "Greetings" },
                      },
                    ],
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "user_stats") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { current_streak: 3, longest_streak: 7 } }),
            }),
          }),
        };
      }
      if (table === "locations") {
        return { select: () => ({ eq: () => Promise.resolve({ count: 12 }) }) };
      }
      // mission_tasks
      return {
        select: () => ({
          eq: () => ({ in: () => Promise.resolve({ data: [{ task_type: "vocabulary" }, { task_type: "quiz" }] }) }),
        }),
      };
    });
    const db = { from } as never;

    const summary = await getParentProgressSummary(db, "student-1");

    expect(summary.missionsCompleted).toBe(1);
    expect(summary.currentStreak).toBe(3);
    expect(summary.longestStreak).toBe(7);
    expect(summary.locationsUnlocked).toBe(1);
    expect(summary.totalLocations).toBe(12);
    expect(summary.vocabularyCount).toBe(1);
    expect(summary.tasksCompleted).toBe(2);
    expect(summary.recentActivity).toEqual([
      { missionId: "m1", title: "Greetings", completedAt: "2026-10-01T00:00:00Z", score: 90 },
    ]);
    expect(summary.taskFamilies.map((f) => f.family)).toEqual(["words", "sentences"]);
  });

  it("skips the mission_tasks lookup when nothing is completed", async () => {
    const missionTasks = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === "user_progress") {
        return { select: () => ({ eq: () => ({ not: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }) };
      }
      if (table === "user_stats") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
      }
      if (table === "locations") {
        return { select: () => ({ eq: () => Promise.resolve({ count: 0 }) }) };
      }
      missionTasks();
      return { select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [] }) }) }) };
    });
    const db = { from } as never;

    const summary = await getParentProgressSummary(db, "student-1");

    expect(missionTasks).not.toHaveBeenCalled();
    expect(summary.tasksCompleted).toBe(0);
    expect(summary.taskFamilies).toEqual([]);
  });
});
