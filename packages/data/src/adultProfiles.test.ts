import { describe, expect, it, vi } from "vitest";

import { DEFAULT_MASCOT_IMAGE } from "@slay/core";

import { loadParentProfile, loadTeacherProfile } from "./adultProfiles";

type Result = { data: unknown; error?: unknown };

/**
 * A query chain per table. `singles` is a queue: each `maybeSingle()` on that
 * table takes the next row, so the parent's own profile and their student's
 * can differ.
 */
function client(tables: Record<string, { list?: unknown[]; singles?: unknown[]; error?: unknown }>, user: unknown = { id: "u1", email: "kate@school.org" }) {
  const chain = (table: string): unknown =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          const spec = tables[table] ?? {};
          const listResult: Result = { data: spec.list ?? [], error: spec.error ?? null };
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve(listResult);
          if (prop === "maybeSingle") return () => Promise.resolve({ data: spec.singles?.shift() ?? null, error: spec.error ?? null });
          return () => chain(table);
        },
      },
    );
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => chain(table)),
    rpc: vi.fn(() => Promise.resolve({ data: ["elementary", "beginner"], error: null })),
  } as never;
}

describe("loadTeacherProfile", () => {
  it("reads the teacher's name, email and map level, with the plain snake as avatar", async () => {
    const db = client({ profiles: { singles: [{ username: "ms_kate", level: "elementary" }] } });
    const profile = await loadTeacherProfile(db);
    expect(profile).toMatchObject({ username: "ms_kate", email: "kate@school.org", level: "elementary", availableLevels: ["beginner", "elementary"] });
    expect(profile.mascotImageUrl).toBe(DEFAULT_MASCOT_IMAGE);
  });

  it("falls back to the default level when the stored one is unknown", async () => {
    const db = client({ profiles: { singles: [{ username: null, level: "wizard" }] } });
    expect(await loadTeacherProfile(db)).toMatchObject({ username: null, level: "elementary" });
  });

  it("refuses without a session", async () => {
    await expect(loadTeacherProfile(client({}, null))).rejects.toThrow("Not signed in.");
  });

  it("surfaces a failed profile read", async () => {
    await expect(loadTeacherProfile(client({ profiles: { error: new Error("rls") } }))).rejects.toThrow("rls");
  });
});

describe("loadParentProfile", () => {
  it("reads the parent's account and the linked student's name and level", async () => {
    const db = client({
      profiles: { singles: [{ username: "mum" }, { username: "anna", level: "beginner" }] },
      parent_student_links: { list: [{ student_id: "s1" }] },
    });
    expect(await loadParentProfile(db)).toEqual({ username: "mum", email: "kate@school.org", student: { username: "anna", level: "beginner" } });
  });

  it("has no student before one is linked", async () => {
    const db = client({ profiles: { singles: [{ username: "mum" }] } });
    expect(await loadParentProfile(db)).toMatchObject({ username: "mum", student: null });
  });
});
