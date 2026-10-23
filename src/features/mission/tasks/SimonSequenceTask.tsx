import { useEffect, useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import type { SimonSequenceContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { haptic } from "~/lib/haptics";
import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { useAppActive } from "~/hooks/useAppStateAwareInterval";

import type { TaskProps } from "../taskContract";

/** One step of the playback: a tile lights for 450ms, then the next one 250ms later — upstream's timing. */
const STEP_MS = 700;
const LIT_MS = 450;

/** Upstream's tile hues, cycled by position; `lit` is the same hue at full strength. */
const HUES: { idle: ViewStyle; lit: ViewStyle; litText: string }[] = [
  {
    idle: { borderColor: colors.neonPink, backgroundColor: withAlpha(colors.neonPink, 0.2) },
    lit: { borderColor: colors.neonPink, backgroundColor: colors.neonPink },
    litText: colors.black,
  },
  {
    idle: { borderColor: colors.cyan, backgroundColor: withAlpha(colors.cyan, 0.2) },
    lit: { borderColor: colors.cyan, backgroundColor: colors.cyan },
    litText: colors.black,
  },
  {
    idle: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.2) },
    lit: { borderColor: colors.limeGreen, backgroundColor: colors.limeGreen },
    litText: colors.black,
  },
  {
    idle: { borderColor: colors.purple, backgroundColor: withAlpha(colors.purple, 0.3) },
    lit: { borderColor: colors.purple, backgroundColor: colors.purple },
    litText: colors.white,
  },
];

type Phase = "watching" | "input" | "wrong" | "done";

/** The light's companion: a haptic tick fired in the same callback that lights the tile. */
const tick = () => haptic("tick");

/**
 * Port of upstream's `SimonSequenceTask`: the tiles light up in sequence, then
 * the student taps them back in the same order. A wrong tap offers to watch
 * the pattern again.
 *
 * Each light and its haptic tick fire from the same timer callback, so they
 * cannot drift apart (WP-3.4 AC3); upstream plays no sound, so neither does
 * this. The playback only runs while the app is in the foreground: put the
 * phone down mid-pattern and it starts over from the first tile on return,
 * rather than finishing unseen.
 */
export function SimonSequenceTask({ content, onComplete, actionLabel }: TaskProps<SimonSequenceContent>) {
  const { prompt, colors: tiles } = content;
  // Content is re-parsed every render; the pattern is fixed for the task's life.
  const [sequence] = useState(content.sequence);
  const [phase, setPhase] = useState<Phase>("watching");
  const [litIndex, setLitIndex] = useState<number | null>(null);
  const [input, setInput] = useState<number[]>([]);
  const active = useAppActive();
  const watching = phase === "watching";

  useEffect(() => {
    if (!watching || !active) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    sequence.forEach((tileIndex, step) => {
      timers.push(
        setTimeout(() => {
          setLitIndex(tileIndex);
          tick();
        }, step * STEP_MS),
      );
      timers.push(setTimeout(() => setLitIndex(null), step * STEP_MS + LIT_MS));
    });
    timers.push(setTimeout(() => setPhase("input"), sequence.length * STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [watching, active, sequence]);

  const tap = (tileIndex: number) => {
    if (phase !== "input") return;
    const next = [...input, tileIndex];
    if (sequence[next.length - 1] !== tileIndex) {
      setPhase("wrong");
      return;
    }
    setInput(next);
    if (next.length === sequence.length) setPhase("done");
  };

  const retry = () => {
    setInput([]);
    setLitIndex(null);
    setPhase("watching");
  };

  const status = {
    watching: "Watch the pattern…",
    input: `Your turn — tile ${input.length + 1} of ${sequence.length}`,
    wrong: "Not quite that order.",
    done: "You got it! 🎉",
  }[phase];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <SlayText variant="h3" weight="600" style={styles.center}>
          {prompt}
        </SlayText>
        <SlayText variant="small" color={alpha.white50} style={styles.center} accessibilityLiveRegion="polite">
          {status}
        </SlayText>
      </View>

      <View style={styles.grid}>
        {tiles.map((tile, index) => {
          const hue = HUES[index % HUES.length];
          const lit = litIndex === index;
          return (
            <SlayPressable
              // Tile names may repeat; a tile is its position in the sequence.
              key={index}
              accessibilityRole="button"
              accessibilityLabel={tile}
              accessibilityState={{ disabled: phase !== "input", selected: lit }}
              disabled={phase !== "input"}
              haptic
              onPress={() => tap(index)}
              style={[styles.tile, lit ? [hue.lit, styles.lit] : hue.idle]}
            >
              <SlayText variant="bodyStrong" weight="700" color={lit ? hue.litText : colors.white} style={styles.center}>
                {tile}
              </SlayText>
            </SlayPressable>
          );
        })}
      </View>

      {phase === "wrong" ? (
        <SlayButton variant="pink" size="md" onPress={retry}>
          Watch again
        </SlayButton>
      ) : null}

      <SlayButton variant="green" size="lg" disabled={phase !== "done"} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  header: { gap: 4 },
  center: { textAlign: "center" },
  // Two tiles a row, as upstream's `grid-cols-2`.
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 },
  tile: {
    width: "47%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  lit: { transform: [{ scale: 1.05 }] },
});
