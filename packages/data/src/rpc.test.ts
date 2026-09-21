import { describe, expect, it, vi } from "vitest";

import { callRpc, firstRow, type Db } from "./rpc";

function fakeDb(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(response);
  return { db: { rpc } as unknown as Db, rpc };
}

describe("callRpc", () => {
  it("returns the RPC's data on success", async () => {
    const { db, rpc } = fakeDb({ data: [{ xp_earned: 10 }], error: null });

    const result = await callRpc(db, "complete_mission", { p_mission_id: "m-1" });

    expect(result).toEqual([{ xp_earned: 10 }]);
    expect(rpc).toHaveBeenCalledWith("complete_mission", { p_mission_id: "m-1" });
  });

  it("omits the args parameter for a zero-argument RPC", async () => {
    const { db, rpc } = fakeDb({ data: 3, error: null });

    await callRpc(db, "unread_feedback_count");

    expect(rpc).toHaveBeenCalledWith("unread_feedback_count");
  });

  it("throws the Postgres error instead of returning null data", async () => {
    const error = new Error("permission denied");
    const { db } = fakeDb({ data: null, error });

    await expect(callRpc(db, "reset_level_progress")).rejects.toBe(error);
  });
});

describe("firstRow", () => {
  it("returns the sole row a table-returning RPC produces", () => {
    expect(firstRow([{ id: 1 }], "some_rpc")).toEqual({ id: 1 });
  });

  it("throws when the RPC's own guard rejected the call, leaving no row", () => {
    expect(() => firstRow([], "some_rpc")).toThrow("some_rpc returned no row");
  });
});
