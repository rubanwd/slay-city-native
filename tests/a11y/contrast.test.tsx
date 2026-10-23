import { describe, expect, it } from "vitest";

import { alpha, colors } from "@slay/tokens";

/**
 * WP-6.6: text meets WCAG AA (4.5:1) against the ground (`#111111`) and the
 * card surface. Every grey in the product is white at an opacity, so the
 * check is on the opacity: `alpha.white50` is the faintest text that passes.
 * `scripts/a11y-contrast.test.mjs` keeps fainter greys out of the screens.
 */
const AA = 4.5;

function channel(value: number) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance([r, g, b]: number[]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function rgb(hex: string) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** A colour token (hex or rgba of white/black) composited over a ground. */
function over(color: string, ground: string) {
  const g = rgb(ground);
  const m = /rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/.exec(color);
  if (!m) return rgb(color);
  const a = Number(m[4]);
  return [1, 2, 3].map((i, k) => Math.round(a * Number(m[i]) + (1 - a) * g[k]));
}
function contrast(color: string, ground: string) {
  const [l1, l2] = [luminance(over(color, ground)), luminance(rgb(ground))].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

const GROUNDS = { ground: colors.black, surface: colors.surface };

describe("text colours", () => {
  it.each(Object.entries(GROUNDS))("pass AA on the %s", (_name, ground) => {
    for (const color of [alpha.white50, alpha.white60, alpha.white70, alpha.white80, colors.white, colors.neonPink, colors.limeGreen, colors.cyan]) {
      expect(contrast(color, ground), color).toBeGreaterThanOrEqual(AA);
    }
  });

  it("knows where the line is: 40% white is too faint to read", () => {
    expect(contrast(alpha.white40, colors.black)).toBeLessThan(AA);
  });
});
