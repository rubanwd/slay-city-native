import { describe, expect, it } from "vitest";

import { fluidFontSize, fontSize } from "./typography";

describe("fluidFontSize", () => {
  it("renders the whole scale at its minimum on the 390pt design width", () => {
    // Every preferred vw value falls below its minimum at 390 — h1 is 7vw = 27.3.
    for (const token of Object.keys(fontSize) as (keyof typeof fontSize)[]) {
      expect(fluidFontSize(token, 390)).toBe(fontSize[token].min);
      expect(fontSize[token].default).toBe(fontSize[token].min);
    }
  });

  it("tracks the viewport between the bounds, like the web's clamp()", () => {
    // 430pt — the widest current phones.
    expect(fluidFontSize("display", 430)).toBeCloseTo(43);
    expect(fluidFontSize("h1", 430)).toBeCloseTo(30.1);
    expect(fluidFontSize("body", 430)).toBeCloseTo(15.05);
  });

  it("stops at the maximum on tablet widths", () => {
    expect(fluidFontSize("display", 768)).toBe(64);
    expect(fluidFontSize("body", 768)).toBe(16);
    expect(fluidFontSize("label", 1024)).toBe(12);
  });

  it("never drops below the minimum on narrow phones", () => {
    expect(fluidFontSize("h1", 320)).toBe(28);
    expect(fluidFontSize("small", 320)).toBe(12);
  });
});
