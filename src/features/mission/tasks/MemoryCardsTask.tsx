import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { shuffle, type MemoryCardsContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

import type { TaskProps } from "../taskContract";

/** How long a mismatched pair stays face-up — upstream's 900ms. */
const MISMATCH_MS = 900;

interface Card {
  key: string;
  pairId: string;
  face: "word" | "match";
  value: string;
}

/**
 * Port of upstream's `MemoryCardsTask`: a concentration game. Flip two cards
 * at a time to find a word and its match (translation or picture). A found
 * pair stays face-up; a mismatch flips back after a beat. Done when every
 * pair is found.
 */
export function MemoryCardsTask({ content, onComplete, actionLabel }: TaskProps<MemoryCardsContent>) {
  const { prompt, mode, pairs } = content;
  const [cards] = useState<Card[]>(() =>
    shuffle(
      pairs.flatMap((pair) => [
        { key: `${pair.id}-w`, pairId: pair.id, face: "word" as const, value: pair.word },
        { key: `${pair.id}-m`, pairId: pair.id, face: "match" as const, value: pair.match },
      ]),
    ),
  );
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const won = matched.size === pairs.length;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const flip = (card: Card) => {
    if (busy || matched.has(card.pairId) || flipped.includes(card.key)) return;

    const next = [...flipped, card.key];
    setFlipped(next);
    if (next.length < 2) return;

    const [a, b] = next.map((key) => cards.find((c) => c.key === key)!);
    if (a.pairId === b.pairId) {
      setMatched((prev) => new Set(prev).add(a.pairId));
      setFlipped([]);
      return;
    }
    setBusy(true);
    timer.current = setTimeout(() => {
      setFlipped([]);
      setBusy(false);
    }, MISMATCH_MS);
  };

  return (
    <View style={styles.wrap}>
      <SlayText variant="h3" weight="600" style={styles.center}>
        {prompt}
      </SlayText>

      <View style={styles.grid}>
        {cards.map((card, index) => {
          const isMatched = matched.has(card.pairId);
          const isUp = isMatched || flipped.includes(card.key);
          const isPicture = mode === "word-to-image" && card.face === "match";
          const picture = isPicture ? imageSource(card.value) : null;
          return (
            <SlayPressable
              key={card.key}
              accessibilityRole="button"
              accessibilityLabel={
                isUp ? (isPicture ? `Picture card ${index + 1}` : card.value) : `Card ${index + 1}, face down`
              }
              accessibilityState={{ disabled: isUp }}
              disabled={isUp}
              onPress={() => flip(card)}
              style={[styles.card, isUp ? (isMatched ? styles.matched : styles.up) : styles.down]}
            >
              {isUp ? (
                isPicture ? (
                  picture ? <Image source={picture} style={styles.picture} resizeMode="cover" /> : null
                ) : (
                  <SlayText
                    variant="small"
                    weight="700"
                    color={isMatched ? colors.limeGreen : colors.white}
                    style={styles.center}
                  >
                    {card.value}
                  </SlayText>
                )
              ) : (
                <SlayText variant="h3" weight="900" color={alpha.white50}>
                  ?
                </SlayText>
              )}
            </SlayPressable>
          );
        })}
      </View>

      {won ? (
        <SlayText variant="bodyStrong" weight="700" color={colors.limeGreen} style={styles.center} accessibilityLiveRegion="polite">
          Every pair found! 🎉
        </SlayText>
      ) : null}

      <SlayButton variant="green" size="lg" disabled={!won} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  center: { textAlign: "center" },
  // Four cards a row, as upstream's `grid-cols-4`.
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  card: {
    width: "22%",
    aspectRatio: 3 / 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: radii.md,
    borderWidth: 2,
    padding: 4,
  },
  down: { borderColor: alpha.white15, backgroundColor: withAlpha(colors.purple, 0.3) },
  up: { borderColor: colors.cyan, backgroundColor: withAlpha(colors.cyan, 0.15) },
  matched: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.15) },
  picture: { width: "100%", height: "100%", borderRadius: radii.sm },
});
