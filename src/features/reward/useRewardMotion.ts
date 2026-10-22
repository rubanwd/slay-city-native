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

/**
 * Upstream's `reward-pop` keyframe — scale 0.6 → 1.08 → 1 while fading in —
 * after `delayMs`. With `pulseAfter`, it then keeps breathing between 1 and
 * 1.06 every 1.6s, as the headline's `reward-headline-pulse` does. Under
 * Reduce Motion it simply appears.
 */
export function useRewardPop(delayMs = 0, durationMs = 500, pulseAfter = false) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 0.6);
  const opacity = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    const pop = withSequence(
      withTiming(1.08, { duration: durationMs * 0.7, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: durationMs * 0.3, easing: Easing.out(Easing.ease) }),
    );
    const pulse = withRepeat(withTiming(1.06, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
    scale.value = withDelay(delayMs, pulseAfter ? withSequence(pop, pulse) : pop);
    opacity.value = withDelay(delayMs, withTiming(1, { duration: durationMs * 0.7 }));
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [reduced, delayMs, durationMs, pulseAfter, scale, opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
}

/** Upstream's `reward-rise` keyframe: up 16px and fade in over 0.5s, after `delayMs`. */
export function useRewardRise(delayMs = 0) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(t);
      t.value = 1;
      return;
    }
    t.value = withDelay(delayMs, withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }));
    return () => cancelAnimation(t);
  }, [reduced, delayMs, t]);

  return useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: 16 * (1 - t.value) }] }));
}

/**
 * Upstream's mascot `wiggle` keyframe over 1.6s: rock -4° → 4° → -3° → 3°
 * while hopping 5px, then 2px.
 */
export function useWiggle() {
  const reduced = useReducedMotion();
  const rotate = useSharedValue(-4);
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(rotate);
      cancelAnimation(y);
      rotate.value = 0;
      y.value = 0;
      return;
    }
    const step = 400;
    const ease = { duration: step, easing: Easing.inOut(Easing.ease) };
    rotate.value = withRepeat(
      withSequence(withTiming(4, ease), withTiming(-3, ease), withTiming(3, ease), withTiming(-4, ease)),
      -1,
    );
    y.value = withRepeat(
      withSequence(withTiming(-5, ease), withTiming(0, ease), withTiming(-2, ease), withTiming(0, ease)),
      -1,
    );
    return () => {
      cancelAnimation(rotate);
      cancelAnimation(y);
    };
  }, [reduced, rotate, y]);

  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: `${rotate.value}deg` }] }));
}
