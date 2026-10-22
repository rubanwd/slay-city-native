import { describe, expect, it } from "vitest";

import { MAX_AGE, MIN_AGE, parseAge } from "./age";

describe("parseAge", () => {
  it("treats a blank field as no age", () => {
    expect(parseAge("")).toEqual({ ok: true, age: null });
    expect(parseAge("   ")).toEqual({ ok: true, age: null });
  });

  it("accepts the whole 5–90 range, inclusive", () => {
    expect(MIN_AGE).toBe(5);
    expect(MAX_AGE).toBe(90);
    for (const n of [5, 6, 14, 15, 40, 90]) {
      expect(parseAge(String(n))).toEqual({ ok: true, age: n });
    }
  });

  it("rejects ages outside the range and non-integers", () => {
    for (const raw of ["4", "91", "0", "-3", "12.5", "abc"]) {
      expect(parseAge(raw).ok).toBe(false);
    }
  });
});
