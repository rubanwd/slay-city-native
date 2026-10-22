import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { SpotTheDifferenceContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";
import { TaskPrompt } from "./TaskText";

/** How long a wrong tap stays pink — upstream's 350ms. */
const WRONG_FLASH_MS = 350;

/**
 * Port of upstream's `SpotTheDifferenceTask`: a grid of identical emoji hides
 * one impostor. A wrong tap just flashes, so the student keeps looking.
 */
export function SpotTheDifferenceTask({ content, onComplete, actionLabel }: TaskProps<SpotTheDifferenceContent>) {
  const { prompt, emoji, oddEmoji, gridSize, oddIndex } = content;
  const cells = useMemo(
    () => Array.from({ length: gridSize }, (_, i) => (i === oddIndex ? oddEmoji : emoji)),
    [gridSize, oddIndex, emoji, oddEmoji],
  );
  const [found, setFound] = useState(false);
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);
  const columns = Math.min(6, Math.ceil(Math.sqrt(gridSize)));

  const flash = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flash.current) clearTimeout(flash.current);
  }, []);

  const tap = (index: number) => {
    if (found) return;
    if (index === oddIndex) {
      setFound(true);
      setWrongIndex(null);
      return;
    }
    setWrongIndex(index);
    if (flash.current) clearTimeout(flash.current);
    flash.current = setTimeout(() => setWrongIndex((prev) => (prev === index ? null : prev)), WRONG_FLASH_MS);
  };

  return (
    <View style={styles.wrap}>
      <TaskPrompt variant="h3">{prompt}</TaskPrompt>

      <View style={styles.grid}>
        {cells.map((cellEmoji, index) => {
          const isFoundCell = found && index === oddIndex;
          const isWrong = wrongIndex === index;
          return (
            <View key={index} style={{ width: `${100 / columns}%`, padding: 4 }}>
              <SlayPressable
                accessibilityRole="button"
                accessibilityLabel={cellEmoji}
                disabled={found}
                onPress={() => tap(index)}
                style={[
                  styles.cell,
                  isFoundCell ? styles.found : isWrong ? styles.wrong : styles.idle,
                ]}
              >
                <SlayText style={styles.emoji}>{cellEmoji}</SlayText>
              </SlayPressable>
            </View>
          );
        })}
      </View>

      {found ? (
        <SlayText variant="bodyStrong" weight="700" color={colors.limeGreen} accessibilityLiveRegion="polite" style={styles.center}>
          Found it! 🎉
        </SlayText>
      ) : null}

      <SlayButton variant="green" size="lg" disabled={!found} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: withAlpha(colors.black, 0.2),
    padding: 8,
  },
  cell: {
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
  },
  idle: {
    borderColor: alpha.white10,
    backgroundColor: alpha.white5,
  },
  wrong: {
    borderColor: colors.neonPink,
    backgroundColor: withAlpha(colors.neonPink, 0.2),
  },
  found: {
    borderColor: colors.limeGreen,
    backgroundColor: withAlpha(colors.limeGreen, 0.2),
    transform: [{ scale: 1.1 }],
  },
  emoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  center: {
    textAlign: "center",
  },
});
