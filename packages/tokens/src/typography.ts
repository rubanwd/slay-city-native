/**
 * Type scale, ported from the web's `src/styles/typography.css`.
 *
 * The web sizes are fluid — `clamp(min, <vw>vw, max)`. `fluidFontSize()` below
 * reproduces the clamp from the window width, which is what the web actually
 * renders.
 *
 * Note where that lands: every preferred value sits BELOW its minimum at 390
 * (h1 is 7vw = 27.3 < 28), so on a phone the whole scale renders at or just
 * above its minimum. The maximums are only reached on tablet-width screens
 * (display at 640pt, body at 457pt). Hardcoding the maximums reads as the
 * design and is about 15% too large on every phone.
 *
 * Values are in points. The web authors them in rem against a 16px root.
 */
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
