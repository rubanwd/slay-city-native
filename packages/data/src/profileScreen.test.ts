import { describe, expect, it, vi } from "vitest";

import { loadProfile } from "./profileScreen";

type Result = { data: unknown; error?: unknown };

function client(user: { id: string; email?: string } | null, tables: Record<string, Result>, levels: unknown = []) {
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
    rpc: vi.fn().mockResolvedValue({ data: levels, error: null }),
  } as never;
}

describe("loadProfile", () => {
  it("reads the name, level, email, dressed mascot and the levels with content", async () => {
    const db = client(
      { id: "u1", email: "sam@example.com" },
      {
        profiles: { data: { username: "sam", level: "beginner" } },
        user_wardrobe_items: {
          data: [{ equipped_at: "2026-10-20T10:00:00Z", wardrobe_items: { preview_url: "/wardrobe/slay-crown.webp", image_url: null } }],
        },
      },
      // Out of order and with junk: the loader keeps the ladder's order and drops the rest.
      ["elementary", "beginner", "nope"],
    );

    expect(await loadProfile(db)).toEqual({
      username: "sam",
      email: "sam@example.com",
      mascotImageUrl: "/wardrobe/slay-crown.webp",
      level: "beginner",
      availableLevels: ["beginner", "elementary"],
    });
  });

  it("falls back to the default level and snake for a bare profile", async () => {
    const db = client({ id: "u1" }, { profiles: { data: { username: null, level: "legacy" } }, user_wardrobe_items: { data: [] } });
    const data = await loadProfile(db);
    expect(data.level).toBe("elementary");
    expect(data.mascotImageUrl).toBe("/wardrobe/slay-base.webp");
    expect(data.email).toBeNull();
    expect(data.username).toBeNull();
  });

  it("throws on a failed profile read", async () => {
    const db = client({ id: "u1" }, { profiles: { data: null, error: { message: "offline" } }, user_wardrobe_items: { data: [] } });
    await expect(loadProfile(db)).rejects.toEqual({ message: "offline" });
  });
});
