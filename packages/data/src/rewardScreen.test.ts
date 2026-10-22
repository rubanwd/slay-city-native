import { describe, expect, it, vi } from "vitest";

import { loadRewardScreen } from "./rewardScreen";

type Result = { data: unknown; error?: unknown };

/**
 * A client whose `from(table)` answers with that table's results in the order
 * the loader reads them — every chained filter is accepted and ignored.
 */
function client(user: { id: string } | null, tables: Record<string, Result[]>) {
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
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      const next = tables[table]?.shift();
      if (!next) throw new Error(`unexpected read of ${table}`);
      return chain({ error: null, ...next });
    }),
  } as never;
}

const mission = {
  id: "m1",
  title: "Order a coffee",
  xp_reward: 30,
  coin_reward: 10,
  location_id: "cafe",
  locations: { id: "cafe", name: "Café", district_id: "d1", districts: { level: "beginner" } },
};
const tasks = { data: [{ task_type: "quiz" }, { task_type: "word_search" }] };

describe("loadRewardScreen", () => {
  it("has nothing to show when signed out", async () => {
    expect(await loadRewardScreen(client(null, {}), "m1")).toBe("not-completed");
  });

  it("returns null for a missing or unpublished mission", async () => {
    expect(await loadRewardScreen(client({ id: "u1" }, { missions: [{ data: null }] }), "m1")).toBeNull();
  });

  it("has nothing to show when the player hasn't completed the mission", async () => {
    const db = client({ id: "u1" }, { missions: [{ data: mission }], user_progress: [{ data: null }] });
    expect(await loadRewardScreen(db, "m1")).toBe("not-completed");
  });

  it("counts missions done at the location when nothing was cleared", async () => {
    const db = client(
      { id: "u1" },
      {
        missions: [
          { data: mission },
          {
            data: [
              { id: "m1", location_id: "cafe", order_index: 0 },
              { id: "m2", location_id: "cafe", order_index: 1 },
            ],
          },
        ],
        user_progress: [
          { data: { id: "p1", xp_earned: 15, coins_earned: 5 } },
          { data: [{ mission_id: "m1", completed_at: "2026-10-01" }] },
        ],
        mission_tasks: [tasks],
        locations: [{ data: [{ id: "cafe" }] }],
      },
    );

    expect(await loadRewardScreen(db, "m1")).toEqual({
      missionTitle: "Order a coffee",
      recordedXp: 15,
      recordedCoins: 5,
      taskNames: ["Quiz", "Word Search"],
      locationName: "Café",
      missionsCompletedAtLocation: 1,
      totalMissionsAtLocation: 2,
      milestone: null,
      clearedLevelName: null,
      nextLevelName: null,
      advancedToLevelName: null,
      continueTo: { focus: "cafe" },
    });
  });

  it("announces a finished location, and falls back to the full reward for an old completion", async () => {
    const db = client(
      { id: "u1" },
      {
        missions: [{ data: mission }, { data: [{ id: "m1", location_id: "cafe", order_index: 0 }, { id: "x", location_id: "park", order_index: 0 }] }],
        user_progress: [
          { data: { id: "p1", xp_earned: null, coins_earned: null } },
          { data: [{ mission_id: "m1", completed_at: "2026-10-01" }] },
        ],
        mission_tasks: [tasks],
        locations: [{ data: [{ id: "cafe" }, { id: "park" }] }],
      },
    );

    const data = await loadRewardScreen(db, "m1");
    expect(data).toMatchObject({
      recordedXp: 30,
      recordedCoins: 10,
      milestone: "location",
      continueTo: { focus: "cafe", milestone: "location", name: "Café" },
    });
  });

  it("explains a cleared level, and names the level the player moved up to", async () => {
    const done = { data: [{ mission_id: "m1", completed_at: "2026-10-01" }] };
    const db = client(
      { id: "u1" },
      {
        missions: [
          { data: mission },
          { data: [{ id: "m1", location_id: "cafe", order_index: 0 }] },
          // isLevelCleared: every mission of the level.
          { data: [{ id: "m1" }] },
        ],
        user_progress: [{ data: { id: "p1", xp_earned: 30, coins_earned: 10 } }, done, done],
        mission_tasks: [tasks],
        locations: [{ data: [{ id: "cafe" }] }, { data: [{ id: "cafe" }] }],
        districts: [{ data: [{ id: "d1" }] }],
        // complete_mission already promoted the player.
        profiles: [{ data: { level: "elementary" } }],
      },
    );

    const data = await loadRewardScreen(db, "m1");
    expect(data).toMatchObject({
      milestone: "level",
      clearedLevelName: "Beginner",
      nextLevelName: "Elementary",
      advancedToLevelName: "Elementary",
      continueTo: { focus: "cafe", milestone: "level", name: "Elementary" },
    });
  });
});
