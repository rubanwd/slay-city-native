import { describe, expect, it, vi } from "vitest";

import { loadWardrobe } from "./wardrobeScreen";

type Result = { data: unknown; error?: unknown };

function client(user: { id: string } | null, tables: Record<string, Result>) {
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
    from: vi.fn((table: string) => chain({ error: null, ...tables[table] })),
  } as never;
}

const catalog = [
  { id: "base", name: "Classic", description: null, item_type: "hat", cost_coins: 0, unlock_level: null, is_default: true, image_url: "/wardrobe/base.webp", preview_url: null },
  { id: "crown", name: "Crown", description: "Royal", item_type: "hat", cost_coins: 50, unlock_level: 3, is_default: false, image_url: "/wardrobe/hat-crown.webp", preview_url: "/wardrobe/slay-crown.webp" },
  { id: "shades", name: "Shades", description: null, item_type: "glasses", cost_coins: 20, unlock_level: null, is_default: false, image_url: null, preview_url: null },
];

describe("loadWardrobe", () => {
  it("marks what is owned and worn, and dresses the mascot in the worn item", async () => {
    const db = client(
      { id: "u1" },
      {
        wardrobe_items: { data: catalog },
        user_wardrobe_items: { data: [{ wardrobe_item_id: "crown", equipped: true, equipped_at: "2026-10-20T10:00:00Z" }] },
        user_stats: { data: { coins: 35, level: 4 } },
      },
    );

    const data = await loadWardrobe(db);
    expect(data.coins).toBe(35);
    expect(data.level).toBe(4);
    expect(data.mascotImageUrl).toBe("/wardrobe/slay-crown.webp");
    expect(data.items.map(({ id, owned, equipped }) => ({ id, owned, equipped }))).toEqual([
      // A default item is everyone's.
      { id: "base", owned: true, equipped: false },
      { id: "crown", owned: true, equipped: true },
      { id: "shades", owned: false, equipped: false },
    ]);
    expect(data.items[1]).toMatchObject({ cost: 50, unlockLevel: 3, category: "hat", imageUrl: "/wardrobe/hat-crown.webp" });
  });

  it("falls back to the default snake when nothing is worn", async () => {
    const db = client(
      { id: "u1" },
      { wardrobe_items: { data: catalog }, user_wardrobe_items: { data: [] }, user_stats: { data: null } },
    );
    const data = await loadWardrobe(db);
    expect(data.mascotImageUrl).toBe("/wardrobe/slay-base.webp");
    expect(data.coins).toBe(0);
    expect(data.level).toBe(1);
  });

  it("throws on a failed read instead of showing an empty shop", async () => {
    const db = client(
      { id: "u1" },
      { wardrobe_items: { data: null, error: { message: "offline" } }, user_wardrobe_items: { data: [] }, user_stats: { data: null } },
    );
    await expect(loadWardrobe(db)).rejects.toEqual({ message: "offline" });
  });
});
