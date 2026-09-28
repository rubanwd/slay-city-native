import { Text, useWindowDimensions, type TextProps, type TextStyle } from "react-native";

import { colors, fluidFontSize, fontFamilyByWeight, fontWeight, typeScale, type TextVariant } from "@slay/tokens";

export interface SlayTextProps extends TextProps {
  /** @default "body" */
  variant?: TextVariant;
  /**
   * Overrides the variant's default font weight while keeping its size, line
   * height and letter spacing — e.g. an input's error message is `variant="small"`
   * at web weight 600, not `small`'s own 500.
   */
  weight?: (typeof fontWeight)[keyof typeof fontWeight];
  /** @default colors.white */
  color?: string;
}

/**
 * The design system's only text primitive (design/SCN-5 "SlayText"). Sizes itself
 * with `fluidFontSize(variant, width)` from `@slay/tokens`, reproducing the web's
 * `clamp(min, vw, max)` type scale — at the 390pt design width every variant
 * renders at its minimum.
 */
export function SlayText({ variant = "body", weight, color = colors.white, style, ...rest }: SlayTextProps) {
  const { width } = useWindowDimensions();
  const scale = typeScale[variant];
  const size = fluidFontSize(variant, width);

  const textStyle: TextStyle = {
    fontFamily: fontFamilyByWeight[weight ?? scale.weight],
    fontSize: size,
    lineHeight: scale.lineHeightRatio * size,
    letterSpacing: scale.letterSpacingEm * size,
    color,
    textTransform: scale.uppercase ? "uppercase" : undefined,
  };

  return <Text style={[textStyle, style]} {...rest} />;
}
