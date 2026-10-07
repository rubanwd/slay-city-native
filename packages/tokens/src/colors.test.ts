import { describe, expect, it } from "vitest";

import { alpha, artwork, colors, lockedBrandColors, withAlpha } from "./colors";

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

describe("artwork", () => {
  it("carries CoinIcon's own palette, so no raw hex reaches the component", () => {
    expect(artwork.coin).toEqual({
      rim: "#E0A11B",
      face: "#FFCE45",
      starShadow: "#7BB800",
      text: "#FDE047",
      rain: "#FACC15",
    });
  });

  it("names the fallback map sky and skyline", () => {
    expect(artwork.map).toEqual({
      skyTop: "#241246",
      skyMid: "#0A0616",
      skyline: "#160A2B",
    });
  });

  it("shares no value with the locked brand palette", () => {
    const brand = new Set<string>(Object.values(lockedBrandColors));
    const artworkValues = [...Object.values(artwork.coin), ...Object.values(artwork.map)];
    expect(artworkValues.filter((value) => brand.has(value))).toEqual([]);
  });
});

describe("alpha", () => {
  it("covers every white opacity the design system uses", () => {
    expect(Object.keys(alpha)).toEqual([
      "white5",
      "white10",
      "white15",
      "white20",
      "white25",
      "white40",
      "white50",
      "white60",
      "white70",
      "white80",
      "black10",
    ]);
  });
});
