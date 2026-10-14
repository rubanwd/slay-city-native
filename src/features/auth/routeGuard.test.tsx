import type { Session } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { resolveRedirect } from "./routeGuard";

const SESSION = { access_token: "t" } as Session;

describe("resolveRedirect", () => {
  it("stays put while the session is still loading", () => {
    expect(resolveRedirect(["(student)", "map"], undefined, undefined)).toBeNull();
  });

  it("stays put while the role is still loading, once signed in", () => {
    expect(resolveRedirect(["(student)", "map"], SESSION, undefined)).toBeNull();
  });

  it("sends a signed-out user to login", () => {
    expect(resolveRedirect(["(student)", "map"], null, null)).toBe("/login");
    expect(resolveRedirect([], null, null)).toBe("/login");
  });

  it("leaves a signed-out user already inside (auth) alone", () => {
    expect(resolveRedirect(["(auth)", "login"], null, null)).toBeNull();
    expect(resolveRedirect(["(auth)", "register"], null, null)).toBeNull();
  });

  it("bounces a signed-in user off login/register to their role home", () => {
    expect(resolveRedirect(["(auth)", "login"], SESSION, "student")).toBe("/map");
    expect(resolveRedirect(["(auth)", "register"], SESSION, "parent")).toBe("/progress");
  });

  it("leaves a signed-in user on the callback or reset-password screens alone", () => {
    expect(resolveRedirect(["(auth)", "callback"], SESSION, "student")).toBeNull();
    expect(resolveRedirect(["(auth)", "reset-password"], SESSION, "teacher")).toBeNull();
    // Even before the role query has resolved — neither screen needs it.
    expect(resolveRedirect(["(auth)", "callback"], SESSION, undefined)).toBeNull();
    expect(resolveRedirect(["(auth)", "reset-password"], SESSION, undefined)).toBeNull();
  });

  it("leaves a student inside (student) alone and sends one elsewhere to /map", () => {
    expect(resolveRedirect(["(student)", "wardrobe"], SESSION, "student")).toBeNull();
    expect(resolveRedirect(["(teacher)", "groups"], SESSION, "student")).toBe("/map");
    expect(resolveRedirect(["(auth)", "login"], SESSION, "student")).toBe("/map");
  });

  it("leaves a teacher inside (teacher) alone and sends one elsewhere to /groups", () => {
    expect(resolveRedirect(["(teacher)", "teacher-map"], SESSION, "teacher")).toBeNull();
    expect(resolveRedirect(["(student)", "map"], SESSION, "teacher")).toBe("/groups");
    expect(resolveRedirect([], SESSION, "teacher")).toBe("/groups");
  });

  it("leaves a parent inside (parent) alone and sends one elsewhere to /progress", () => {
    expect(resolveRedirect(["(parent)", "parent-profile"], SESSION, "parent")).toBeNull();
    expect(resolveRedirect(["(student)", "map"], SESSION, "parent")).toBe("/progress");
    expect(resolveRedirect([], SESSION, "parent")).toBe("/progress");
  });

  it("leaves an admin on the admin screen alone and sends one elsewhere to /admin", () => {
    expect(resolveRedirect(["admin"], SESSION, "admin")).toBeNull();
    expect(resolveRedirect(["(student)", "map"], SESSION, "admin")).toBe("/admin");
    expect(resolveRedirect(["(auth)", "login"], SESSION, "admin")).toBe("/admin");
  });

  it("falls back a null (no-profile) role to the student home", () => {
    expect(resolveRedirect(["(student)", "map"], SESSION, null)).toBeNull();
    expect(resolveRedirect(["(teacher)", "groups"], SESSION, null)).toBe("/map");
  });
});
