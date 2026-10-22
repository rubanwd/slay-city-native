import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { shuffle, type CountingGameContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";
import { ChoiceTask } from "./ChoiceTask";
import { TaskPrompt } from "./TaskText";

/** Port of upstream's `CountingGameTask`: count the repeated emoji, tap the number. */
export function CountingGameTask({ content, onComplete, actionLabel }: TaskProps<CountingGameContent>) {
  const { prompt, emoji, count, options } = content;
  const items = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  // Shuffled once per task, as upstream does.
  const shuffled = useMemo(() => shuffle(options), [options]);

  return (
    <ChoiceTask
      layout="numbers"
      options={shuffled.map(String)}
      correctIndex={shuffled.indexOf(count)}
      successText="Correct! 🎉"
      failText={`Not quite — there are ${count}.`}
      onComplete={onComplete}
      actionLabel={actionLabel}
      header={() => (
        <View style={styles.header}>
          <TaskPrompt>{prompt}</TaskPrompt>
          <View style={styles.tray} accessibilityLabel={`${emoji} — count them`}>
            {items.map((i) => (
              <SlayText key={i} style={styles.emoji}>
                {emoji}
              </SlayText>
            ))}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 24,
  },
  tray: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: withAlpha(colors.black, 0.2),
    padding: 20,
  },
  emoji: {
    fontSize: 36,
    lineHeight: 40,
  },
});
