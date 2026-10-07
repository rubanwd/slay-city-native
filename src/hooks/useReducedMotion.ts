import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the OS "Reduce Motion" setting is on.
 *
 * design/SCN-56 G10 requires every animation in the design system to respect it:
 * looping animations stop and entrances become instant. The primitives that
 * animate (`ProgressBar`'s fill, `StreakBadge`'s count-up) read this and jump
 * straight to their final value instead of tweening.
 *
 * Starts `false` and resolves on mount, so the first frame is never held back
 * waiting on the platform query.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (active) setReduced(enabled);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  return reduced;
}
