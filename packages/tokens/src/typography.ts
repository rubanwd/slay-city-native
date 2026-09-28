/**
 * Type scale, ported from the web's `src/styles/typography.css`.
 *
 * The web sizes are fluid — `clamp(min, <vw>vw, max)` — so each entry keeps all
 * three numbers. `fluidFontSize()` reproduces the clamp from the window width,
 * which is what the web actually renders; `default` is its value at the 390pt
 * design width.
 *
 * Note where that lands: every preferred value sits BELOW its minimum at 390
 * (h1 is 7vw = 27.3 < 28), so on a phone the whole scale renders at or just
 * above its minimum. The maximums are only reached on tablet-width screens
 * (display at 640pt, body at 457pt). Hardcoding the maximums reads as the
 * design and is about 15% too large on every phone.
 *
 * Values are in points. The web authors them in rem against a 16px root.
 */
export const fontSize = {
  display: { min: 40, vw: 10, max: 64, default: 40 },
  h1: { min: 28, vw: 7, max: 40, default: 28 },
  h2: { min: 20, vw: 5, max: 28, default: 20 },
  h3: { min: 16, vw: 4, max: 20, default: 16 },
  body: { min: 14, vw: 3.5, max: 16, default: 14 },
  small: { min: 12, vw: 3, max: 14, default: 12 },
  label: { min: 10, vw: 2.5, max: 12, default: 10 },
} as const;

export type FontSizeToken = keyof typeof fontSize;

/**
 * The size the web renders for `token` on a window `width` points wide —
 * `clamp(min, width * vw / 100, max)`, exactly as `typography.css` declares it.
 * Pass `useWindowDimensions().width`.
 */
export function fluidFontSize(token: FontSizeToken, width: number): number {
  const { min, vw, max } = fontSize[token];
  return Math.min(max, Math.max(min, (width * vw) / 100));
}

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
} as const;

export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.65,
} as const;

/**
 * Letter spacing. The web authors these in em; React Native takes points, so each
 * value must be multiplied by the font size at the call site — `-0.02em` on 32pt
 * type is -0.64pt, not -0.02.
 */
export const letterSpacingEm = {
  tight: -0.02,
  normal: 0,
  wide: 0.05,
  widest: 0.12,
} as const;

/** Converts an em-based letter-spacing token to the points React Native expects. */
export function letterSpacing(token: keyof typeof letterSpacingEm, size: number): number {
  return letterSpacingEm[token] * size;
}

export const fontFamily = {
  primary: "Nunito",
} as const;
