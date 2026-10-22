import { describe, expect, it } from "vitest";

import { decideRoute, type GuardInput } from "./routeGuard";

const as = (role: string) => ({ kind: "profile", role }) as const;
const needsOnboarding = { kind: "needs-onboarding" } as const;

function decide(input: Partial<GuardInput> & Pick<GuardInput, "pathname">) {
  return decideRoute({ signedIn: true, account: undefined, allowDevRoutes: false, ...input });
}

const allow = { kind: "allow" };
const to = (path: string) => ({ kind: "redirect", to: path });

describe("signed out", () => {
  it("may use the auth screens", () => {
    for (const pathname of ["/auth/login", "/auth/register", "/auth/forgot-password", "/auth/callback"]) {
      expect(decide({ pathname, signedIn: false })).toEqual(allow);
    }
  });

  it("goes from / to login", () => {
    expect(decide({ pathname: "/", signedIn: false })).toEqual(to("/auth/login"));
  });

  it("goes from a protected deep link to login, remembering the target (AC3)", () => {
    expect(decide({ pathname: "/teacher/map", signedIn: false })).toEqual(to("/auth/login?next=%2Fteacher%2Fmap"));
  });

  it("does not reach dev screens outside a development build", () => {
    expect(decide({ pathname: "/dev/ui", signedIn: false })).toEqual(to("/auth/login?next=%2Fdev%2Fui"));
    expect(decide({ pathname: "/dev/ui", signedIn: false, allowDevRoutes: true })).toEqual(allow);
  });
});

describe("signed in", () => {
  it("waits for the account before deciding anything outside the auth flow", () => {
    expect(decide({ pathname: "/map" })).toEqual({ kind: "wait" });
    expect(decide({ pathname: "/auth/login" })).toEqual({ kind: "wait" });
  });

  it("stays on the callback and the reset screen, which need a session on purpose", () => {
    expect(decide({ pathname: "/auth/callback" })).toEqual(allow);
    expect(decide({ pathname: "/auth/reset-password", account: as("student") })).toEqual(allow);
  });

  it.each([
    ["student", "/map"],
    ["teacher", "/teacher"],
    ["parent", "/parent"],
    ["admin", "/admin"],
  ])("lands a %s on %s from / and from login (AC2)", (role, home) => {
    expect(decide({ pathname: "/", account: as(role) })).toEqual(to(home));
    expect(decide({ pathname: "/auth/login", account: as(role) })).toEqual(to(home));
    expect(decide({ pathname: home, account: as(role) })).toEqual(allow);
  });

  it("returns to the remembered target after login (AC3)", () => {
    expect(decide({ pathname: "/auth/login", next: "/teacher/map", account: as("teacher") })).toEqual(
      to("/teacher/map"),
    );
  });

  it("ignores a target that is not an in-app path", () => {
    for (const next of ["https://evil.example", "//evil.example", "/auth/register"]) {
      expect(decide({ pathname: "/auth/login", next, account: as("student") })).toEqual(to("/map"));
    }
  });

  it("sends a profile-less user to onboarding, and only there", () => {
    expect(decide({ pathname: "/map", account: needsOnboarding })).toEqual(to("/onboarding"));
    expect(decide({ pathname: "/auth/login", account: needsOnboarding })).toEqual(to("/onboarding"));
    expect(decide({ pathname: "/onboarding", account: needsOnboarding })).toEqual(allow);
  });

  it("sends a user with a profile out of onboarding", () => {
    expect(decide({ pathname: "/onboarding", account: as("student") })).toEqual(to("/map"));
  });
});

describe("role areas (AC2)", () => {
  it("keeps a student out of the teacher, parent and admin areas", () => {
    // Including the teacher's review of the game (WP-5.7): only a teacher may enter it.
    for (const pathname of ["/teacher", "/teacher/map", "/teacher/mission/m1", "/teacher/location/l1", "/parent", "/parent/profile", "/admin"]) {
      expect(decide({ pathname, account: as("student") })).toEqual(to("/map"));
    }
    for (const pathname of ["/map", "/wardrobe", "/homework", "/profile"]) {
      expect(decide({ pathname, account: as("student") })).toEqual(allow);
    }
  });

  it("keeps a teacher in the teacher area", () => {
    expect(decide({ pathname: "/teacher/profile", account: as("teacher") })).toEqual(allow);
    for (const pathname of ["/map", "/parent", "/admin"]) {
      expect(decide({ pathname, account: as("teacher") })).toEqual(to("/teacher"));
    }
  });

  it("keeps a parent in the parent area", () => {
    expect(decide({ pathname: "/parent/map", account: as("parent") })).toEqual(allow);
    for (const pathname of ["/map", "/teacher", "/admin"]) {
      expect(decide({ pathname, account: as("parent") })).toEqual(to("/parent"));
    }
  });

  it("keeps an admin on the web-only notice", () => {
    for (const pathname of ["/map", "/teacher", "/parent"]) {
      expect(decide({ pathname, account: as("admin") })).toEqual(to("/admin"));
    }
  });

  it("does not mistake a path that merely starts with an area's name for the area", () => {
    expect(decide({ pathname: "/parentx", account: as("student") })).toEqual(allow);
  });
});
