import { describe, expect, it, vi } from "vitest";

import { deleteMyAccount } from "./account";

interface Answers {
  delete?: { data?: unknown; error?: unknown };
  paths?: { data?: unknown; error?: unknown };
  remove?: { error?: unknown };
}

function client(answers: Answers = {}) {
  const rpc = vi.fn((name: string) =>
    Promise.resolve(
      name === "my_feedback_upload_paths"
        ? { data: [], error: null, ...answers.paths }
        : { data: null, error: null, ...answers.delete }
    )
  );
  const remove = vi.fn().mockResolvedValue({ data: [], error: null, ...answers.remove });
  const from = vi.fn(() => ({ remove }));
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const db = { rpc, storage: { from }, auth: { signOut } };
  return { db: db as never, rpc, from, remove, signOut };
}

const deleted = { data: [{ success: true, reason: "ok" }] };

describe("deleteMyAccount", () => {
  it("deletes through the RPC, then drops the session on this phone only", async () => {
    const { db, rpc, signOut } = client({ delete: deleted });
    expect(await deleteMyAccount(db)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("delete_my_account");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("removes the caller's feedback screenshots before deleting the account", async () => {
    const { db, rpc, from, remove } = client({
      delete: deleted,
      paths: { data: ["feedback/a.png", "feedback/b.png"] },
    });
    expect(await deleteMyAccount(db)).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("content");
    expect(remove).toHaveBeenCalledWith(["feedback/a.png", "feedback/b.png"]);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["my_feedback_upload_paths", "delete_my_account"]);
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[1]);
  });

  it("removes a long list in batches", async () => {
    const paths = Array.from({ length: 250 }, (_, i) => `feedback/${i}.png`);
    const { db, remove } = client({ delete: deleted, paths: { data: paths } });
    await deleteMyAccount(db);
    expect(remove.mock.calls.map(([batch]) => (batch as string[]).length)).toEqual([100, 100, 50]);
  });

  it("does not delete the account when the screenshots could not be removed", async () => {
    for (const answers of [
      { paths: { error: { message: "offline" } } },
      { paths: { data: ["feedback/a.png"] }, remove: { error: { message: "denied" } } },
    ]) {
      const { db, rpc, signOut } = client({ delete: deleted, ...answers });
      expect(await deleteMyAccount(db)).toEqual({ ok: false, problem: "unknown" });
      expect(rpc).not.toHaveBeenCalledWith("delete_my_account");
      expect(signOut).not.toHaveBeenCalled();
    }
  });

  it("passes a refusal through and stays signed in", async () => {
    const { db, signOut } = client({ delete: { data: [{ success: false, reason: "teacher_has_groups" }] } });
    expect(await deleteMyAccount(db)).toEqual({ ok: false, problem: "teacher_has_groups" });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("never reads a failed call or an empty answer as deleted", async () => {
    const failed = client({ delete: { error: { message: "offline" } } });
    expect(await deleteMyAccount(failed.db)).toEqual({ ok: false, problem: "unknown" });
    const empty = client({ delete: { data: [] } });
    expect(await deleteMyAccount(empty.db)).toEqual({ ok: false, problem: "unknown" });
    expect(failed.signOut).not.toHaveBeenCalled();
    expect(empty.signOut).not.toHaveBeenCalled();
  });
});
