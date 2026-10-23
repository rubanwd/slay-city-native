import { StyleSheet, View } from "react-native";

import type { DialogueChoiceContent } from "@slay/core";
import { alpha, radii } from "@slay/tokens";

import { SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";
import { ChoiceTask } from "./ChoiceTask";

/** Port of upstream's `DialogueChoiceTask`: someone speaks; pick the best reply. */
export function DialogueChoiceTask({ content, onComplete, actionLabel }: TaskProps<DialogueChoiceContent>) {
  const { prompt, speaker, options, correctIndex, translation } = content;
  return (
    <ChoiceTask
      layout="replies"
      options={options}
      correctIndex={correctIndex}
      successText="Great reply! 🎉"
      failText="Not quite — the best reply is highlighted."
      footnote={translation}
      onComplete={onComplete}
      actionLabel={actionLabel}
      header={() => (
        <View style={styles.row}>
          <View style={styles.avatar}>
            <SlayText variant="bodyStrong">💬</SlayText>
          </View>
          <View style={styles.speech}>
            {speaker ? (
              <SlayText variant="label" color={alpha.white50}>
                {speaker}
              </SlayText>
            ) : null}
            <View style={styles.bubble}>
              <SlayText variant="bodyStrong">{prompt}</SlayText>
            </View>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: alpha.white10,
  },
  speech: {
    flexShrink: 1,
    gap: 4,
  },
  bubble: {
    borderRadius: radii.lg,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: alpha.white15,
    backgroundColor: alpha.white5,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
