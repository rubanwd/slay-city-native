import { describe, expect, it } from "vitest";

import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  checkUsername,
  normalizeUsername,
  usernameProblemMessage,
} from "./username";

describe("normalizeUsername", () => {
  it("trims the edges", () => {
    expect(normalizeUsername("  Anastasia  ")).toBe("Anastasia");
  });

  it("collapses runs of whitespace inside the name", () => {
    expect(normalizeUsername("Anna   Maria")).toBe("Anna Maria");
  });

  it("turns exotic whitespace into a plain space", () => {
    expect(normalizeUsername("Anna\u00a0Maria")).toBe("Anna Maria");
    expect(normalizeUsername("Anna\tMaria")).toBe("Anna Maria");
  });
});

describe("checkUsername", () => {
  it("accepts a plain latin name", () => {
    expect(checkUsername("Anastasia")).toEqual({ ok: true, username: "Anastasia" });
  });

  it("accepts a full name that the old 20-character cap cut off", () => {
    expect(checkUsername("Anastasia Volodymyrivna")).toEqual({
      ok: true,
      username: "Anastasia Volodymyrivna",
    });
  });

  it("accepts non-latin alphabets", () => {
    for (const name of ["Анастасія", "Анастасия", "Ольга-Марія", "オリガ", "Ζωή"]) {
      expect(checkUsername(name)).toEqual({ ok: true, username: name });
    }
  });

  it("accepts the punctuation that occurs inside real names", () => {
    for (const name of ["O'Brien", "O’Brien", "Marie-Claire", "J.R.", "slay_queen", "Anna 2"]) {
      expect(checkUsername(name)).toEqual({ ok: true, username: name });
    }
  });

  it("normalizes before validating", () => {
    expect(checkUsername("  Anna   Maria  ")).toEqual({ ok: true, username: "Anna Maria" });
  });

  it("rejects names shorter than the minimum", () => {
    expect(checkUsername("A")).toEqual({ ok: false, problem: "too_short" });
    expect(checkUsername("   ")).toEqual({ ok: false, problem: "too_short" });
    expect(checkUsername("")).toEqual({ ok: false, problem: "too_short" });
  });

  it("rejects names longer than the maximum", () => {
    expect(checkUsername("a".repeat(USERNAME_MAX_LENGTH))).toEqual({
      ok: true,
      username: "a".repeat(USERNAME_MAX_LENGTH),
    });
    expect(checkUsername("a".repeat(USERNAME_MAX_LENGTH + 1))).toEqual({
      ok: false,
      problem: "too_long",
    });
  });

  it("counts length in code points, not UTF-16 units", () => {
    // 𝒜 is a single letter stored as a surrogate pair.
    const name = "𝒜".repeat(USERNAME_MAX_LENGTH);
    expect(checkUsername(name)).toEqual({ ok: true, username: name });
  });

  it("rejects characters that could impersonate or break layout", () => {
    for (const name of ["anna@slay", "anna/maria", "<script>", "anna\u0007b", "anna\u{1f389}"]) {
      expect(checkUsername(name)).toEqual({ ok: false, problem: "invalid_chars" });
    }
  });

  it("rejects punctuation-only names", () => {
    expect(checkUsername("...")).toEqual({ ok: false, problem: "needs_letter" });
    expect(checkUsername("--")).toEqual({ ok: false, problem: "needs_letter" });
  });
});

describe("usernameProblemMessage", () => {
  it("has wording for every problem", () => {
    for (const problem of [
      "too_short",
      "too_long",
      "invalid_chars",
      "needs_letter",
      "taken",
      "unknown",
    ] as const) {
      expect(usernameProblemMessage(problem)).toBeTruthy();
    }
  });

  it("quotes the real limits", () => {
    expect(usernameProblemMessage("too_short")).toContain(String(USERNAME_MIN_LENGTH));
    expect(usernameProblemMessage("too_long")).toContain(String(USERNAME_MAX_LENGTH));
  });
});
