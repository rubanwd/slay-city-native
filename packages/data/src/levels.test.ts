import { describe, expect, it, vi } from "vitest";

import { changeMyLevel, getAvailableLevels, getMyLevel, isLevelCleared, restartMyLevel } from "./levels";

function makeAuthDb(overrides: { user?: { id: string } | null; rpc?: ReturnType<typeof vi.fn> }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: overrides.user ?? null } }) },
    rpc: overrides.rpc ?? vi.fn(),
  } as never;
}

describe("restartMyLevel", () => {
  it("rejects when signed out", async () => {
    const db = makeAuthDb({ user: null });
    expect(await restartMyLevel(db)).toEqual({ ok: false, error: "You must be signed in to replay a level." });
  });

  it("calls reset_level_progress with no arguments", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const db = makeAuthDb({ user: { id: "u1" }, rpc });

    expect(await restartMyLevel(db)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("reset_level_progress");
  });
});

describe("changeMyLevel", () => {
  it("rejects an unrecognised level without calling the RPC", async () => {
    const rpc = vi.fn();
    const db = makeAuthDb({ user: { id: "u1" }, rpc });

    expect(await changeMyLevel(db, "expert")).toEqual({ ok: false, error: "Pick a level from the list." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls set_my_knowledge_level with the chosen level", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const db = makeAuthDb({ user: { id: "u1" }, rpc });

    expect(await changeMyLevel(db, "intermediate")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_my_knowledge_level", { p_level: "intermediate" });
  });

  it("includes the RPC error in the message", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "not available yet" } });
    const db = makeAuthDb({ user: { id: "u1" }, rpc });

    expect(await changeMyLevel(db, "intermediate")).toEqual({
      ok: false,
      error: "Couldn't switch to Intermediate. not available yet",
    });
  });
});

describe("getAvailableLevels", () => {
  it("sorts whatever the RPC returns into learning order", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: ["intermediate", "beginner"], error: null });
    const db = { rpc } as never;

    expect(await getAvailableLevels(db)).toEqual(["beginner", "intermediate"]);
    expect(rpc).toHaveBeenCalledWith("available_knowledge_levels");
  });

  it("returns an empty list when the RPC returns nothing", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }) } as never;

    expect(await getAvailableLevels(db)).toEqual([]);
  });
});

describe("getMyLevel", () => {
  it("returns the profile's level when set", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { level: "beginner" } }) }),
      }),
    });
    const db = { from } as never;

    expect(await getMyLevel(db, "u1")).toBe("beginner");
  });

  it("falls back to the default level when the profile row is missing", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
      }),
    });
    const db = { from } as never;

    expect(await getMyLevel(db, "u1")).toBe("elementary");
  });
});

describe("isLevelCleared", () => {
  function makeFrom(rows: Record<string, unknown[]>) {
    return vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: rows[table] ?? [] }),
          in: () => Promise.resolve({ data: rows[table] ?? [] }),
        }),
        in: () => ({
          eq: () => Promise.resolve({ data: rows[table] ?? [] }),
        }),
      }),
    }));
  }

  it("is false when the level has no published districts", async () => {
    const db = { from: makeFrom({ districts: [] }) } as never;

    expect(await isLevelCleared(db, "u1", "beginner")).toBe(false);
  });

  it("is true when every published mission is completed", async () => {
    const db = {
      from: makeFrom({
        districts: [{ id: "d1" }],
        locations: [{ id: "l1" }],
        missions: [{ id: "m1" }, { id: "m2" }],
        user_progress: [
          { mission_id: "m1", completed_at: "2026-01-01" },
          { mission_id: "m2", completed_at: "2026-01-02" },
        ],
      }),
    } as never;

    expect(await isLevelCleared(db, "u1", "beginner")).toBe(true);
  });

  it("is false when a published mission is not yet completed", async () => {
    const db = {
      from: makeFrom({
        districts: [{ id: "d1" }],
        locations: [{ id: "l1" }],
        missions: [{ id: "m1" }, { id: "m2" }],
        user_progress: [{ mission_id: "m1", completed_at: "2026-01-01" }],
      }),
    } as never;

    expect(await isLevelCleared(db, "u1", "beginner")).toBe(false);
  });
});
