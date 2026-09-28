import { type ReactNode } from "react";
import {
  StyleSheet,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayPressable } from "./SlayPressable";

export type SlayCardVariant = "pink" | "green" | "cyan" | "purple" | "ghost";

export interface SlayCardProps {
  /** @default "pink" */
  variant?: SlayCardVariant;
  /** The web's "hoverable" — native has no hover, so this drives the pressed glow/scale instead. */
  pressable?: boolean;
  /** Removes the card's padding, for full-bleed media. */
  flush?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

const CARD_VARIANTS: Record<
  SlayCardVariant,
  { borderColor: string; glow: string | null; pressedGlow: string | null; pressedBorderColor: string }
> = {
  pink: {
    borderColor: withAlpha(colors.neonPink, 0.6),
    glow: withAlpha(colors.neonPink, 0.25),
    pressedGlow: withAlpha(colors.neonPink, 0.45),
    pressedBorderColor: colors.neonPink,
  },
  green: {
    borderColor: withAlpha(colors.limeGreen, 0.6),
    glow: withAlpha(colors.limeGreen, 0.2),
    pressedGlow: withAlpha(colors.limeGreen, 0.4),
    pressedBorderColor: colors.limeGreen,
  },
  cyan: {
    borderColor: withAlpha(colors.cyan, 0.6),
    glow: withAlpha(colors.cyan, 0.2),
    pressedGlow: withAlpha(colors.cyan, 0.4),
    pressedBorderColor: colors.cyan,
  },
  purple: {
    borderColor: withAlpha(colors.purple, 0.6),
    glow: withAlpha(colors.purple, 0.25),
    pressedGlow: withAlpha(colors.purple, 0.45),
    pressedBorderColor: colors.purple,
  },
  ghost: {
    borderColor: alpha.white15,
    glow: null,
    pressedGlow: null,
    pressedBorderColor: alpha.white40,
  },
};

function glowShadow(color: string | null, pressed: boolean): ViewStyle {
  if (!color) return {};
  const blur = pressed ? 24 : 12;
  const spread = pressed ? 4 : 0;
  return { boxShadow: `0 0 ${blur}px ${spread}px ${color}` } as ViewStyle;
}

/**
 * design/SCN-5 "SlayCard". The glow is an RN `boxShadow` (new architecture, on in
 * app.json) on an OUTER view; `overflow: hidden` and the border radius live on an
 * INNER view, because iOS clips a shadow drawn by the same view that clips its
 * children.
 */
function SlayCard({ variant = "pink", pressable = false, flush = false, onPress, style, children }: SlayCardProps) {
  const config = CARD_VARIANTS[variant];

  const renderInner = (pressed: boolean) => (
    <View
      style={[
        styles.inner,
        flush ? styles.innerFlush : styles.innerPadded,
        {
          borderColor: pressed ? config.pressedBorderColor : config.borderColor,
          backgroundColor: pressed && variant === "ghost" ? alpha.white5 : colors.surface,
        },
      ]}
    >
      {children}
    </View>
  );

  if (pressable) {
    return (
      <SlayPressable
        onPress={onPress}
        style={({ pressed }: PressableStateCallbackType) => [
          styles.outer,
          glowShadow(pressed ? config.pressedGlow : config.glow, pressed),
          pressed && styles.pressedScale,
          style,
        ]}
      >
        {({ pressed }: PressableStateCallbackType) => renderInner(pressed)}
      </SlayPressable>
    );
  }

  return <View style={[styles.outer, glowShadow(config.glow, false), style]}>{renderInner(false)}</View>;
}

export interface SlayCardSectionProps {
  /** Adds the divider line between this section and the card content. */
  divided?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

function Header({ divided = false, style, children }: SlayCardSectionProps) {
  return <View style={[styles.header, divided && styles.headerDivided, style]}>{children}</View>;
}

function Content({ style, children }: Omit<SlayCardSectionProps, "divided">) {
  return <View style={[styles.content, style]}>{children}</View>;
}

function Footer({ divided = false, style, children }: SlayCardSectionProps) {
  return <View style={[styles.footer, divided && styles.footerDivided, style]}>{children}</View>;
}

type SlayCardComponent = typeof SlayCard & {
  Header: typeof Header;
  Content: typeof Content;
  Footer: typeof Footer;
};

const SlayCardWithSections = SlayCard as SlayCardComponent;
SlayCardWithSections.Header = Header;
SlayCardWithSections.Content = Content;
SlayCardWithSections.Footer = Footer;

export { SlayCardWithSections as SlayCard };

const styles = StyleSheet.create({
  outer: {},
  inner: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  innerPadded: {
    padding: 16,
  },
  innerFlush: {
    padding: 0,
  },
  pressedScale: {
    transform: [{ scale: 1.02 }],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  headerDivided: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: alpha.white10,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 12,
  },
  footerDivided: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: alpha.white10,
  },
});
