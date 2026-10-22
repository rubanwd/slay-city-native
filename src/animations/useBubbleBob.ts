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
 * Upstream's bubble bounce (`animate-[bounce_2s_ease-in-out_infinite]`): a
 * bubble rises and settles over 2s. `delayMs` staggers them, as the web's
 * inline `animation-delay` does, so the field never bobs in lockstep.
 * `still` stops it — a popped bubble has nothing left to bob.
 */
export function useBubbleBob(delayMs = 0, still = false) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduced || still) {
      cancelAnimation(y);
      y.value = 0;
      return;
    }
    y.value = withDelay(
      delayMs,
      withRepeat(withTiming(-8, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(y);
  }, [reduced, still, delayMs, y]);

  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
}
