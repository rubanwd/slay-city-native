import { useState } from "react";
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
 *
 * The style callback is resolved HERE, never handed to `Pressable`: NativeWind's
 * css-interop wraps `Pressable` and, on native, replaces a function `style` with
 * `{}` (`assignToTarget` overwrites any non-object target). Every button then
 * lost its background, size and layout on a real phone while react-native-web —
 * and so the tests — kept rendering it. Tracking `pressed` ourselves and passing
 * a plain style keeps the interop out of it.
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
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...rest
}: SlayPressableProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  // React Native's own type has only `pressed`; Expo's react-native-web
  // augmentation adds `hovered`. A variable (not a literal) satisfies both.
  const callbackState = { pressed, hovered };

  const handlePressIn = (event: GestureResponderEvent) => {
    setPressed(true);
    if (haptic) {
      playHaptic("tap");
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    setPressed(false);
    onPressOut?.(event);
  };

  return (
    <Pressable
      android_ripple={ripple ? { color: alpha.white10 } : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}
      style={typeof style === "function" ? style(callbackState) : style}
      {...rest}
    />
  );
}
