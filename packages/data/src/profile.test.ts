import { describe, expect, it, vi } from "vitest";

import { changeMyUsername, getMyRole } from "./profile";

describe("changeMyUsername", () => {
  it("rejects an invalid username without touching the database", async () => {
    const from = vi.fn();
    const db = { from } as never;

    expect(await changeMyUsername(db, "a")).toEqual({ ok: false, problem: "too_short" });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects when signed out", async () => {
    const db = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as never;

    expect(await changeMyUsername(db, "Ann")).toEqual({ ok: false, problem: "unknown" });
  });

  it("updates profiles.username for the caller's own row", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const db = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from,
    } as never;

    expect(await changeMyUsername(db, "  Ann  Marie ")).toEqual({ ok: true, username: "Ann Marie" });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ username: "Ann Marie" });
    expect(eq).toHaveBeenCalledWith("id", "u1");
  });

  it("maps a unique-violation to the 'taken' problem", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { code: "23505" } });
    const from = vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue({ eq }) });
    const db = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from,
    } as never;

    expect(await changeMyUsername(db, "Ann")).toEqual({ ok: false, problem: "taken" });
  });
});

describe("getMyRole", () => {
  it("returns null when signed out, without querying profiles", async () => {
    const from = vi.fn();
    const db = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from,
    } as never;

    expect(await getMyRole(db)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("returns the caller's role from profiles", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { role: "teacher" } });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const db = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from,
    } as never;

    expect(await getMyRole(db)).toBe("teacher");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("role");
    expect(eq).toHaveBeenCalledWith("id", "u1");
  });

  it("returns null when there is no profile row yet", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const from = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) });
    const db = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from,
    } as never;

    expect(await getMyRole(db)).toBeNull();
  });
});
