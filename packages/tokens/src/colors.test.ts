import { describe, expect, it } from "vitest";

import { colors, lockedBrandColors, withAlpha } from "./colors";

describe("lockedBrandColors", () => {
  it("has exactly six brand colours", () => {
    expect(Object.keys(lockedBrandColors)).toHaveLength(6);
  });

  it("matches the hex values locked by the web repository's AGENTS.md", () => {
    expect(lockedBrandColors).toEqual({
      neonPink: "#FF2D8E",
      limeGreen: "#9DFF00",
      cyan: "#00F0FF",
      purple: "#6A00FF",
      black: "#111111",
      white: "#FFFFFF",
    });
  });

  it("excludes neonOrange and surface, which are not part of the locked six", () => {
    expect(lockedBrandColors).not.toHaveProperty("neonOrange");
    expect(lockedBrandColors).not.toHaveProperty("surface");
  });
});

describe("withAlpha", () => {
  it("converts a brand hex to an rgba string at the given opacity", () => {
    expect(withAlpha(colors.neonPink, 0.6)).toBe("rgba(255, 45, 142, 0.6)");
    expect(withAlpha(colors.limeGreen, 0.2)).toBe("rgba(157, 255, 0, 0.2)");
    expect(withAlpha(colors.cyan, 0.4)).toBe("rgba(0, 240, 255, 0.4)");
    expect(withAlpha(colors.purple, 0.25)).toBe("rgba(106, 0, 255, 0.25)");
  });
});
