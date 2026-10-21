import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { shuffle, type BubblePopContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { useBubbleBob } from "~/animations";
import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { useReducedMotion } from "~/hooks/useReducedMotion";

import type { TaskProps } from "../taskContract";

/** How long a wrong bubble stays pink — upstream's 450ms. */
const WRONG_FLASH_MS = 450;

/** Upstream's four bubble hues, cycled through the shuffled field. */
const HUES: ViewStyle[] = [
  { borderColor: colors.neonPink, backgroundColor: withAlpha(colors.neonPink, 0.15) },
  { borderColor: colors.cyan, backgroundColor: withAlpha(colors.cyan, 0.15) },
  { borderColor: colors.purple, backgroundColor: withAlpha(colors.purple, 0.25) },
  { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.15) },
];

interface BubbleModel {
  id: string;
  text: string;
  correct: boolean;
  hue: ViewStyle;
  delayMs: number;
}

function Bubble({ bubble, popped, wrong, onPop }: { bubble: BubbleModel; popped: boolean; wrong: boolean; onPop: () => void }) {
  const reduced = useReducedMotion();
  const bob = useBubbleBob(bubble.delayMs, popped);
  const shown = useSharedValue(1);

  // A popped bubble shrinks away but keeps its place, so the field never reflows mid-round.
  useEffect(() => {
    const target = popped ? 0 : 1;
    shown.value = reduced ? target : withTiming(target, { duration: 300 });
  }, [popped, reduced, shown]);

  const pop = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scale: shown.value }] }));

  return (
    <Animated.View style={bob}>
      <Animated.View style={pop}>
        <SlayPressable
          accessibilityRole="button"
          accessibilityLabel={bubble.text}
          accessibilityState={{ disabled: popped }}
          accessibilityElementsHidden={popped}
          importantForAccessibility={popped ? "no-hide-descendants" : "auto"}
          disabled={popped}
          onPress={onPop}
          style={({ pressed }) => [styles.bubble, wrong ? styles.wrong : bubble.hue, pressed && styles.pressed]}
        >
          <SlayText variant="small" weight="700" style={styles.center}>
            {bubble.text}
          </SlayText>
        </SlayPressable>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Port of upstream's `BubblePopTask`: a field of gently bobbing bubbles. Pop
 * every correct word while avoiding the distractors — a wrong tap flashes but
 * doesn't end the round. Done once every correct bubble is popped.
 */
export function BubblePopTask({ content, onComplete, actionLabel }: TaskProps<BubblePopContent>) {
  const { prompt, correct, distractors } = content;
  const [bubbles] = useState<BubbleModel[]>(() =>
    shuffle([
      ...correct.map((text, i) => ({ id: `c${i}`, text, correct: true })),
      ...distractors.map((text, i) => ({ id: `d${i}`, text, correct: false })),
    ]).map((b, i) => ({ ...b, hue: HUES[i % HUES.length], delayMs: (i % 5) * 150 })),
  );
  const [popped, setPopped] = useState<Set<string>>(() => new Set());
  const [wrongId, setWrongId] = useState<string | null>(null);

  const remaining = bubbles.filter((b) => b.correct && !popped.has(b.id)).length;
  const won = remaining === 0;

  const flash = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flash.current) clearTimeout(flash.current);
  }, []);

  const pop = (bubble: BubbleModel) => {
    if (won) return;
    if (bubble.correct) {
      setPopped((prev) => new Set(prev).add(bubble.id));
      return;
    }
    setWrongId(bubble.id);
    if (flash.current) clearTimeout(flash.current);
    flash.current = setTimeout(() => setWrongId(null), WRONG_FLASH_MS);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <SlayText variant="h3" weight="600" style={styles.center}>
          {prompt}
        </SlayText>
        <SlayText variant="small" color={alpha.white50} style={styles.center}>
          {remaining} left to pop
        </SlayText>
      </View>

      <View style={styles.field}>
        {bubbles.map((bubble) => (
          <Bubble
            key={bubble.id}
            bubble={bubble}
            popped={popped.has(bubble.id)}
            wrong={wrongId === bubble.id}
            onPop={() => pop(bubble)}
          />
        ))}
      </View>

      {won ? (
        <SlayText variant="bodyStrong" weight="700" color={colors.limeGreen} style={styles.center} accessibilityLiveRegion="polite">
          All popped! 🎉
        </SlayText>
      ) : null}

      <SlayButton variant="green" size="lg" disabled={!won} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  header: { gap: 4 },
  center: { textAlign: "center" },
  field: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: withAlpha(colors.black, 0.2),
    // Room above the first row for the bubbles to bob into.
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  bubble: {
    minWidth: 72,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 12,
  },
  wrong: { borderColor: colors.neonPink, backgroundColor: withAlpha(colors.neonPink, 0.4) },
  pressed: { transform: [{ scale: 1.1 }] },
});
