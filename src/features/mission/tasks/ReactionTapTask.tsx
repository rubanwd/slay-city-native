import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { shuffle, type ReactionTapContent } from "@slay/core";
import { alpha, colors, withAlpha } from "@slay/tokens";

import { SlayButton, SlayText } from "~/components/ui";
import { useAppStateAwareInterval } from "~/hooks/useAppStateAwareInterval";
import { useReducedMotion } from "~/hooks/useReducedMotion";

import { Chip, Tray, type ChipState } from "./ArrangeParts";
import type { TaskProps } from "../taskContract";

/** How long a wrong tap stays pink — upstream's 400ms. */
const WRONG_FLASH_MS = 400;

interface Target {
  id: string;
  text: string;
  correct: boolean;
}

/**
 * The cyan bar that drains with the clock — upstream's 1s linear width
 * transition, done as a `scaleX` from the left on the UI thread.
 */
function RoundTimer({ fraction }: { fraction: number }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(fraction);

  useEffect(() => {
    scale.value = reduced ? fraction : withTiming(fraction, { duration: 1000, easing: Easing.linear });
  }, [fraction, reduced, scale]);

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: scale.value }] }));

  return (
    <View style={styles.track} accessible={false}>
      <Animated.View style={[styles.fill, fill]} />
    </View>
  );
}

/**
 * Port of upstream's `ReactionTapTask`: a timed round — tap every correct word
 * before the clock runs out while avoiding the distractors. It ends in a win
 * or a timeout, and either way the student can move on.
 *
 * The clock is a `useAppStateAwareInterval`: it stops while the app is in the
 * background, so a phone put down mid-round comes back to the seconds it left.
 */
export function ReactionTapTask({ content, onComplete, actionLabel }: TaskProps<ReactionTapContent>) {
  const { prompt, correct, distractors, roundSeconds } = content;
  const [targets] = useState<Target[]>(() =>
    shuffle([
      ...correct.map((text, i) => ({ id: `c${i}`, text, correct: true })),
      ...distractors.map((text, i) => ({ id: `d${i}`, text, correct: false })),
    ]),
  );
  const [tapped, setTapped] = useState<Set<string>>(() => new Set());
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(roundSeconds);

  const won = targets.every((t) => !t.correct || tapped.has(t.id));
  const timedOut = secondsLeft <= 0 && !won;
  const roundOver = won || timedOut;

  useAppStateAwareInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), roundOver ? null : 1000);

  const flash = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flash.current) clearTimeout(flash.current);
  }, []);

  const tap = (target: Target) => {
    if (roundOver || tapped.has(target.id)) return;
    if (target.correct) {
      setTapped((prev) => new Set(prev).add(target.id));
      return;
    }
    setWrongId(target.id);
    if (flash.current) clearTimeout(flash.current);
    flash.current = setTimeout(() => setWrongId(null), WRONG_FLASH_MS);
  };

  const stateOf = (target: Target): ChipState => {
    if (tapped.has(target.id)) return "solved";
    if (wrongId === target.id) return "wrong";
    // A correct word the clock ran out on — upstream's dimmed green.
    if (roundOver && target.correct) return "missed";
    return "pool";
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <SlayText variant="h3" weight="600" style={styles.center}>
          {prompt}
        </SlayText>
        <SlayText
          variant="small"
          weight="700"
          color={secondsLeft <= 5 && !roundOver ? colors.neonPink : alpha.white50}
          style={styles.center}
          accessibilityLiveRegion={roundOver ? "polite" : "none"}
        >
          {roundOver ? (won ? "All tapped! 🎉" : "Time's up!") : `⏱ ${secondsLeft}s left`}
        </SlayText>
      </View>

      <RoundTimer fraction={roundOver ? 0 : secondsLeft / roundSeconds} />

      <Tray style={styles.field}>
        {targets.map((target) => (
          <Chip
            key={target.id}
            label={target.text}
            state={stateOf(target)}
            disabled={roundOver || tapped.has(target.id)}
            onPress={() => tap(target)}
          />
        ))}
      </Tray>

      <SlayButton variant="green" size="lg" disabled={!roundOver} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  header: { gap: 4 },
  center: { textAlign: "center" },
  track: { height: 6, overflow: "hidden", borderRadius: 999, backgroundColor: alpha.white10 },
  fill: { height: "100%", borderRadius: 999, backgroundColor: colors.cyan, transformOrigin: "left" },
  field: { padding: 16, backgroundColor: withAlpha(colors.black, 0.2) },
});
