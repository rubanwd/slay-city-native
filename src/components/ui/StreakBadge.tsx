import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { alpha, colors, radii, withAlpha, type TextVariant } from "@slay/tokens";

import { useReducedMotion } from "~/hooks/useReducedMotion";
import { SlayPressable } from "./SlayPressable";
import { SlayText } from "./SlayText";

export type StreakBadgeSize = "sm" | "md" | "lg";

export interface StreakBadgeProps {
  count: number;
  /** @default "md" */
  size?: StreakBadgeSize;
  /** Replaces the default tooltip copy. */
  tooltip?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<
  StreakBadgeSize,
  {
    height: number;
    paddingHorizontal: number;
    gap: number;
    borderRadius: number;
    emojiSize: number;
    countVariant: TextVariant;
  }
> = {
  sm: {
    height: 28,
    paddingHorizontal: 10,
    gap: 4,
    borderRadius: radii.md,
    emojiSize: 16,
    countVariant: "bodyStrong",
  },
  md: {
    height: 40,
    paddingHorizontal: 16,
    gap: 6,
    borderRadius: radii.lg,
    emojiSize: 20,
    countVariant: "h3",
  },
  lg: {
    height: 56,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: radii.lg,
    emojiSize: 24,
    countVariant: "h2",
  },
};

const COUNT_UP_MS = 600;
const TOOLTIP_AUTO_HIDE_MS = 3000;
const TOOLTIP_WIDTH = 224;

/** `sm` is 28pt tall; 8pt of slop each way takes the touch target to 44 (G6). */
const SM_HIT_SLOP = { top: 8, bottom: 8 };

/**
 * Counts from the previous value to `to` over `duration`, ease-out cubic — a
 * direct port of upstream's `useCountUp`. Reduce Motion skips straight to `to`
 * (design/SCN-56 G10).
 */
function useCountUp(to: number, reducedMotion: boolean, duration = COUNT_UP_MS) {
  const [display, setDisplay] = useState(to);
  const previous = useRef(to);

  useEffect(() => {
    const from = previous.current;
    previous.current = to;

    if (from === to || reducedMotion) return;

    const start = Date.now();
    let frame: ReturnType<typeof requestAnimationFrame>;

    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, reducedMotion, to]);

  return reducedMotion ? to : display;
}

/**
 * design/SCN-56 "StreakBadge" — the daily-streak pill: a purple→cyan gradient,
 * the 🔥 glyph and the day count at weight 900, counting up over 600ms when it
 * changes. Ported from `src/components/ui/StreakBadge.tsx` upstream.
 *
 * The web shows its tooltip on hover. Phones have no hover, so a tap toggles it
 * and it hides itself after 3s (design/SCN-56 X4).
 *
 * The outer glow is on the `Pressable`, which does not clip; the inset highlight
 * is on the gradient, which does — iOS drops a shadow drawn by the same view
 * that clips its children.
 */
export function StreakBadge({ count, size = "md", tooltip, style }: StreakBadgeProps) {
  const sizeConfig = SIZES[size];
  const reducedMotion = useReducedMotion();
  const display = useCountUp(count, reducedMotion);

  const [open, setOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    hideTimer.current = setTimeout(() => setOpen(false), TOOLTIP_AUTO_HIDE_MS);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [open]);

  const tip =
    tooltip ??
    `${count}-day streak! Log in and complete at least one mission every day to keep it going.`;

  return (
    <View style={[styles.anchor, style]}>
      {open ? (
        <View pointerEvents="none" style={styles.tooltip}>
          <SlayText variant="small" color={alpha.white80} style={styles.tooltipText}>
            {tip}
          </SlayText>
        </View>
      ) : null}

      <SlayPressable
        accessibilityRole="button"
        accessibilityLabel={`${count} day streak`}
        accessibilityHint={tip}
        hitSlop={size === "sm" ? SM_HIT_SLOP : undefined}
        onPress={() => setOpen((wasOpen) => !wasOpen)}
        style={[styles.glow, { borderRadius: sizeConfig.borderRadius }]}
      >
        <LinearGradient
          colors={[colors.purple, colors.cyan]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[
            styles.badge,
            {
              height: sizeConfig.height,
              paddingHorizontal: sizeConfig.paddingHorizontal,
              gap: sizeConfig.gap,
              borderRadius: sizeConfig.borderRadius,
            },
          ]}
        >
          {/*
            The flame is a glyph at a fixed size, not a step on the type scale,
            so it is a plain Text rather than a SlayText variant.
          */}
          <Text style={{ fontSize: sizeConfig.emojiSize, lineHeight: sizeConfig.emojiSize * 1.25 }}>
            🔥
          </Text>
          <SlayText variant={sizeConfig.countVariant} weight="900" color={colors.white}>
            {display}
          </SlayText>
        </LinearGradient>
      </SlayPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    alignSelf: "flex-start",
  },
  glow: {
    boxShadow: `0 0 12px 2px ${withAlpha(colors.purple, 0.35)}`,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    boxShadow: `inset 0 1px 0 ${alpha.white15}`,
  },
  tooltip: {
    position: "absolute",
    bottom: "100%",
    left: "50%",
    marginLeft: -TOOLTIP_WIDTH / 2,
    marginBottom: 8,
    width: TOOLTIP_WIDTH,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: colors.surface,
    zIndex: 50,
  },
  tooltipText: {
    textAlign: "center",
  },
});
