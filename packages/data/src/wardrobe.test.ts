import { describe, expect, it, vi } from "vitest";

import { equipWardrobeItem, loadMascotImage, purchaseWardrobeItem, unequipWardrobeItem } from "./wardrobe";

function makeAuthDb(overrides: {
  user?: { id: string } | null;
  rpc?: ReturnType<typeof vi.fn>;
}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: overrides.user ?? null } }) },
    rpc: overrides.rpc ?? vi.fn(),
  } as never;
}

describe("purchaseWardrobeItem", () => {
  it("rejects when signed out", async () => {
    const db = makeAuthDb({ user: null });

    expect(await purchaseWardrobeItem(db, "item-1")).toEqual({
      ok: false,
      error: "You must be signed in to buy an item.",
    });
  });

  it("calls purchase_wardrobe_item with the item id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ coins_remaining: 40, item_id: "item-1" }], error: null });
    const db = makeAuthDb({ user: { id: "u1" }, rpc });

    const result = await purchaseWardrobeItem(db, "item-1");

    expect(rpc).toHaveBeenCalledWith("purchase_wardrobe_item", { p_item_id: "item-1" });
    expect(result).toEqual({ ok: true, coinsRemaining: 40 });
  });

  it("translates a known RPC error into friendly copy", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "Not enough coins" } });
    const db = makeAuthDb({ user: { id: "u1" }, rpc });

    expect(await purchaseWardrobeItem(db, "item-1")).toEqual({
      ok: false,
      error: "You don't have enough coins for this item.",
    });
  });

  it("passes through an unrecognised RPC error verbatim", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "weird failure" } });
    const db = makeAuthDb({ user: { id: "u1" }, rpc });

    expect(await purchaseWardrobeItem(db, "item-1")).toEqual({ ok: false, error: "weird failure" });
  });
});

describe("equipWardrobeItem", () => {
  it("calls equip_wardrobe_item with the item id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const db = makeAuthDb({ user: { id: "u1" }, rpc });

    expect(await equipWardrobeItem(db, "item-1")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("equip_wardrobe_item", { p_item_id: "item-1" });
  });

  it("translates a not-owned error", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "Item not owned" } });
    const db = makeAuthDb({ user: { id: "u1" }, rpc });

    expect(await equipWardrobeItem(db, "item-1")).toEqual({
      ok: false,
      error: "You need to buy this item first.",
    });
  });
});

describe("unequipWardrobeItem", () => {
  it("calls unequip_wardrobe_item with the item id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const db = makeAuthDb({ user: { id: "u1" }, rpc });

    expect(await unequipWardrobeItem(db, "item-1")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("unequip_wardrobe_item", { p_item_id: "item-1" });
  });

  it("propagates an RPC error verbatim", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const db = makeAuthDb({ user: { id: "u1" }, rpc });

    expect(await unequipWardrobeItem(db, "item-1")).toEqual({ ok: false, error: "boom" });
  });
});

describe("loadMascotImage", () => {
  it("resolves to the default snake when nothing is equipped", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    const db = { from } as never;

    expect(await loadMascotImage(db, "student-1")).toBe("/wardrobe/slay-base.webp");
    expect(from).toHaveBeenCalledWith("user_wardrobe_items");
  });

  it("resolves to the equipped item's preview image", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                equipped_at: "2026-10-01T00:00:00Z",
                wardrobe_items: { preview_url: "/hat.png", image_url: null },
              },
            ],
          }),
        }),
      }),
    });
    const db = { from } as never;

    expect(await loadMascotImage(db, "student-1")).toBe("/hat.png");
  });
});
