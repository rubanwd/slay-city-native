import { describe, expect, it, vi } from "vitest";

import { loadMission } from "./missionScreen";

function client(mission: { data: unknown; error?: unknown }, tasks: { data: unknown; error?: unknown }) {
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
    from: vi.fn((table: string) =>
      chain(table === "missions" ? { error: null, ...mission } : { error: null, ...tasks }),
    ),
  } as never;
}

describe("loadMission", () => {
  it("maps the mission, its location and its tasks", async () => {
    const db = client(
      {
        data: {
          id: "m1",
          title: "Order a coffee",
          description: null,
          xp_reward: 30,
          coin_reward: 10,
          locations: { name: "Café", icon_url: "https://cdn/cafe.png" },
        },
      },
      { data: [{ id: "t1", task_type: "quiz", order_index: 0, content: { question: "?" } }] },
    );

    expect(await loadMission(db, "m1")).toEqual({
      mission: { id: "m1", title: "Order a coffee", description: null, xpReward: 30, coinReward: 10 },
      location: { name: "Café", iconUrl: "https://cdn/cafe.png" },
      tasks: [{ id: "t1", taskType: "quiz", orderIndex: 0, content: { question: "?" } }],
    });
  });

  it("returns null for a missing or unpublished mission", async () => {
    expect(await loadMission(client({ data: null }, { data: [] }), "nope")).toBeNull();
  });

  it("throws on a failed read instead of showing an empty mission", async () => {
    await expect(loadMission(client({ data: null }, { data: null, error: { message: "offline" } }), "m1")).rejects.toEqual({
      message: "offline",
    });
  });
});
