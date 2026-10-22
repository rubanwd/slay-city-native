import { StyleSheet, View } from "react-native";

import type { CauseEffectContent } from "@slay/core";
import { alpha, radii } from "@slay/tokens";

import { SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";
import { ChoiceTask } from "./ChoiceTask";
import { TaskHint } from "./TaskText";

/** Port of upstream's `CauseEffectTask`: "If this happens…" — pick what happens next. */
export function CauseEffectTask({ content, onComplete, actionLabel }: TaskProps<CauseEffectContent>) {
  return (
    <ChoiceTask
      layout="list"
      options={content.options}
      correctIndex={content.correctIndex}
      successText="Good thinking! 🎉"
      onComplete={onComplete}
      actionLabel={actionLabel}
      header={() => (
        <View style={styles.header}>
          <View style={styles.card}>
            <SlayText variant="label" color={alpha.white40} style={styles.center}>
              If this happens…
            </SlayText>
            <SlayText variant="h3" weight="900" style={[styles.center, styles.cause]}>
              {content.cause}
            </SlayText>
          </View>
          <TaskHint>What happens next?</TaskHint>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 24,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white15,
    backgroundColor: alpha.white5,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  center: {
    textAlign: "center",
  },
  cause: {
    marginTop: 4,
  },
});
