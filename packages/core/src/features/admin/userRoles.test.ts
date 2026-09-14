import { describe, expect, it } from "vitest";

import {
  USER_ROLES,
  formatUserDate,
  isUserRole,
  userAdminErrorMessage,
  userRoleLabel,
} from "./userRoles";

describe("isUserRole", () => {
  it("accepts every role the console offers", () => {
    for (const role of USER_ROLES) {
      expect(isUserRole(role)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isUserRole("child")).toBe(false);
    expect(isUserRole("")).toBe(false);
    expect(isUserRole(null)).toBe(false);
    expect(isUserRole(undefined)).toBe(false);
    expect(isUserRole(3)).toBe(false);
  });
});

describe("userRoleLabel", () => {
  it("names the known roles", () => {
    expect(userRoleLabel("admin")).toBe("Admin");
    expect(userRoleLabel("student")).toBe("Student");
  });

  it("calls a missing role what it is — an account without a profile", () => {
    expect(userRoleLabel(null)).toBe("No profile");
    expect(userRoleLabel(undefined)).toBe("No profile");
  });

  it("falls back to the raw value for an unknown role", () => {
    expect(userRoleLabel("wizard")).toBe("wizard");
  });
});

describe("userAdminErrorMessage", () => {
  it("explains the guards the RPCs enforce", () => {
    expect(userAdminErrorMessage("cannot_change_self", "nope")).toContain("your own role");
    expect(userAdminErrorMessage("cannot_delete_self", "nope")).toContain("your own account");
    expect(userAdminErrorMessage("username_taken", "nope")).toContain("already taken");
  });

  it("uses the caller's fallback for anything it doesn't recognise", () => {
    expect(userAdminErrorMessage("something_new", "Couldn't do that.")).toBe("Couldn't do that.");
    expect(userAdminErrorMessage(null, "Couldn't do that.")).toBe("Couldn't do that.");
    expect(userAdminErrorMessage(undefined, "Couldn't do that.")).toBe("Couldn't do that.");
  });
});

describe("formatUserDate", () => {
  it("formats a timestamp in UTC, so the server and browser agree", () => {
    expect(formatUserDate("2026-08-10T20:12:00Z")).toBe("10 Aug 2026");
    // Late-evening UTC must not roll forward a day for a reader east of UTC.
    expect(formatUserDate("2026-01-01T23:59:59Z")).toBe("1 Jan 2026");
  });

  it("returns an empty string for missing or unparseable input", () => {
    expect(formatUserDate(null)).toBe("");
    expect(formatUserDate(undefined)).toBe("");
    expect(formatUserDate("not a date")).toBe("");
  });
});
