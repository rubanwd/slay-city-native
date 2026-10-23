import { useEffect } from "react";
import { Image } from "expo-image";
import { StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { colors, withAlpha } from "@slay/tokens";

import { useLoaderBob, useLoaderShadow } from "~/animations";
import { SlayPressable } from "~/components/ui";
import { playSfx } from "~/lib/sfx";
import { useReducedMotion } from "~/hooks/useReducedMotion";

/** Gap between the mascot's shadow and the label it stands over — the web's 1.25rem. */
const GAP = 20;
const SHADOW_HEIGHT = 8;
const SHADOW_GAP = 4;

export interface MascotMarkerProps {
  /** The selected label's centre, in points from the map frame's top-left corner. */
  x: number;
  y: number;
  source: ImageSourcePropType;
}

/**
 * Port of upstream's `MascotMarker.tsx`: the you-are-here snake hovering over
 * the selected location. It glides when the selection changes (the web's 700ms
 * left/top transition, done here as a transform) and hops with the loader's
 * bob and shadow, so it moves the same way everywhere.
 *
 * The snake itself hisses when tapped, as upstream's `HissableMascot` does —
 * the cheapest bit of "the mascot is alive". Everything around it lets
 * touches through to the labels underneath.
 */
export function MascotMarker({ x, y, source }: MascotMarkerProps) {
  const { width, height } = useWindowDimensions();
  // The web's clamp(3.5rem, 12vmin, 5.5rem).
  const size = Math.min(88, Math.max(56, Math.min(width, height) * 0.12));
  const reduced = useReducedMotion();

  const left = x - size / 2;
  const top = y - GAP - SHADOW_HEIGHT - SHADOW_GAP - size;
  const tx = useSharedValue(left);
  const ty = useSharedValue(top);

  useEffect(() => {
    const timing = { duration: reduced ? 0 : 700, easing: Easing.inOut(Easing.ease) };
    tx.value = withTiming(left, timing);
    ty.value = withTiming(top, timing);
  }, [left, top, reduced, tx, ty]);

  const glide = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }] }));
  const bob = useLoaderBob();
  const shadow = useLoaderShadow();

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { width: size }, glide]}>
      <SlayPressable
        accessibilityRole="button"
        accessibilityLabel="Make Slay hiss"
        onPress={() => playSfx("snakeHiss")}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Animated.View style={[styles.glow, bob]}>
          <Image source={source} style={{ width: size, height: size }} contentFit="contain" />
        </Animated.View>
      </SlayPressable>
      <View pointerEvents="none" style={styles.shadowSlot}>
        <Animated.View style={[styles.shadow, shadow]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 20,
    alignItems: "center",
  },
  glow: {
    // The web's drop-shadow(0 0 20px rgba(157,255,0,0.45)). `filter` draws on
    // Android; iOS ignores it and shows the plain snake.
    filter: `drop-shadow(0 0 20px ${withAlpha(colors.limeGreen, 0.45)})`,
  },
  shadowSlot: {
    height: SHADOW_HEIGHT,
    marginTop: SHADOW_GAP,
    alignItems: "center",
  },
  // Upstream's `active:scale-90`.
  pressed: {
    transform: [{ scale: 0.9 }],
  },
  shadow: {
    width: 48,
    height: SHADOW_HEIGHT,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.limeGreen, 0.4),
  },
});
