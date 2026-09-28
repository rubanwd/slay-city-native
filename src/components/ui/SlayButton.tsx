import { type ReactNode } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { alpha, colors, fontFamilyByWeight, radii } from "@slay/tokens";

import { SlayPressable, type SlayPressableProps } from "./SlayPressable";

export type SlayButtonVariant = "pink" | "green" | "ghost";
export type SlayButtonSize = "sm" | "md" | "lg";

export interface SlayButtonProps extends Omit<SlayPressableProps, "children" | "style" | "haptic" | "ripple"> {
  /** @default "pink" */
  variant?: SlayButtonVariant;
  /** @default "md" */
  size?: SlayButtonSize;
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: ReactNode;
  /** Hidden while `loading`. */
  iconRight?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * design/SCN-5 "SlayButton". Variant and size names match the web component
 * (`src/components/ui/SlayButton.tsx` upstream) so ported screens stay greppable
 * against it — do not rename to primary/secondary/tertiary.
 *
 * `md` is 52pt tall, not the web's broken `h-13` (see design/SCN-5 decision D5).
 * `sm` renders at 40pt with a `{top: 2, bottom: 2}` hitSlop so its touch target
 * still reaches 44pt (decision D9).
 */
const SIZES: Record<
  SlayButtonSize,
  {
    height: number;
    paddingHorizontal: number;
    fontSize: number;
    lineHeight: number;
    borderRadius: number;
    gap: number;
    letterSpacing: number;
  }
> = {
  sm: { height: 40, paddingHorizontal: 16, fontSize: 14, lineHeight: 20, borderRadius: radii.md, gap: 6, letterSpacing: 0.7 },
  md: { height: 52, paddingHorizontal: 24, fontSize: 16, lineHeight: 24, borderRadius: radii.lg, gap: 8, letterSpacing: 0.8 },
  lg: { height: 64, paddingHorizontal: 32, fontSize: 18, lineHeight: 28, borderRadius: radii.lg, gap: 10, letterSpacing: 0.9 },
};

const VARIANTS: Record<
  SlayButtonVariant,
  { background: string; text: string; borderColor?: string; pressedFill?: string }
> = {
  pink: { background: colors.neonPink, text: colors.white, pressedFill: alpha.black10 },
  green: { background: colors.limeGreen, text: colors.black, pressedFill: alpha.black10 },
  ghost: { background: "transparent", text: colors.white, borderColor: alpha.white25, pressedFill: alpha.white5 },
};

const SM_HIT_SLOP = { top: 2, bottom: 2 };

export function SlayButton({
  variant = "pink",
  size = "md",
  children,
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  style,
  hitSlop,
  ...rest
}: SlayButtonProps) {
  const sizeConfig = SIZES[size];
  const variantConfig = VARIANTS[variant];
  const isDisabled = disabled || loading;

  const containerStyle = ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
    styles.base,
    {
      height: sizeConfig.height,
      paddingHorizontal: sizeConfig.paddingHorizontal,
      borderRadius: sizeConfig.borderRadius,
      gap: sizeConfig.gap,
      backgroundColor: variantConfig.background,
      borderWidth: variantConfig.borderColor ? 1 : 0,
      borderColor: variantConfig.borderColor,
    },
    pressed && !isDisabled && variant === "ghost" && { backgroundColor: variantConfig.pressedFill },
    isDisabled && styles.disabled,
    style,
  ];

  const labelStyle: TextStyle = {
    fontFamily: fontFamilyByWeight["800"],
    fontSize: sizeConfig.fontSize,
    lineHeight: sizeConfig.lineHeight,
    letterSpacing: sizeConfig.letterSpacing,
    textTransform: "uppercase",
    color: variantConfig.text,
  };

  return (
    <SlayPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      haptic
      hitSlop={hitSlop ?? (size === "sm" ? SM_HIT_SLOP : undefined)}
      style={containerStyle}
      {...rest}
    >
      {({ pressed }) => (
        <>
          {pressed && !isDisabled && (variant === "pink" || variant === "green") ? (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: alpha.black10, borderRadius: sizeConfig.borderRadius }]}
            />
          ) : null}
          {loading ? <ActivityIndicator size="small" color={variantConfig.text} /> : iconLeft}
          <Text style={labelStyle} numberOfLines={1}>
            {children}
          </Text>
          {!loading ? iconRight : null}
        </>
      )}
    </SlayPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.4,
  },
});
