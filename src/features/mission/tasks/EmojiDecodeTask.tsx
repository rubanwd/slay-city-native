import { StyleSheet, View } from "react-native";

import type { EmojiDecodeContent } from "@slay/core";
import { alpha, radii } from "@slay/tokens";

import { SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";
import { ChoiceTask } from "./ChoiceTask";
import { TaskHint, TaskPrompt } from "./TaskText";

/**
 * Port of upstream's `EmojiDecodeTask`: an emoji rebus; pick the word it spells.
 * Upstream draws emoji through Twemoji for consistent art in every browser; a
 * phone draws its own system emoji, which is what its user expects.
 */
export function EmojiDecodeTask({ content, onComplete, actionLabel }: TaskProps<EmojiDecodeContent>) {
  const { emojis, options, correctIndex, translation } = content;
  return (
    <ChoiceTask
      layout="list"
      options={options}
      correctIndex={correctIndex}
      successText={translation ? `Yes — ${translation}! 🎉` : "You got it! 🎉"}
      onComplete={onComplete}
      actionLabel={actionLabel}
      header={() => (
        <View style={styles.header}>
          <TaskPrompt>Which word does this emoji mean?</TaskPrompt>
          <View style={styles.emojiCard}>
            <SlayText style={styles.emoji}>{emojis}</SlayText>
          </View>
          <TaskHint>Pick the matching word below.</TaskHint>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    gap: 8,
  },
  emojiCard: {
    marginTop: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white15,
    backgroundColor: alpha.white5,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emoji: {
    fontSize: 48,
    lineHeight: 60,
    textAlign: "center",
  },
});
