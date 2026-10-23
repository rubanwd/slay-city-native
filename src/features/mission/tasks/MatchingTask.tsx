import { useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { shuffle, type MatchingContent, type MatchingPair } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { imageSource } from "~/lib/imageSource";

import type { TaskProps } from "../taskContract";

/** How long a wrong match stays pink — upstream's 500ms. */
const WRONG_FLASH_MS = 500;

/**
 * Port of upstream's `MatchingTask`: tap a word, then its translation (or
 * picture). A right pair locks green; a wrong one flashes pink. Both columns
 * are shuffled once, when the task opens.
 */
export function MatchingTask({ content, onComplete, actionLabel }: TaskProps<MatchingContent>) {
  const { prompt, mode, pairs } = content;
  const [words] = useState<MatchingPair[]>(() => shuffle(pairs));
  const [matches] = useState<MatchingPair[]>(() => shuffle(pairs));
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(() => new Set());
  const [wrongMatchId, setWrongMatchId] = useState<string | null>(null);
  const allMatched = resolved.size === pairs.length;

  const flash = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flash.current) clearTimeout(flash.current);
  }, []);

  const pickWord = (id: string) => {
    if (resolved.has(id)) return;
    setWrongMatchId(null);
    setSelectedWordId((current) => (current === id ? null : id));
  };

  const pickMatch = (pair: MatchingPair) => {
    if (resolved.has(pair.id) || selectedWordId === null) return;
    // Accepted by what the tile shows, not which pair authored it: two words
    // can share a translation, and refusing the twin would read as wrong.
    const selectedMatch = words.find((p) => p.id === selectedWordId)?.match;
    if (pair.id === selectedWordId || pair.match === selectedMatch) {
      haptic("correct");
      setResolved((prev) => new Set(prev).add(selectedWordId));
      setSelectedWordId(null);
      return;
    }
    haptic("wrong");
    setWrongMatchId(pair.id);
    if (flash.current) clearTimeout(flash.current);
    flash.current = setTimeout(() => setWrongMatchId(null), WRONG_FLASH_MS);
  };

  return (
    <View style={styles.wrap}>
      <SlayText variant="h3" weight="600" style={styles.center}>
        {prompt}
      </SlayText>

      <View style={styles.columns}>
        <View style={styles.column}>
          {words.map((pair) => {
            const isResolved = resolved.has(pair.id);
            const isSelected = selectedWordId === pair.id;
            return (
              <SlayPressable
                key={pair.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: isResolved }}
                disabled={isResolved}
                onPress={() => pickWord(pair.id)}
                style={[styles.tile, isResolved ? styles.resolved : isSelected ? styles.selected : styles.idle]}
              >
                <SlayText variant="bodyStrong" weight="700" color={isResolved ? colors.limeGreen : colors.white} style={styles.center}>
                  {pair.word}
                </SlayText>
              </SlayPressable>
            );
          })}
        </View>

        <View style={styles.column}>
          {matches.map((pair) => {
            const isResolved = resolved.has(pair.id);
            const isWrong = wrongMatchId === pair.id;
            const picture = mode === "word-to-image" ? imageSource(pair.match) : null;
            return (
              <SlayPressable
                key={pair.id}
                accessibilityRole="button"
                accessibilityLabel={mode === "word-to-image" ? `Picture ${matches.indexOf(pair) + 1}` : pair.match}
                accessibilityState={{ disabled: isResolved || selectedWordId === null }}
                disabled={isResolved || selectedWordId === null}
                onPress={() => pickMatch(pair)}
                style={[styles.tile, styles.matchTile, isResolved ? styles.resolved : isWrong ? styles.wrong : styles.idle]}
              >
                {mode === "word-to-image" ? (
                  picture ? <Image source={picture} style={styles.picture} contentFit="cover" /> : null
                ) : (
                  <SlayText variant="bodyStrong" weight="700" style={styles.center}>
                    {pair.match}
                  </SlayText>
                )}
              </SlayPressable>
            );
          })}
        </View>
      </View>

      <SlayButton variant="green" size="lg" disabled={!allMatched} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  center: { textAlign: "center" },
  columns: { flexDirection: "row", gap: 12 },
  column: { flex: 1, gap: 12 },
  tile: {
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  matchTile: { overflow: "hidden" },
  picture: { width: "100%", height: "100%" },
  idle: { borderColor: alpha.white15, backgroundColor: alpha.white5 },
  selected: { borderColor: colors.cyan, backgroundColor: withAlpha(colors.cyan, 0.15) },
  resolved: { borderColor: withAlpha(colors.limeGreen, 0.6), backgroundColor: withAlpha(colors.limeGreen, 0.15) },
  wrong: { borderColor: colors.neonPink, backgroundColor: withAlpha(colors.neonPink, 0.15) },
});
