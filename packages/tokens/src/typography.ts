/**
 * Type scale, ported from the web's `src/styles/typography.css`.
 *
 * The web sizes are fluid — `clamp(min, vw, max)` — which React Native cannot
 * express. Each entry keeps the clamp's minimum and maximum so a caller can pick
 * (or interpolate) deliberately, rather than hardcoding one of the two and losing
 * the intent. `default` is the phone-width value: SLAY CITY is designed at 390pt,
 * where most of the scale sits at or near its maximum.
 *
 * Values are in points. The web authors them in rem against a 16px root.
 */
export const fontSize = {
  display: { min: 40, max: 64, default: 48 },
  h1: { min: 28, max: 40, default: 32 },
  h2: { min: 20, max: 28, default: 22 },
  h3: { min: 16, max: 20, default: 18 },
  body: { min: 14, max: 16, default: 16 },
  small: { min: 12, max: 14, default: 14 },
  label: { min: 10, max: 12, default: 12 },
} as const;

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
