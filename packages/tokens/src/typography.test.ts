import { describe, expect, it } from "vitest";

import { fluidFontSize, typeScale } from "./typography";

describe("fluidFontSize", () => {
  it("returns each variant's minimum at the 390pt design width", () => {
    for (const variant of Object.keys(typeScale) as (keyof typeof typeScale)[]) {
      expect(fluidFontSize(variant, 390)).toBe(typeScale[variant].min);
    }
  });

  it("grows with viewport width below the max", () => {
    expect(fluidFontSize("h1", 430)).toBeCloseTo(30.1, 1);
  });

  it("clamps at the maximum on very wide viewports", () => {
    expect(fluidFontSize("display", 2000)).toBe(64);
  });

  it("clamps at the minimum on very narrow viewports", () => {
    expect(fluidFontSize("label", 100)).toBe(10);
  });
});
