import { StyleSheet, View } from "react-native";

import { alpha } from "@slay/tokens";

import { SlayButton, SlayText } from "~/components/ui";

import type { TaskRunnerProps } from "./taskContract";
import { TASKS } from "./taskRegistry";

/**
 * Port of upstream's `TaskRunner.tsx`: parses a task's JSONB content and
 * renders the matching task, falling back to a skip card when the type is not
 * playable here yet or the content is malformed — a single bad task never
 * blocks a mission. Upstream switches over all 32 types inline; here they live
 * in `taskRegistry.ts`, so the parallel task packages each touch one line.
 */
export function TaskRunner({ taskType, content, onComplete, onSkip, actionLabel }: TaskRunnerProps) {
  // Only a real number may reach the caller as a fraction — a task may wire
  // `onComplete` straight to a button, which calls it with a press event.
  const complete = (rewardFraction?: unknown) =>
    onComplete(typeof rewardFraction === "number" ? rewardFraction : undefined);

  const rendered = TASKS[taskType]?.(content, { onComplete: complete, actionLabel }) ?? null;

  return (
    rendered ?? (
      <UnsupportedTask onContinue={onSkip ?? (() => complete())} actionLabel={onSkip ? "Skip" : actionLabel} />
    )
  );
}

function UnsupportedTask({ onContinue, actionLabel }: { onContinue: () => void; actionLabel: string }) {
  return (
    <View style={styles.unsupported}>
      <SlayText variant="body" color={alpha.white60} style={styles.center}>
        This task type isn&apos;t available yet — skip ahead.
      </SlayText>
      <SlayButton variant="green" size="lg" onPress={() => onContinue()} style={styles.full}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  unsupported: {
    alignItems: "center",
    gap: 24,
  },
  center: {
    textAlign: "center",
  },
  full: {
    alignSelf: "stretch",
  },
});
