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

/**
 * Maps each numeric weight to the specific Nunito font file loaded via
 * `@expo-google-fonts/nunito`. React Native has no `font-weight` fake-bolding for
 * custom fonts — the family name itself carries the weight.
 */
export const fontFamilyByWeight: Record<(typeof fontWeight)[keyof typeof fontWeight], string> = {
  "400": "Nunito_400Regular",
  "500": "Nunito_500Medium",
  "600": "Nunito_600SemiBold",
  "700": "Nunito_700Bold",
  "800": "Nunito_800ExtraBold",
  "900": "Nunito_900Black",
};

/**
 * `SlayText`'s eight variants, one row per `src/styles/typography.css` class. `vw`
 * is the clamp's fluid percentage — `fluidFontSize` reproduces
 * `clamp(min, vw/100 * width, max)` at a given viewport width, in points.
 *
 * At the 390pt design width every variant lands on its `min`, per design/SCN-5.
 */
export const typeScale = {
  display: {
    min: 40,
    vw: 10,
    max: 64,
    weight: fontWeight.black,
    lineHeightRatio: lineHeight.tight,
    letterSpacingEm: letterSpacingEm.tight,
    uppercase: false,
  },
  h1: {
    min: 28,
    vw: 7,
    max: 40,
    weight: fontWeight.extrabold,
    lineHeightRatio: lineHeight.tight,
    letterSpacingEm: letterSpacingEm.tight,
    uppercase: false,
  },
  h2: {
    min: 20,
    vw: 5,
    max: 28,
    weight: fontWeight.bold,
    lineHeightRatio: lineHeight.snug,
    letterSpacingEm: letterSpacingEm.normal,
    uppercase: false,
  },
  h3: {
    min: 16,
    vw: 4,
    max: 20,
    weight: fontWeight.bold,
    lineHeightRatio: lineHeight.snug,
    letterSpacingEm: letterSpacingEm.normal,
    uppercase: false,
  },
  body: {
    min: 14,
    vw: 3.5,
    max: 16,
    weight: fontWeight.regular,
    lineHeightRatio: lineHeight.normal,
    letterSpacingEm: letterSpacingEm.normal,
    uppercase: false,
  },
  bodyStrong: {
    min: 14,
    vw: 3.5,
    max: 16,
    weight: fontWeight.semibold,
    lineHeightRatio: lineHeight.normal,
    letterSpacingEm: letterSpacingEm.normal,
    uppercase: false,
  },
  small: {
    min: 12,
    vw: 3,
    max: 14,
    weight: fontWeight.medium,
    lineHeightRatio: lineHeight.snug,
    letterSpacingEm: letterSpacingEm.normal,
    uppercase: false,
  },
  label: {
    min: 10,
    vw: 2.5,
    max: 12,
    weight: fontWeight.bold,
    lineHeightRatio: lineHeight.snug,
    letterSpacingEm: letterSpacingEm.widest,
    uppercase: true,
  },
} as const;

export type TextVariant = keyof typeof typeScale;

/**
 * Reproduces the web's `clamp(min, vw, max)` fluid font size at a concrete
 * viewport width, in points. Pass `useWindowDimensions().width`.
 */
export function fluidFontSize(variant: TextVariant, width: number): number {
  const { min, vw, max } = typeScale[variant];
  const preferred = (vw / 100) * width;
  return Math.min(Math.max(min, preferred), max);
}
