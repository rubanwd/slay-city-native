import { describe, expect, it, vi } from "vitest";

import { deleteMyAccount } from "./account";

function client(rpcResult: { data?: unknown; error?: unknown }) {
  const db = {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...rpcResult }),
    auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
  };
  return { db: db as never, rpc: db.rpc, signOut: db.auth.signOut };
}

describe("deleteMyAccount", () => {
  it("deletes through the RPC, then drops the session on this phone only", async () => {
    const { db, rpc, signOut } = client({ data: [{ success: true, reason: "ok" }] });
    expect(await deleteMyAccount(db)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("delete_my_account");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("passes a refusal through and stays signed in", async () => {
    const { db, signOut } = client({ data: [{ success: false, reason: "teacher_has_groups" }] });
    expect(await deleteMyAccount(db)).toEqual({ ok: false, problem: "teacher_has_groups" });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("never reads a failed call or an empty answer as deleted", async () => {
    const failed = client({ error: { message: "offline" } });
    expect(await deleteMyAccount(failed.db)).toEqual({ ok: false, problem: "unknown" });
    const empty = client({ data: [] });
    expect(await deleteMyAccount(empty.db)).toEqual({ ok: false, problem: "unknown" });
    expect(failed.signOut).not.toHaveBeenCalled();
    expect(empty.signOut).not.toHaveBeenCalled();
  });
});
