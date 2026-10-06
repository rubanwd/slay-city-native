import { describe, expect, it, vi } from "vitest";

import { resetLocationProgress, submitMissionCompletion } from "./mission";

function makeDb(overrides: {
  user?: { id: string } | null;
  session?: { access_token: string } | null;
  rpc?: ReturnType<typeof vi.fn>;
  invoke?: ReturnType<typeof vi.fn>;
}) {
  const rpc = overrides.rpc ?? vi.fn();
  const invoke = overrides.invoke ?? vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: overrides.user ?? null } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: overrides.session ?? null } }),
    },
    rpc,
    functions: { invoke },
  } as never;
}

describe("submitMissionCompletion", () => {
  it("rejects when signed out, without calling the RPC", async () => {
    const rpc = vi.fn();
    const db = makeDb({ user: null, rpc });

    const result = await submitMissionCompletion(db, "mission-1");

    expect(result).toEqual({ ok: false, error: "You must be signed in to complete a mission." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls complete_mission with the mission id and a clamped reward fraction", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ already_completed: false, xp_earned: 10, coins_earned: 5 }],
      error: null,
    });
    const db = makeDb({ user: { id: "u1" }, session: null, rpc });

    const result = await submitMissionCompletion(db, "mission-1", 3);

    expect(rpc).toHaveBeenCalledWith("complete_mission", {
      p_mission_id: "mission-1",
      p_reward_fraction: 1,
    });
    expect(result).toEqual({
      ok: true,
      alreadyCompleted: false,
      xpEarned: 10,
      coinsEarned: 5,
      currentStreak: null,
      longestStreak: null,
    });
  });

  it("propagates a mission-not-found error with a friendly message", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Mission not found or not published" },
    });
    const db = makeDb({ user: { id: "u1" }, rpc });

    const result = await submitMissionCompletion(db, "missing");

    expect(result).toEqual({ ok: false, error: "Mission not found." });
  });

  it("propagates any other RPC error verbatim", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const db = makeDb({ user: { id: "u1" }, rpc });

    const result = await submitMissionCompletion(db, "mission-1");

    expect(result).toEqual({ ok: false, error: "boom" });
  });

  it("forwards the session token to the update-streak Edge Function and returns its streaks", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ already_completed: true, xp_earned: 0, coins_earned: 0 }],
      error: null,
    });
    const invoke = vi.fn().mockResolvedValue({
      data: { current_streak: 4, longest_streak: 9, last_activity_date: "2026-10-06" },
      error: null,
    });
    const db = makeDb({ user: { id: "u1" }, session: { access_token: "tok" }, rpc, invoke });

    const result = await submitMissionCompletion(db, "mission-1");

    expect(invoke).toHaveBeenCalledWith("update-streak", {
      body: { profile_id: "u1" },
      headers: { Authorization: "Bearer tok" },
    });
    expect(result).toEqual({
      ok: true,
      alreadyCompleted: true,
      xpEarned: 0,
      coinsEarned: 0,
      currentStreak: 4,
      longestStreak: 9,
    });
  });
});

describe("resetLocationProgress", () => {
  it("rejects when signed out", async () => {
    const db = makeDb({ user: null });

    const result = await resetLocationProgress(db, "loc-1");

    expect(result).toEqual({ ok: false, error: "You must be signed in to restart this location." });
  });

  it("calls reset_location_progress with the location id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const db = makeDb({ user: { id: "u1" }, rpc });

    const result = await resetLocationProgress(db, "loc-1");

    expect(rpc).toHaveBeenCalledWith("reset_location_progress", { p_location_id: "loc-1" });
    expect(result).toEqual({ ok: true });
  });

  it("propagates an RPC error", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "nope" } });
    const db = makeDb({ user: { id: "u1" }, rpc });

    const result = await resetLocationProgress(db, "loc-1");

    expect(result).toEqual({ ok: false, error: "nope" });
  });
});
