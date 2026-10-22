import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { artwork, colors } from "@slay/tokens";

import { useReducedMotion } from "~/hooks/useReducedMotion";

/** Upstream's rain palette: the four brand colours plus the coins' gold. */
const RAIN_COLORS = [colors.neonPink, colors.limeGreen, colors.cyan, colors.purple, artwork.coin.rain];
const DROP_COUNT = 48;

interface Drop {
  left: number;
  size: number;
  color: string;
  delayMs: number;
  durationMs: number;
  drift: number;
}

/** Upstream's `buildRainDrops`: random place, size, colour, timing and sideways drift per drop. */
function buildRainDrops(count: number): Drop[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    size: 6 + Math.random() * 8,
    color: RAIN_COLORS[Math.floor(Math.random() * RAIN_COLORS.length)],
    delayMs: Math.random() * 2500,
    durationMs: 2400 + Math.random() * 2600,
    drift: (Math.random() - 0.5) * 40,
  }));
}

/** One drop: falls from just above the screen to just below it, drifting sideways, forever. */
function RainDrop({ drop, height }: { drop: Drop; height: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(drop.delayMs, withRepeat(withTiming(1, { duration: drop.durationMs, easing: Easing.linear }), -1));
    return () => cancelAnimation(t);
  }, [drop, t]);

  const fall = useAnimatedStyle(() => ({
    // Upstream fades in over the first tenth and out over the last.
    opacity: t.value < 0.1 ? t.value * 10 : t.value > 0.9 ? (1 - t.value) * 10 : 1,
    transform: [{ translateY: -0.12 * height + t.value * 1.24 * height }, { translateX: t.value * drop.drift }],
  }));

  return (
    <Animated.View
      style={[
        styles.drop,
        fall,
        {
          left: `${drop.left}%`,
          width: drop.size,
          height: drop.size,
          backgroundColor: drop.color,
          boxShadow: `0 0 8px ${drop.color}`,
        },
      ]}
    />
  );
}

/**
 * The reward screen's falling confetti dots — upstream's `reward-rain`, each
 * drop its own UI-thread loop. Left out entirely under Reduce Motion, as the
 * web hides `.reward-drop`.
 */
export function RewardRain() {
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  // Random, so built once, not on every render.
  const [drops] = useState(() => buildRainDrops(DROP_COUNT));

  if (reduced) return null;
  return (
    <View pointerEvents="none" style={styles.layer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {drops.map((drop, index) => (
        <RainDrop key={index} drop={drop} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" },
  drop: { position: "absolute", top: 0, borderRadius: 999 },
});
