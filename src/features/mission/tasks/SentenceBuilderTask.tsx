import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { shuffle, type SentenceBuilderContent } from "@slay/core";
import { alpha } from "@slay/tokens";

import { SlayButton, SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";
import { Chip, ChipRow, ClearButton, Tray, TrayPlaceholder, Verdict } from "./ArrangeParts";

/** Port of upstream's `SentenceBuilderTask`: tap the words into the right order. */
export function SentenceBuilderTask({ content, onComplete, actionLabel }: TaskProps<SentenceBuilderContent>) {
  const { words, translation, prompt } = content;
  const chips = useMemo(() => {
    const base = words.map((text, id) => ({ id, text }));
    // Reshuffle until it isn't already the answer, as upstream does.
    let scrambled = shuffle(base);
    for (let i = 0; i < 8 && scrambled.map((c) => c.text).join(" ") === words.join(" "); i++) {
      scrambled = shuffle(base);
    }
    return scrambled;
  }, [words]);
  const [placed, setPlaced] = useState<number[]>([]);
  const text = (id: number) => chips.find((c) => c.id === id)?.text ?? "";
  const solved = placed.map(text).join(" ") === words.join(" ");

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <SlayText variant="h3" weight="600" style={styles.center}>
          {prompt}
        </SlayText>
        {translation ? (
          <SlayText variant="small" color={alpha.white60} style={styles.center}>
            {translation}
          </SlayText>
        ) : null}
      </View>

      <Tray>
        {placed.length === 0 ? (
          <TrayPlaceholder>Tap the words below…</TrayPlaceholder>
        ) : (
          placed.map((id, index) => (
            <Chip
              key={id}
              label={text(id)}
              state={solved ? "solved" : "placed"}
              disabled={solved}
              accessibilityLabel={`Remove ${text(id)}`}
              onPress={() => setPlaced((prev) => prev.filter((_, i) => i !== index))}
            />
          ))
        )}
      </Tray>

      <ChipRow>
        {chips.map((chip) => {
          const used = placed.includes(chip.id);
          return (
            <Chip
              key={chip.id}
              label={chip.text}
              state={used ? "used" : "pool"}
              disabled={used || solved}
              onPress={() => setPlaced((prev) => [...prev, chip.id])}
            />
          );
        })}
      </ChipRow>

      {placed.length > 0 && !solved ? <ClearButton onPress={() => setPlaced([])} /> : null}
      {solved ? <Verdict ok>Great sentence! 🎉</Verdict> : null}

      <SlayButton variant="green" size="lg" disabled={!solved} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  head: { gap: 8 },
  center: { textAlign: "center" },
});
