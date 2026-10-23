import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { alpha } from "@slay/tokens";

import { haptic as playHaptic } from "~/lib/haptics";

/**
 * The one pressed-state primitive the rest of the design system builds on
 * (design/SCN-5 "SlayPressable"). It owns three things every pressable surface in
 * the web app shares: a pressed-state style callback, an opt-in light haptic, and
 * Android ripple that defaults OFF — the web has no ripple, so leaving it on by
 * default would double the feedback the web's darkening already provides.
 *
 * Callers that render below the 44×44pt minimum touch target (SlayButton's `sm`)
 * must pass `hitSlop` themselves; this component has no layout of its own to
 * measure against.
 */
export interface SlayPressableProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  /** Plays the light `tap` haptic on press-in, unless haptics are switched off. Native only. */
  haptic?: boolean;
  /** Opt-in Android ripple, `rgba(255,255,255,0.10)`. Never set this on pink or green buttons. */
  ripple?: boolean;
}

export function SlayPressable({
  style,
  haptic = false,
  ripple = false,
  onPressIn,
  ...rest
}: SlayPressableProps) {
  const handlePressIn = (event: GestureResponderEvent) => {
    if (haptic) {
      playHaptic("tap");
    }
    onPressIn?.(event);
  };

  return (
    <Pressable
      android_ripple={ripple ? { color: alpha.white10 } : undefined}
      onPressIn={handlePressIn}
      style={style}
      {...rest}
    />
  );
}
