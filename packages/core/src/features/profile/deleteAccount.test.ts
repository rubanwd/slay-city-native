import { describe, expect, it } from "vitest";

import { deleteAccountProblem } from "./deleteAccount";

describe("deleteAccountProblem", () => {
  it("reads ok as deleted", () => {
    expect(deleteAccountProblem("ok")).toBeNull();
  });

  it("passes the refusals through", () => {
    expect(deleteAccountProblem("admin_account")).toBe("admin_account");
    expect(deleteAccountProblem("teacher_has_groups")).toBe("teacher_has_groups");
  });

  it("never reads a missing or unexpected reason as success", () => {
    expect(deleteAccountProblem(undefined)).toBe("unknown");
    expect(deleteAccountProblem(null)).toBe("unknown");
    expect(deleteAccountProblem("not_signed_in")).toBe("unknown");
    expect(deleteAccountProblem("")).toBe("unknown");
  });
});
