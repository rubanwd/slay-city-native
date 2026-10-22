import { describe, expect, it, vi } from "vitest";

import { getLatestPlacementAttempts, getPlacementTest, loadPlacementScreen, submitPlacementTest } from "./placement";

const Q1 = "11111111-1111-4111-8111-111111111111";
const Q2 = "22222222-2222-4222-8222-222222222222";

type Result = { data: unknown; error?: unknown };

function client(rpcs: Record<string, Result>, tables: Record<string, Result> = {}, user: { id: string } | null = { id: "u1" }) {
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
  const rpc = vi.fn((fn: string) => Promise.resolve({ error: null, ...rpcs[fn] }));
  return {
    db: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from: vi.fn((table: string) => chain({ error: null, ...tables[table] })),
      rpc,
    } as never,
    rpc,
  };
}

const questionRows = [
  { id: Q1, level: "beginner", prompt: "I ___ a cat.", options: ["have", "has"] },
  { id: Q2, level: "nope", prompt: "Broken", options: ["a", "b"] },
  { id: "q3", level: "elementary", prompt: "One option", options: ["only"] },
];

describe("getPlacementTest", () => {
  it("keeps questions with a real level and at least two options", async () => {
    const { db } = client({ get_placement_test: { data: questionRows } });
    expect(await getPlacementTest(db)).toEqual([{ id: Q1, level: "beginner", prompt: "I ___ a cat.", options: ["have", "has"] }]);
  });

  it("throws when the questions can't be read, rather than showing an empty test", async () => {
    const { db } = client({ get_placement_test: { data: null, error: { message: "offline" } } });
    await expect(getPlacementTest(db)).rejects.toEqual({ message: "offline" });
  });
});

describe("submitPlacementTest", () => {
  it("sends only clean answers and reads the graded result", async () => {
    const { db, rpc } = client({
      submit_placement_test: {
        data: {
          total_correct: 1,
          total_questions: 2,
          level_scores: [{ level: "beginner", correct: 1, total: 2, passed: false }],
          recommended_level: "beginner",
        },
      },
    });
    const result = await submitPlacementTest(db, { [Q1]: 0, junk: 3, [Q2]: 99 });
    expect(rpc).toHaveBeenCalledWith("submit_placement_test", { p_answers: { [Q1]: 0 } });
    expect(result).toEqual({
      ok: true,
      result: {
        totalCorrect: 1,
        totalQuestions: 2,
        levelScores: [{ level: "beginner", correct: 1, total: 2, passed: false }],
        recommendedLevel: "beginner",
      },
    });
  });

  it("passes the database's error through, and refuses a result it can't read", async () => {
    expect(await submitPlacementTest(client({ submit_placement_test: { data: null, error: { message: "offline" } } }).db, {})).toEqual({
      ok: false,
      error: "offline",
    });
    expect(await submitPlacementTest(client({ submit_placement_test: { data: { oops: true } } }).db, {})).toEqual({
      ok: false,
      error: "Couldn't read the test result. Please try again.",
    });
  });
});

describe("getLatestPlacementAttempts", () => {
  it("keeps each student's newest attempt", async () => {
    const row = (profile: string, correct: number, at: string) => ({
      profile_id: profile,
      total_correct: correct,
      total_questions: 40,
      level_scores: [],
      recommended_level: "elementary",
      created_at: at,
    });
    const { db } = client({}, { placement_test_attempts: { data: [row("a", 30, "2026-10-21"), row("a", 10, "2026-10-01"), row("b", 5, "2026-10-02")] } });
    const latest = await getLatestPlacementAttempts(db, ["a", "b"]);
    expect(latest.get("a")?.totalCorrect).toBe(30);
    expect(latest.get("b")?.totalCorrect).toBe(5);
  });

  it("asks nothing for no students", async () => {
    const { db } = client({});
    expect((await getLatestPlacementAttempts(db, [])).size).toBe(0);
  });
});

describe("loadPlacementScreen", () => {
  it("loads the questions, the levels with content, the current level and the mascot", async () => {
    const { db } = client(
      { get_placement_test: { data: questionRows.slice(0, 1) }, available_knowledge_levels: { data: ["elementary", "beginner"] } },
      { profiles: { data: { level: "beginner" } }, user_wardrobe_items: { data: [] } },
    );
    expect(await loadPlacementScreen(db)).toEqual({
      questions: [{ id: Q1, level: "beginner", prompt: "I ___ a cat.", options: ["have", "has"] }],
      currentLevel: "beginner",
      availableLevels: ["beginner", "elementary"],
      mascotImageUrl: "/wardrobe/slay-base.webp",
    });
  });
});
