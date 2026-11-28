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

/** Half of the loader's 1.1s hop, as in {@link useLoaderBob}. */
const HALF_CYCLE_MS = 550;

/**
 * The start-up loader's hop: the same 1.1s rhythm as `useLoaderBob`, but
 * straight up and down from rest, with no rocking. It takes over from the
 * native splash in the same spot, so its first frame must be exactly the
 * splash's — a tilted first frame would show as a jump.
 */
export function useBootBob() {
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

  return useAnimatedStyle(() => ({ transform: [{ translateY: -12 * t.value }] }));
}
