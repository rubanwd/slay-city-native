import { type ReactNode, useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { useReducedMotion } from "~/hooks/useReducedMotion";
import { SlayText } from "./SlayText";

export type ProgressBarVariant = "green" | "pink" | "cyan";

export interface ProgressBarProps {
  /** 0–100. Values outside the range are clamped, as upstream does. */
  value: number;
  /** @default "green" */
  variant?: ProgressBarVariant;
  /**
   * Height of the track in points. 10 everywhere except score lists, which use 8.
   * @default 10
   */
  height?: number;
  /** Label above the bar, on the left, in `label` style at white/50. */
  label?: ReactNode;
  /** Right-aligned label above the bar — "450 / 1000 XP" — small/600 at white/70. */
  labelRight?: ReactNode;
  /**
   * Grow the fill in from 0 on mount. Ignored when Reduce Motion is on.
   * @default true
   */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}

const FILL: Record<ProgressBarVariant, { color: string; glow: string }> = {
  green: { color: colors.limeGreen, glow: withAlpha(colors.limeGreen, 0.5) },
  pink: { color: colors.neonPink, glow: withAlpha(colors.neonPink, 0.5) },
  cyan: { color: colors.cyan, glow: withAlpha(colors.cyan, 0.5) },
};

const DURATION_MS = 600;

/**
 * design/SCN-56 "ProgressBar" — the level bar, the mission header's task
 * counter, the homework module bars. Ported from
 * `src/components/ui/ProgressBar.tsx` upstream: the same three variants, the
 * same two labels, the same 600ms `cubic-bezier(.4, 0, .2, 1)` ease in from 0 on
 * mount.
 *
 * The web animates `width`, which is a layout property. Here the fill is laid
 * out at its full width and `scaleX`-ed from the left instead, on the native
 * driver — design/SCN-56 D10/X8 requires transforms on the UI thread, never
 * layout. Under Reduce Motion (G10) the fill is simply set.
 *
 * The glow sits on the fill *inside* the clipped track, exactly as the web's
 * `overflow-hidden` track does, so what bleeds at the leading edge is the same
 * on both platforms.
 */
export function ProgressBar({
  value,
  variant = "green",
  height = 10,
  label,
  labelRight,
  animate = true,
  style,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const fill = FILL[variant];
  const reducedMotion = useReducedMotion();

  // `useState`, not `useRef`: the driver is created once, on the first render,
  // and reading a ref during render is not allowed.
  const [scale] = useState(() => new Animated.Value(animate ? 0 : clamped / 100));

  useEffect(() => {
    const target = clamped / 100;

    if (reducedMotion || !animate) {
      scale.setValue(target);
      return;
    }

    const animation = Animated.timing(scale, {
      toValue: target,
      duration: DURATION_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [animate, clamped, reducedMotion, scale]);

  return (
    <View style={[styles.wrapper, style]}>
      {label != null || labelRight != null ? (
        <View style={styles.labels}>
          {label != null ? (
            <SlayText variant="label" color={alpha.white50}>
              {label}
            </SlayText>
          ) : null}
          {labelRight != null ? (
            <SlayText variant="small" weight="600" color={alpha.white70} style={styles.labelRight}>
              {labelRight}
            </SlayText>
          ) : null}
        </View>
      ) : null}

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
        style={[styles.track, { height }]}
      >
        <Animated.View
          testID="progress-bar-fill"
          style={[
            styles.fill,
            {
              backgroundColor: fill.color,
              transform: [{ scaleX: scale }],
            },
            clamped > 0 && { boxShadow: `0 0 8px 2px ${fill.glow}` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    flexDirection: "column",
    gap: 6,
  },
  labels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  labelRight: {
    marginLeft: "auto",
  },
  track: {
    width: "100%",
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: alpha.white10,
  },
  fill: {
    width: "100%",
    height: "100%",
    borderRadius: radii.pill,
    transformOrigin: "left center",
  },
});
