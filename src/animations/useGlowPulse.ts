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
 * Upstream's `glow-pulse` keyframe (`animate-glow`): a pink glow that swells
 * and fades over 3s. The web animates `box-shadow`; animating a shadow
 * re-renders it every frame, so here a glow layer with a fixed shadow is laid
 * behind the element and only its opacity moves (AGENTS.md: transform and
 * opacity only).
 */
export function useGlowPulse() {
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

  return useAnimatedStyle(() => ({ opacity: 0.35 + 0.25 * t.value }));
}
