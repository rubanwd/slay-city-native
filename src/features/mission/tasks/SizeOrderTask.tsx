import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { shuffle, type SizeOrderContent } from "@slay/core";

import { SlayButton } from "~/components/ui";

import type { TaskProps } from "../taskContract";
import { Chip, ChipRow, ClearButton, Tray, TrayPlaceholder, Verdict } from "./ArrangeParts";
import { TaskPrompt } from "./TaskText";

/** Port of upstream's `SizeOrderTask`: tap the items in order, smallest to biggest (or as the prompt says). */
export function SizeOrderTask({ content, onComplete, actionLabel }: TaskProps<SizeOrderContent>) {
  const { prompt, items } = content;
  const chips = useMemo(() => {
    const base = items.map((text, id) => ({ id, text }));
    let scrambled = shuffle(base);
    for (let i = 0; i < 8 && scrambled.map((c) => c.text).join("|") === items.join("|"); i++) {
      scrambled = shuffle(base);
    }
    return scrambled;
  }, [items]);
  const [placed, setPlaced] = useState<number[]>([]);
  const text = (id: number) => chips.find((c) => c.id === id)?.text ?? "";
  const built = placed.map(text);
  const solved = built.length === items.length && built.join("|") === items.join("|");

  return (
    <View style={styles.wrap}>
      <TaskPrompt variant="h3">{prompt}</TaskPrompt>

      <Tray>
        {placed.length === 0 ? (
          <TrayPlaceholder>Tap the items below…</TrayPlaceholder>
        ) : (
          placed.map((id, index) => (
            <Chip
              key={id}
              label={`${index + 1}. ${text(id)}`}
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
      {solved ? <Verdict ok>Perfect order! 🎉</Verdict> : null}

      <SlayButton variant="green" size="lg" disabled={!solved} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
});
