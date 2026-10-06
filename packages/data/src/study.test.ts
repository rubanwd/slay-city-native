import { describe, expect, it, vi } from "vitest";

import { getStudyTimeSummary, recordStudyTime, STUDY_HEARTBEAT_SECONDS } from "./study";

describe("STUDY_HEARTBEAT_SECONDS", () => {
  it("matches the record_study_time clamp", () => {
    expect(STUDY_HEARTBEAT_SECONDS).toBe(30);
  });
});

describe("recordStudyTime", () => {
  it("does nothing when signed out", async () => {
    const rpc = vi.fn();
    const db = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }, rpc } as never;

    await recordStudyTime(db, 30);

    expect(rpc).not.toHaveBeenCalled();
  });

  it("rounds the seconds before calling record_study_time", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const db = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      rpc,
    } as never;

    await recordStudyTime(db, 29.6);

    expect(rpc).toHaveBeenCalledWith("record_study_time", { p_seconds: 30 });
  });
});

describe("getStudyTimeSummary", () => {
  it("reads study_time_daily for the profile and folds it into a summary", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [{ day: "2026-10-06", seconds: 120 }] });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const db = { from } as never;

    const summary = await getStudyTimeSummary(db, "u1");

    expect(from).toHaveBeenCalledWith("study_time_daily");
    expect(select).toHaveBeenCalledWith("day, seconds");
    expect(eq).toHaveBeenCalledWith("profile_id", "u1");
    expect(summary.totalSeconds).toBe(120);
  });
});
