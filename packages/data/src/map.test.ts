import { describe, expect, it, vi } from "vitest";

import { moveLocationOnMap } from "./map";

describe("moveLocationOnMap", () => {
  it("rejects a non-finite coordinate without calling the RPC", async () => {
    const rpc = vi.fn();
    const db = { rpc } as never;

    expect(await moveLocationOnMap(db, "loc-1", Number.NaN, 10)).toEqual({
      ok: false,
      error: "That spot is off the map.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls set_location_map_position with the location id and coordinates", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const db = { rpc } as never;

    expect(await moveLocationOnMap(db, "loc-1", 12.5, 48.2)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_location_map_position", {
      p_location_id: "loc-1",
      p_map_x: 12.5,
      p_map_y: 48.2,
    });
  });

  it("propagates an RPC error", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: "not a teacher" } });
    const db = { rpc } as never;

    expect(await moveLocationOnMap(db, "loc-1", 1, 1)).toEqual({ ok: false, error: "not a teacher" });
  });
});
