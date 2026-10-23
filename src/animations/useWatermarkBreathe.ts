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

/** Upstream's resting and flash opacities, and its 7s cycle split at 3% and 10%. */
export const WATERMARK_REST_OPACITY = 0.2;
const FLASH_OPACITY = 0.4;
const BRIGHTEN_MS = 210;
const FADE_MS = 490;
const HOLD_MS = 6300;

/**
 * Upstream's `watermark-breathe` keyframe: a letter of the "Slay School"
 * wordmark under the tab bar sits at 20% opacity, brightens to 40% and falls
 * straight back, once every 7s. `delayMs` offsets each letter (the web's 55ms
 * stagger), so the flash reads as a beam sweeping left to right.
 */
export function useWatermarkBreathe(delayMs = 0) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(WATERMARK_REST_OPACITY);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(opacity);
      opacity.value = WATERMARK_REST_OPACITY;
      return;
    }
    const easing = Easing.out(Easing.ease);
    opacity.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(FLASH_OPACITY, { duration: BRIGHTEN_MS, easing }),
          withTiming(WATERMARK_REST_OPACITY, { duration: FADE_MS, easing }),
          withTiming(WATERMARK_REST_OPACITY, { duration: HOLD_MS }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [reduced, delayMs, opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}
