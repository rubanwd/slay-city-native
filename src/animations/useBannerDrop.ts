import { useEffect } from "react";
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "~/hooks/useReducedMotion";

/**
 * Upstream's `banner-drop` keyframe (`animate-banner-drop`): the map's
 * milestone banner drops 12px into place while fading in, once, over 350ms.
 * Plays on mount — mount the banner when it should appear.
 */
export function useBannerDrop() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = reduced ? 1 : withTiming(1, { duration: 350, easing: Easing.out(Easing.ease) });
  }, [reduced, t]);

  return useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: -12 * (1 - t.value) }],
  }));
}
