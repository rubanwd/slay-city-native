import { describe, expect, it, vi } from "vitest";

import { getTeacherGroups, loadTeacherDashboard } from "./teacherDashboard";

type Result = { data: unknown; error?: unknown; count?: number };

function client(tables: Record<string, Result>, user: { id: string; email?: string } | null = { id: "t1", email: "kate@school.org" }) {
  const chain = (result: Result): unknown =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
          if (prop === "maybeSingle") return () => Promise.resolve(result);
          return () => chain(result);
        },
      },
    );
  const from = vi.fn((table: string) => chain({ error: null, ...(tables[table] ?? { data: [] }) }));
  return { db: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) }, from } as never, from };
}

const tables: Record<string, Result> = {
  teacher_groups: { data: [{ id: "g1", name: "5-A", created_at: "2026-09-01" }, { id: "g2", name: "6-B", created_at: "2026-09-02" }] },
  teacher_group_members: {
    data: [
      { group_id: "g1", student_id: "s1", profiles: { username: "anna" } },
      { group_id: "g1", student_id: "s2", profiles: null },
    ],
  },
  homework_topics: {
    data: [
      { id: "both", group_id: "g1", title: "Animals", order_index: 2 },
      { id: "vocab", group_id: "g1", title: "Food", order_index: 1 },
      { id: "empty", group_id: "g1", title: "Draft", order_index: 0 },
    ],
  },
  homework_vocab_words: { data: [{ topic_id: "both" }, { topic_id: "vocab" }] },
  homework_grammar_points: { data: [{ topic_id: "both" }] },
  homework_vocab_completions: { data: [{ topic_id: "both", student_id: "s1" }, { topic_id: "vocab", student_id: "s1" }, { topic_id: "both", student_id: "s2" }] },
  homework_grammar_completions: { data: [{ topic_id: "both", student_id: "s1" }] },
  placement_test_attempts: {
    data: [{ profile_id: "s1", total_correct: 30, total_questions: 40, level_scores: [], recommended_level: "elementary", created_at: "2026-10-01" }],
  },
  user_progress: { data: [{ mission_id: "m1", location_id: "l1", completed_at: "2026-10-02", score: 100, missions: { title: "Bakery" } }] },
  user_stats: { data: null },
  locations: { data: null, count: 3 },
};

describe("getTeacherGroups", () => {
  it("lists each group's students with their missions, topic passes and level test", async () => {
    const groups = await getTeacherGroups(client(tables).db, "t1");

    expect(groups.map((g) => [g.name, g.students.length])).toEqual([
      ["5-A", 2],
      ["6-B", 0],
    ]);
    const [anna, unknown] = groups[0].students;
    expect(anna).toMatchObject({ id: "s1", username: "anna", missionsCompleted: 1 });
    // A topic passes only when every module it has is done; a topic with no content isn't listed.
    expect(anna.topicResults).toEqual([
      { topicId: "both", title: "Animals", passed: true },
      { topicId: "vocab", title: "Food", passed: true },
    ]);
    expect(anna.placement).toMatchObject({ recommendedLevel: "elementary", totalCorrect: 30 });
    expect(unknown.username).toBe("Unknown");
    expect(unknown.topicResults).toEqual([
      { topicId: "both", title: "Animals", passed: false },
      { topicId: "vocab", title: "Food", passed: false },
    ]);
    expect(unknown.placement).toBeNull();
  });

  it("returns no groups for a teacher without any, without further reads", async () => {
    const { db, from } = client({ teacher_groups: { data: [] } });
    expect(await getTeacherGroups(db, "t1")).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("throws on a failed read instead of showing no groups", async () => {
    const { db } = client({ teacher_groups: { data: null, error: { message: "offline" } } });
    await expect(getTeacherGroups(db, "t1")).rejects.toEqual({ message: "offline" });
  });
});

describe("loadTeacherDashboard", () => {
  it("adds the teacher's name and email", async () => {
    const data = await loadTeacherDashboard(client({ ...tables, profiles: { data: { username: "ms_kate" } } }).db);
    expect(data.username).toBe("ms_kate");
    expect(data.email).toBe("kate@school.org");
    expect(data.groups).toHaveLength(2);
  });
});
