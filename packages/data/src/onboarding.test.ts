import { describe, expect, it, vi } from "vitest";

import { createProfile } from "./onboarding";

function client({
  user = { id: "u1" } as { id: string } | null,
  levels = ["elementary"] as unknown,
  createError = null as { code?: string; message: string } | null,
} = {}) {
  const rpc = vi.fn((fn: string) =>
    Promise.resolve(fn === "available_knowledge_levels" ? { data: levels, error: null } : { data: null, error: createError }),
  );
  return { db: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) }, rpc } as never, rpc };
}

const input = { username: "  Anna   Maria ", age: "9", level: "elementary" };

describe("createProfile", () => {
  it("creates the profile with the normalised name, the age and the level", async () => {
    const { db, rpc } = client();
    expect(await createProfile(db, input)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("create_my_profile", { p_username: "Anna Maria", p_age: 9, p_level: "elementary" });
  });

  it("leaves a blank age out", async () => {
    const { db, rpc } = client();
    await createProfile(db, { ...input, age: "  " });
    expect(rpc).toHaveBeenCalledWith("create_my_profile", { p_username: "Anna Maria", p_age: undefined, p_level: "elementary" });
  });

  it("refuses a bad name or age before calling the database", async () => {
    const { db, rpc } = client();
    expect(await createProfile(db, { ...input, username: "A" })).toEqual({ ok: false, error: "Username must be at least 2 characters." });
    expect(await createProfile(db, { ...input, age: "120" })).toEqual({ ok: false, error: "Age must be between 5 and 90." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("re-checks the level against the levels with content", async () => {
    expect(await createProfile(client({ levels: [] }).db, input)).toEqual({
      ok: false,
      error: "No levels are open yet. Please try again later.",
    });
    expect(await createProfile(client().db, { ...input, level: null })).toEqual({ ok: false, error: "Choose your level." });
    expect(await createProfile(client().db, { ...input, level: "beginner" })).toEqual({
      ok: false,
      error: "Beginner has no content yet. Pick another level.",
    });
  });

  it("says when the session is gone", async () => {
    expect(await createProfile(client({ user: null }).db, input)).toEqual({
      ok: false,
      error: "Your session expired. Please log in again.",
    });
  });

  it("turns a duplicate name into the 'taken' message and passes anything else through", async () => {
    expect(await createProfile(client({ createError: { code: "23505", message: "duplicate key" } }).db, input)).toEqual({
      ok: false,
      error: "That username is already taken.",
    });
    expect(await createProfile(client({ createError: { code: "22023", message: "Bad level" } }).db, input)).toEqual({
      ok: false,
      error: "Bad level",
    });
  });
});
