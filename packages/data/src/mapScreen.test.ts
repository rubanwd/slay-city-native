import { describe, expect, it, vi } from "vitest";

import { loadMapScreen } from "./mapScreen";

type Rows = Record<string, { data: unknown; error?: { message: string } | null }>;

/**
 * A client whose every `from(table)` chain resolves to `rows[table]`, however
 * it is filtered — the filters are upstream's and are not what this tests.
 */
function client(rows: Rows, { level = "starter" } = {}) {
  const chain = (result: unknown): unknown =>
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
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }) },
    // `hasAnyGroup` asks an RPC; no groups.
    rpc: vi.fn().mockResolvedValue({ data: null }),
    from: vi.fn((table: string) => {
      if (table === "profiles") return chain({ data: { level }, error: null });
      return chain({ error: null, ...(rows[table] ?? { data: [] }) });
    }),
  } as never;
}

const district = { id: "d1", name: "Downtown", order_index: 0, background_image_url: "https://cdn/d1.webp" };
const location = (id: string, order: number) => ({
  id,
  district_id: "d1",
  name: `Stop ${id}`,
  description: null,
  order_index: order,
  map_x: 20 + order * 10,
  map_y: 30,
  icon_url: null,
});

describe("loadMapScreen", () => {
  it("builds the active district from the web page's queries", async () => {
    const db = client({
      districts: { data: [district] },
      locations: { data: [location("l1", 0), location("l2", 1), { ...location("x", 2), district_id: "other" }] },
      missions: {
        data: [
          { id: "m1", location_id: "l1", order_index: 0, xp_reward: 10, coin_reward: 5 },
          { id: "m2", location_id: "l2", order_index: 0, xp_reward: 20, coin_reward: 7 },
        ],
      },
      user_progress: { data: [{ mission_id: "m1", completed_at: "2026-10-01" }] },
      user_stats: { data: { xp: 120, coins: 40, level: 3, current_streak: 2 } },
      user_wardrobe_items: { data: [] },
    });

    const map = await loadMapScreen(db);

    expect(map.hud).toEqual({ xp: 120, coins: 40, level: 3, currentStreak: 2 });
    expect(map.district?.name).toBe("Downtown");
    expect(map.district?.backgroundUrl).toBe("https://cdn/d1.webp");
    // The location in an unpublished district is dropped.
    expect(map.district?.locations.map((l) => [l.id, l.state, l.missionId])).toEqual([
      ["l1", "completed", null],
      ["l2", "unlocked", "m2"],
    ]);
    expect(map.levelStatus.completed).toBe(false);
    expect(map.mascotImageUrl).toBe("/wardrobe/slay-base.webp");
  });

  it("reports a cleared level with the next level's name", async () => {
    const db = client({
      districts: { data: [district] },
      locations: { data: [location("l1", 0)] },
      missions: { data: [{ id: "m1", location_id: "l1", order_index: 0, xp_reward: 10, coin_reward: 5 }] },
      user_progress: { data: [{ mission_id: "m1", completed_at: "2026-10-01" }] },
      user_stats: { data: null },
      user_wardrobe_items: { data: [] },
    });

    const map = await loadMapScreen(db);

    expect(map.levelStatus.completed).toBe(true);
    expect(map.levelStatus.levelName).toBeTruthy();
    expect(map.hud).toEqual({ xp: 0, coins: 0, level: 1, currentStreak: 0 });
  });

  it("throws on a failed read rather than showing an empty map", async () => {
    const db = client({ districts: { data: null, error: { message: "offline" } } });

    await expect(loadMapScreen(db)).rejects.toEqual({ message: "offline" });
  });
});
