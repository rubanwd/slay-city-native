import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import type { FlashcardsContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { useReducedMotion } from "~/hooks/useReducedMotion";
import { imageSource } from "~/lib/imageSource";

import type { TaskProps } from "../taskContract";

/** A whole flip, edge-on at the midpoint — upstream's two 260ms half-turns. */
const FLIP_MS = 520;

/**
 * Port of upstream's `FlashcardsTask`: a self-paced review deck. Tap the card
 * to flip between its front and back, then step through every card; the
 * action button only finishes the task on the last one.
 *
 * The flip runs on the UI thread (WP-3.4 AC2): one shared angle drives both
 * faces. The front turns 0°→90°, the back −90°→0°, and each face is shown
 * only on its own half of the turn — so neither is ever drawn mirrored, the
 * same guarantee upstream gets by swapping faces while the card is edge-on.
 * Tapping mid-flip simply turns it back from where it is.
 */
export function FlashcardsTask({ content, onComplete, actionLabel }: TaskProps<FlashcardsContent>) {
  const { prompt, cards } = content;
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<"front" | "back">("front");
  const turn = useSharedValue(0);

  const card = cards[index];
  const isLast = index === cards.length - 1;
  const picture = imageSource(card.imageUrl);

  const flip = () => {
    const next = side === "front" ? "back" : "front";
    const target = next === "back" ? 180 : 0;
    turn.value = reduced ? target : withTiming(target, { duration: FLIP_MS, easing: Easing.inOut(Easing.ease) });
    setSide(next);
  };

  const advance = () => {
    if (isLast) {
      onComplete();
      return;
    }
    turn.value = 0;
    setSide("front");
    setIndex((i) => i + 1);
  };

  const frontFace = useAnimatedStyle(() => ({
    opacity: turn.value < 90 ? 1 : 0,
    transform: [{ perspective: 1000 }, { rotateY: `${turn.value}deg` }],
  }));
  const backFace = useAnimatedStyle(() => ({
    opacity: turn.value < 90 ? 0 : 1,
    transform: [{ perspective: 1000 }, { rotateY: `${turn.value - 180}deg` }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <SlayText variant="h3" weight="600" style={styles.shrink}>
          {prompt}
        </SlayText>
        <SlayText variant="small" weight="700" color={alpha.white50}>
          {index + 1}/{cards.length}
        </SlayText>
      </View>

      <SlayPressable
        accessibilityRole="button"
        accessibilityLabel={side === "front" ? `${card.front}. Show the answer` : `${card.back}. Show the front of the card`}
        onPress={flip}
        style={styles.scene}
      >
        <Animated.View
          style={[styles.frontFace, frontFace]}
          accessibilityElementsHidden={side !== "front"}
          importantForAccessibility={side === "front" ? "auto" : "no-hide-descendants"}
        >
          <LinearGradient
            colors={[withAlpha(colors.cyan, 0.25), colors.black, withAlpha(colors.purple, 0.25)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, styles.front]}
          >
            {picture ? <Image source={picture} style={styles.picture} contentFit="cover" accessible={false} /> : null}
            <SlayText variant="h1" weight="900" style={styles.center}>
              {card.front}
            </SlayText>
            <SlayText variant="label" color={alpha.white50} style={styles.caption}>
              Tap to flip
            </SlayText>
          </LinearGradient>
        </Animated.View>

        <Animated.View
          style={[styles.face, backFace]}
          accessibilityElementsHidden={side !== "back"}
          importantForAccessibility={side === "back" ? "auto" : "no-hide-descendants"}
        >
          <LinearGradient
            colors={[withAlpha(colors.limeGreen, 0.25), colors.black, withAlpha(colors.neonPink, 0.25)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, styles.back]}
          >
            <SlayText variant="h1" weight="900" style={styles.center}>
              {card.back}
            </SlayText>
            <SlayText variant="label" color={alpha.white50} style={styles.caption}>
              Answer
            </SlayText>
          </LinearGradient>
        </Animated.View>
      </SlayPressable>

      <SlayButton variant="green" size="lg" onPress={advance}>
        {isLast ? actionLabel : "Next card"}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  shrink: { flexShrink: 1 },
  center: { textAlign: "center" },
  // The front sits in the flow and sizes the card (it carries the picture);
  // the back is laid over it.
  scene: { minHeight: 256 },
  frontFace: { flexGrow: 1, minHeight: 256 },
  face: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  card: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    overflow: "hidden",
    borderRadius: radii.card,
    borderWidth: 2,
    padding: 24,
  },
  front: { borderColor: colors.cyan, boxShadow: `0 0 40px -10px ${withAlpha(colors.cyan, 0.5)}` },
  back: { borderColor: colors.limeGreen, boxShadow: `0 0 40px -10px ${withAlpha(colors.limeGreen, 0.5)}` },
  picture: { width: 112, height: 112, borderRadius: radii.lg, backgroundColor: alpha.white5 },
  caption: { textTransform: "uppercase", letterSpacing: 2 },
});
