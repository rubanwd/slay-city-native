import { useEffect } from "react";
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "~/hooks/useReducedMotion";

/** Half of upstream's 1.1s cycle: the animation runs up, then reverses down. */
const HALF_CYCLE_MS = 550;

/**
 * Upstream's `loader-bob` keyframe: the mascot hops 14px and rocks between
 * -3° and 3°. Used by the loader and the map's you-are-here marker, so the
 * snake hops the same way everywhere. Pair with {@link useLoaderShadow}.
 */
export function useLoaderBob() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = withRepeat(withTiming(1, { duration: HALF_CYCLE_MS, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(t);
  }, [reduced, t]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: -14 * t.value }, { rotate: `${-3 + 6 * t.value}deg` }],
  }));
}

/**
 * Upstream's `loader-shadow` keyframe: the shadow under the hopping mascot
 * shrinks and fades while it is in the air.
 */
export function useLoaderShadow() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = withRepeat(withTiming(1, { duration: HALF_CYCLE_MS, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(t);
  }, [reduced, t]);

  return useAnimatedStyle(() => ({
    opacity: 0.45 - 0.25 * t.value,
    transform: [{ scaleX: 1 - 0.3 * t.value }],
  }));
}
