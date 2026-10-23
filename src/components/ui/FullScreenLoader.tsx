import { Image, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { DEFAULT_MASCOT_IMAGE } from "@slay/core";
import { alpha, colors, withAlpha } from "@slay/tokens";

import { useLoaderBob, useLoaderDot, useLoaderShadow } from "~/animations";
import { imageSource } from "~/lib/imageSource";
import { playSfx } from "~/lib/sfx";

import { SlayPressable } from "./SlayPressable";
import { SlayText } from "./SlayText";

export interface FullScreenLoaderProps {
  /** Caption under the dots ("Loading map…"); a mascot loader says "Slay City" without one. */
  label?: string;
  /**
   * `false` covers its positioned parent instead of the screen — the overlay
   * on a map whose background image is still decoding.
   */
  fullScreen?: boolean;
  /** The bobbing snake. Off in the teacher and parent consoles, as on the web. */
  mascot?: boolean;
  /** The player's equipped look, when the caller knows it; the plain snake otherwise. */
  mascotImageUrl?: string;
}

const DOT_COLORS = [colors.neonPink, colors.limeGreen, colors.cyan] as const;
const DOT_DELAYS_MS = [0, 180, 360] as const;

/**
 * Port of upstream's `FullScreenLoader.tsx`: the branded loading state — a
 * bobbing SLAY snake with a breathing shadow over the neon-city black, three
 * rippling dots and a caption. The snake hisses when tapped, since waiting is
 * more fun with a hiss. Reduce Motion stops every loop (the hooks own that).
 */
export function FullScreenLoader({ label, fullScreen = true, mascot = true, mascotImageUrl = DEFAULT_MASCOT_IMAGE }: FullScreenLoaderProps) {
  const caption = label ?? (mascot ? "Slay City" : undefined);
  const source = mascot ? imageSource(mascotImageUrl) ?? imageSource(DEFAULT_MASCOT_IMAGE) : null;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? "Loading…"}
      accessibilityLiveRegion="polite"
      style={[fullScreen ? styles.screen : styles.overlay, mascot ? styles.roomy : styles.tight]}
    >
      {source ? <BobbingMascot source={source} /> : null}
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {DOT_COLORS.map((color, i) => (
          <LoaderDot key={color} color={color} delayMs={DOT_DELAYS_MS[i]} />
        ))}
      </View>
      {caption ? (
        <SlayText variant="small" weight="700" color={alpha.white70} style={styles.caption}>
          {caption}
        </SlayText>
      ) : null}
    </View>
  );
}

function BobbingMascot({ source }: { source: NonNullable<ReturnType<typeof imageSource>> }) {
  const bob = useLoaderBob();
  const shadow = useLoaderShadow();
  return (
    <View style={styles.mascot}>
      <SlayPressable
        accessibilityRole="button"
        accessibilityLabel="Make Slay hiss"
        onPress={() => playSfx("snakeHiss")}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Animated.View style={[styles.glow, bob]}>
          <Image source={source} style={styles.image} resizeMode="contain" />
        </Animated.View>
      </SlayPressable>
      <Animated.View style={[styles.shadow, shadow]} />
    </View>
  );
}

function LoaderDot({ color, delayMs }: { color: string; delayMs: number }) {
  const pulse = useLoaderDot(delayMs);
  return <Animated.View style={[styles.dot, { backgroundColor: color }, pulse]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", backgroundColor: colors.black },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 30, alignItems: "center", justifyContent: "center", backgroundColor: colors.black },
  roomy: { gap: 24 },
  tight: { gap: 16 },
  mascot: { alignItems: "center" },
  glow: {
    // The web's drop-shadow(0 0 20px rgba(157,255,0,0.45)); iOS ignores `filter`.
    filter: `drop-shadow(0 0 20px ${withAlpha(colors.limeGreen, 0.45)})`,
  },
  image: { width: 96, height: 96 },
  // Upstream's `active:scale-90`.
  pressed: { transform: [{ scale: 0.9 }] },
  shadow: { marginTop: 4, width: 64, height: 8, borderRadius: 999, backgroundColor: withAlpha(colors.limeGreen, 0.4) },
  dots: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  caption: { textTransform: "uppercase", letterSpacing: 2.8 },
});
