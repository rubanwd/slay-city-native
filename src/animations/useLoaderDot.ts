import { useEffect } from "react";
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "~/hooks/useReducedMotion";

/** Upstream's 1.4s cycle: up to full size by 40%, back down by 80%, resting to 100%. */
const RISE_MS = 560;
const FALL_MS = 560;
const REST_MS = 280;

/**
 * Upstream's `loader-dot` keyframe: one of the loader's three dots swelling
 * from 60% to full size and opacity, then settling back. `delayMs` staggers
 * the dots as the web's inline `animation-delay` does (0, 180, 360ms), so they
 * ripple rather than pulse together.
 */
export function useLoaderDot(delayMs = 0) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(t);
      t.value = 1;
      return;
    }
    const easing = Easing.inOut(Easing.ease);
    t.value = 0;
    t.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: RISE_MS, easing }),
          withTiming(0, { duration: FALL_MS, easing }),
          withTiming(0, { duration: REST_MS }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(t);
  }, [reduced, delayMs, t]);

  return useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * t.value,
    transform: [{ scale: 0.6 + 0.4 * t.value }],
  }));
}
