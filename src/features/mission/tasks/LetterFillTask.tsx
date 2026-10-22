import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { blankIndicesFor, shuffle, type LetterFillContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";
import { Chip, ChipRow, ClearButton, Verdict } from "./ArrangeParts";

/**
 * Port of upstream's `LetterFillTask`: some letters of the word are blank; tap
 * the missing letters in order. Which letters are blanked is upstream's
 * `blankIndicesFor`, from `@slay/core`.
 */
export function LetterFillTask({ content, onComplete, actionLabel }: TaskProps<LetterFillContent>) {
  const { word, hint, translation } = content;
  const blanks = useMemo(() => blankIndicesFor(word), [word]);
  const bank = useMemo(() => shuffle(blanks.map((i, id) => ({ id, char: word[i] }))), [word, blanks]);
  const [placed, setPlaced] = useState<number[]>([]);
  const solved = placed.length === blanks.length;
  const built = word.split("").map((char, i) => {
    const blankPos = blanks.indexOf(i);
    if (blankPos === -1) return char;
    if (blankPos >= placed.length) return null;
    return bank.find((b) => b.id === placed[blankPos])?.char ?? null;
  });
  const isCorrect = solved && built.join("") === word;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
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

      <View style={styles.word} accessibilityLabel={built.map((c) => c ?? "blank").join(" ")}>
        {built.map((char, i) => {
          // A space in a multi-word answer is never blanked — it is the gap between words.
          if (char !== null && char.trim() === "") {
            return <View key={i} style={styles.space} />;
          }
          const look =
            char === null ? styles.blank : solved ? (isCorrect ? styles.right : styles.wrong) : styles.filled;
          return (
            <View key={i} style={[styles.cell, look]}>
              <SlayText
                variant="bodyStrong"
                weight="900"
                color={char === null ? alpha.white40 : solved ? (isCorrect ? colors.limeGreen : colors.neonPink) : colors.white}
              >
                {char ?? ""}
              </SlayText>
            </View>
          );
        })}
      </View>

      <ChipRow gap={6}>
        {bank.map((letter) => {
          const used = placed.includes(letter.id);
          return (
            <Chip
              key={letter.id}
              letter
              label={letter.char}
              state={used ? "used" : "pool"}
              disabled={used || solved}
              accessibilityLabel={`Place ${letter.char}`}
              onPress={() => setPlaced((prev) => [...prev, letter.id])}
            />
          );
        })}
      </ChipRow>

      {placed.length > 0 && !solved ? <ClearButton onPress={() => setPlaced([])} /> : null}
      {solved ? (
        <Verdict ok={isCorrect}>{isCorrect ? "Perfect! 🎉" : "Not quite right — tap Clear to try again."}</Verdict>
      ) : null}
      {solved && !isCorrect ? <ClearButton onPress={() => setPlaced([])} /> : null}

      <SlayButton variant="green" size="lg" disabled={!isCorrect} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  head: { alignItems: "center", gap: 8 },
  center: { textAlign: "center" },
  word: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  space: { width: 16 },
  cell: {
    width: 40,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  blank: { borderStyle: "dashed", borderColor: alpha.white25, backgroundColor: withAlpha(colors.white, 0.03) },
  filled: { borderColor: withAlpha(colors.cyan, 0.6), backgroundColor: withAlpha(colors.cyan, 0.1) },
  right: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.15) },
  wrong: { borderColor: colors.neonPink, backgroundColor: withAlpha(colors.neonPink, 0.15) },
});
