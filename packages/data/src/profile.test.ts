import { describe, expect, it, vi } from "vitest";

import { changeMyUsername } from "./profile";

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
