import { describe, expect, it, vi } from "vitest";

import { loadMapPreview, loadReviewLocation, loadReviewMission, loadTeacherMap } from "./mapPreview";

type Result = { data: unknown; error?: unknown; single?: unknown };

function client(tables: Record<string, Result>, user: { id: string } | null = { id: "t1" }) {
  const chain = (result: Result): unknown =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
          if (prop === "maybeSingle") return () => Promise.resolve("single" in result ? { error: null, data: result.single } : result);
          return () => chain(result);
        },
      },
    );
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => chain({ error: null, ...(tables[table] ?? { data: [] }) })),
  } as never;
}

const city = {
  districts: { data: [{ id: "d1", name: "Old Town", order_index: 0, background_image_url: null }] },
  locations: {
    data: [
      { id: "l1", district_id: "d1", name: "Bakery", description: "Bread", order_index: 0, map_x: 20, map_y: 30, icon_url: null },
      { id: "lx", district_id: "other", name: "Hidden", description: null, order_index: 0, map_x: 0, map_y: 0, icon_url: null },
    ],
  },
  missions: {
    data: [
      { id: "m1", location_id: "l1", order_index: 0, xp_reward: 10, coin_reward: 5, title: "One" },
      { id: "m2", location_id: "l1", order_index: 1, xp_reward: 20, coin_reward: 5, title: "Two" },
    ],
  },
};

describe("loadMapPreview", () => {
  it("lays out the level's published stops with what they hold, and no progress by default", async () => {
    const [district] = await loadMapPreview(client(city), "elementary");
    expect(district.name).toBe("Old Town");
    expect(district.locations.map((l) => l.name)).toEqual(["Bakery"]);
    expect(district.locations[0]).toMatchObject({ totalMissions: 2, missionsCompleted: 0, totalXp: 30, totalCoins: 10 });
  });

  it("marks a stop done only when everyone followed has finished it", async () => {
    const progress = {
      user_progress: {
        data: [
          { profile_id: "s1", mission_id: "m1" },
          { profile_id: "s1", mission_id: "m2" },
          { profile_id: "s2", mission_id: "m1" },
        ],
      },
    };
    const [district] = await loadMapPreview(client({ ...city, ...progress }), "elementary", ["s1", "s2"]);
    expect(district.locations[0].missionsCompleted).toBe(1);
    expect(district.locations[0].state).not.toBe("completed");
  });

  it("throws on a failed read rather than drawing an empty city", async () => {
    await expect(loadMapPreview(client({ ...city, districts: { data: null, error: { message: "offline" } } }), "elementary")).rejects.toEqual({ message: "offline" });
  });
});

describe("loadTeacherMap", () => {
  it("uses the teacher's own level", async () => {
    const data = await loadTeacherMap(client({ ...city, profiles: { data: { level: "beginner" } } }));
    expect(data.levelName).toBe("Beginner");
    expect(data.districts).toHaveLength(1);
  });
});

describe("loadReviewLocation", () => {
  it("lists every published mission at the stop", async () => {
    const data = await loadReviewLocation(
      client({ locations: { data: [], single: { id: "l1", name: "Bakery", description: null, districts: { name: "Old Town" } } }, missions: city.missions }),
      "l1",
    );
    expect(data?.location).toEqual({ id: "l1", name: "Bakery", description: null, districtName: "Old Town" });
    expect(data?.missions.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("is null for an unpublished stop", async () => {
    expect(await loadReviewLocation(client({ locations: { data: [], single: null } }), "l9")).toBeNull();
  });
});

describe("loadReviewMission", () => {
  it("adds the stop and the next mission there", async () => {
    const db = client({
      missions: {
        data: [
          { id: "m1", title: "One", order_index: 0 },
          { id: "m2", title: "Two", order_index: 1 },
        ],
        single: { id: "m1", title: "One", description: null, xp_reward: 10, coin_reward: 5, location_id: "l1", locations: { name: "Bakery", icon_url: null } },
      },
      mission_tasks: { data: [{ id: "k1", task_type: "quiz", order_index: 0, content: {} }] },
    });
    const data = await loadReviewMission(db, "m1");
    expect(data?.locationId).toBe("l1");
    expect(data?.next).toEqual({ id: "m2", title: "Two" });
    expect(data?.tasks).toHaveLength(1);
  });
});
