import { describe, expect, it } from "vitest";

import { colors, withAlpha } from "./colors";

describe("withAlpha", () => {
  it("converts a brand hex to an rgba string at the given opacity", () => {
    expect(withAlpha(colors.neonPink, 0.6)).toBe("rgba(255, 45, 142, 0.6)");
    expect(withAlpha(colors.limeGreen, 0.2)).toBe("rgba(157, 255, 0, 0.2)");
    expect(withAlpha(colors.cyan, 0.4)).toBe("rgba(0, 240, 255, 0.4)");
    expect(withAlpha(colors.purple, 0.25)).toBe("rgba(106, 0, 255, 0.25)");
  });
});
