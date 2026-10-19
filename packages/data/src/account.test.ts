import { describe, expect, it, vi } from "vitest";

import { loadAccount } from "./account";

type User = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

/**
 * A client whose `claim_admin()` answers `claimedAdmin`, whose `profiles`
 * lookup answers `profile`, and whose inserts answer `insertErrors` in turn.
 */
function client({
  user = { id: "u1", email: "anna@example.com" } as User | null,
  claimedAdmin = false,
  profile = null as { role: string } | null,
  profileError = null as { message: string } | null,
  insertErrors = [] as ({ code: string } | null)[],
} = {}) {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  const db = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: claimedAdmin }),
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: profileError }) }),
      }),
      insert: vi.fn((row: Record<string, unknown>) => {
        inserts.push({ table, row });
        return Promise.resolve({ error: table === "profiles" ? (insertErrors.shift() ?? null) : null });
      }),
    })),
  };
  return { db: db as never, inserts, rpc: db.rpc };
}

describe("loadAccount", () => {
  it("fails rather than guessing when there is no signed-in user", async () => {
    await expect(loadAccount(client({ user: null }).db)).rejects.toThrow("Not signed in.");
  });

  it("asks claim_admin first, as upstream does", async () => {
    const { db, rpc } = client({ claimedAdmin: true, profile: { role: "student" } });

    expect(await loadAccount(db)).toEqual({ kind: "profile", role: "admin" });
    expect(rpc).toHaveBeenCalledWith("claim_admin");
  });

  it("returns the role on the profile row", async () => {
    expect(await loadAccount(client({ profile: { role: "teacher" } }).db)).toEqual({ kind: "profile", role: "teacher" });
  });

  it("surfaces a failed profile read instead of treating it as no profile", async () => {
    await expect(loadAccount(client({ profileError: { message: "offline" } }).db)).rejects.toEqual({
      message: "offline",
    });
  });

  it("sends a profile-less student to onboarding without writing anything", async () => {
    const { db, inserts } = client();

    expect(await loadAccount(db)).toEqual({ kind: "needs-onboarding" });
    expect(inserts).toEqual([]);
  });

  it("provisions a parent who signed up as one, with a zeroed stats row", async () => {
    const { db, inserts } = client({ user: { id: "u1", email: "mum.k@example.com", user_metadata: { role: "parent" } } });

    expect(await loadAccount(db)).toEqual({ kind: "profile", role: "parent" });
    expect(inserts).toEqual([
      { table: "profiles", row: { id: "u1", username: "mumk", role: "parent" } },
      { table: "user_stats", row: { profile_id: "u1" } },
    ]);
  });

  it("trusts admin only from app_metadata, never from user_metadata", async () => {
    const forged = client({ user: { id: "u1", email: "x@example.com", user_metadata: { role: "admin" } } });
    expect(await loadAccount(forged.db)).toEqual({ kind: "needs-onboarding" });
    expect(forged.inserts).toEqual([]);

    const granted = client({ user: { id: "u1", email: "boss@example.com", app_metadata: { role: "admin" } } });
    expect(await loadAccount(granted.db)).toEqual({ kind: "profile", role: "admin" });
    expect(granted.inserts).toEqual([{ table: "profiles", row: { id: "u1", username: "boss", role: "admin" } }]);
  });

  it("retries a taken username with a suffix, and gives up on any other error", async () => {
    const parent = { id: "u1", email: "mum@example.com", user_metadata: { role: "parent" } };

    const taken = client({ user: parent, insertErrors: [{ code: "23505" }] });
    expect(await loadAccount(taken.db)).toEqual({ kind: "profile", role: "parent" });
    expect(taken.inserts[1].row.username).toMatch(/^mum_[a-z0-9]{1,4}$/);

    const refused = client({ user: parent, insertErrors: [{ code: "42501" }] });
    expect(await loadAccount(refused.db)).toEqual({ kind: "needs-onboarding" });
  });
});
