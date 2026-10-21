import { useEffect } from "react";
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "~/hooks/useReducedMotion";

/**
 * Upstream's `label-float` keyframe (`animate-label-float`): the map's location
 * labels drift up 4px and back over 3.2s. `delayMs` staggers them, as the web's
 * inline `animation-delay` does, so they never bob in lockstep.
 */
export function useLabelFloat(delayMs = 0) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(y);
      y.value = 0;
      return;
    }
    y.value = withDelay(
      delayMs,
      withRepeat(withTiming(-4, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(y);
  }, [reduced, delayMs, y]);

  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
}
