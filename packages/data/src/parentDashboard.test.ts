import { describe, expect, it, vi } from "vitest";

import { loadParentDashboard, loadParentMap } from "./parentDashboard";

type Result = { data: unknown; error?: unknown; single?: unknown };

function client(
  tables: Record<string, Result>,
  rpcs: Record<string, Result> = {},
  metadata: Record<string, unknown> = { student_email: "anna@school.org" },
) {
  const chain = (result: Result): unknown =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
          if (prop === "maybeSingle") return () => Promise.resolve("single" in result ? { error: null, data: result.single } : result);
          return () => chain(result);
        },
      },
    );
  const rpc = vi.fn((fn: string) => Promise.resolve({ error: null, ...(rpcs[fn] ?? { data: [] }) }));
  return {
    db: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "p1", user_metadata: metadata } } }) },
      from: vi.fn((table: string) => chain({ error: null, ...(tables[table] ?? { data: [] }) })),
      rpc,
    } as never,
    rpc,
  };
}

describe("loadParentDashboard", () => {
  it("links the student by the registered email, then loads their progress", async () => {
    const { db, rpc } = client(
      {
        parent_student_links: { data: [] },
        profiles: { data: [], single: { username: "anna", level: "beginner" } },
        user_stats: { data: [], single: { xp: 120, coins: 30, last_activity_date: "2026-10-21", current_streak: 2, longest_streak: 5 } },
      },
      { link_student_by_email: { data: [{ linked: true, student_id: "s1", reason: null }] } },
    );
    const state = await loadParentDashboard(db);
    expect(rpc).toHaveBeenCalledWith("link_student_by_email", { p_student_email: "anna@school.org" });
    expect(state.kind).toBe("linked");
    if (state.kind !== "linked") return;
    expect(state.data.student).toMatchObject({ id: "s1", username: "anna", level: "beginner", xp: 120, coins: 30 });
  });

  it("says why when the student hasn't joined yet", async () => {
    const { db } = client({ parent_student_links: { data: [] } }, { link_student_by_email: { data: [{ linked: false, student_id: null, reason: "student_no_profile" }] } });
    expect(await loadParentDashboard(db)).toEqual({ kind: "pending", studentEmail: "anna@school.org", reason: "student_no_profile" });
  });

  it("has nothing to link without a registered email", async () => {
    const { db, rpc } = client({ parent_student_links: { data: [] } }, {}, {});
    expect(await loadParentDashboard(db)).toEqual({ kind: "pending", studentEmail: null, reason: "no_email" });
    expect(rpc).not.toHaveBeenCalledWith("link_student_by_email", expect.anything());
  });

  it("uses an existing link without asking again", async () => {
    const { db, rpc } = client({ parent_student_links: { data: [{ student_id: "s1" }] } });
    expect((await loadParentDashboard(db)).kind).toBe("linked");
    expect(rpc).not.toHaveBeenCalledWith("link_student_by_email", expect.anything());
  });
});

describe("loadParentMap", () => {
  it("follows the student's level and progress", async () => {
    const { db } = client({ parent_student_links: { data: [{ student_id: "s1" }] }, profiles: { data: [], single: { username: "anna", level: "beginner" } } });
    expect(await loadParentMap(db)).toMatchObject({ level: "beginner", studentName: "anna", linked: true });
  });

  it("shows the default level with no progress before a student is linked", async () => {
    const { db } = client({ parent_student_links: { data: [] } });
    expect(await loadParentMap(db)).toMatchObject({ level: "elementary", studentName: null, linked: false });
  });
});
