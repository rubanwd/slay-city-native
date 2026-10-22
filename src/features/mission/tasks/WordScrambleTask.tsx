import { useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { isSpelledCorrectly, scrambleWord, shuffle, slotGroups, type WordScrambleContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

import type { TaskProps } from "../taskContract";
import { Chip, ChipRow, ClearButton, Tray, Verdict } from "./ArrangeParts";

/**
 * Port of upstream's `WordScrambleTask`: tap the letters into the slots to
 * spell the word. Slots are grouped word by word for a multi-word answer;
 * `scrambleWord`, `slotGroups` and `isSpelledCorrectly` are upstream's, from
 * `@slay/core`.
 */
export function WordScrambleTask({ content, onComplete, actionLabel }: TaskProps<WordScrambleContent>) {
  const { word, translation, hint, imageUrl } = content;
  const { letters, groupSizes } = useMemo(() => scrambleWord(word), [word]);
  const tiles = useMemo(() => {
    const base = letters.map((char, id) => ({ id, char }));
    let scrambled = shuffle(base);
    for (let i = 0; i < 8 && scrambled.map((t) => t.char).join("") === letters.join(""); i++) {
      scrambled = shuffle(base);
    }
    return scrambled;
  }, [letters]);
  const [placed, setPlaced] = useState<number[]>([]);
  const char = (id: number) => tiles.find((t) => t.id === id)?.char ?? "";
  const solved = isSpelledCorrectly(placed.map(char).join(""), word);
  const groups = useMemo(() => slotGroups(groupSizes), [groupSizes]);
  const image = imageSource(imageUrl);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {image ? (
          <View style={styles.frame}>
            <Image source={image} style={styles.image} resizeMode="cover" accessible={false} />
          </View>
        ) : null}
        {translation ? (
          <SlayText variant="bodyStrong" weight="600" color={colors.cyan} style={styles.center}>
            {translation}
          </SlayText>
        ) : null}
        {hint ? (
          <SlayText variant="small" color={alpha.white60} style={styles.center}>
            Hint: {hint}
          </SlayText>
        ) : null}
      </View>

      <Tray style={styles.slotsTray}>
        {groups.map((slots, groupIndex) => (
          <View key={groupIndex} style={styles.group}>
            {slots.map((slot) => {
              const id = placed[slot];
              return id === undefined ? (
                <View key={slot} style={styles.emptySlot} accessible={false} />
              ) : (
                <Chip
                  key={slot}
                  letter
                  label={char(id)}
                  state={solved ? "solved" : "placed"}
                  disabled={solved}
                  accessibilityLabel={`Remove ${char(id)}`}
                  onPress={() => setPlaced((prev) => prev.filter((_, i) => i !== slot))}
                />
              );
            })}
          </View>
        ))}
      </Tray>

      <ChipRow gap={6}>
        {tiles.map((tile) => {
          const used = placed.includes(tile.id);
          return (
            <Chip
              key={tile.id}
              letter
              label={tile.char}
              state={used ? "used" : "pool"}
              disabled={used || solved}
              accessibilityLabel={`Place ${tile.char}`}
              onPress={() => setPlaced((prev) => [...prev, tile.id])}
            />
          );
        })}
      </ChipRow>

      {placed.length > 0 && !solved ? <ClearButton onPress={() => setPlaced([])} /> : null}
      {solved ? <Verdict ok>Perfect! 🎉</Verdict> : null}

      <SlayButton variant="green" size="lg" disabled={!solved} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  head: { alignItems: "center", gap: 12 },
  center: { textAlign: "center" },
  frame: {
    width: 128,
    height: 128,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: alpha.white5,
  },
  image: { width: "100%", height: "100%" },
  slotsTray: { columnGap: 20, rowGap: 8 },
  group: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  emptySlot: {
    width: 36,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: alpha.white20,
    backgroundColor: withAlpha(colors.white, 0.02),
  },
});
