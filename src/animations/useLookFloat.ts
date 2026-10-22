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

/**
 * Upstream's wardrobe `lookFloat` keyframe: the mascot preview rises 8px and
 * grows 4% and settles back, every 3s. Still under Reduce Motion.
 */
export function useLookFloat() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(t);
  }, [reduced, t]);

  return useAnimatedStyle(() => ({ transform: [{ translateY: -8 * t.value }, { scale: 1 + 0.04 * t.value }] }));
}
