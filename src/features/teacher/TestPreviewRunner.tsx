import { useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";

import { taskTypeInstructions, type MissionTaskType } from "@slay/core";
import type { Json } from "@slay/core/types";
import { alpha, colors, withAlpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { ProgressBar, SlayButton, SlayText } from "~/components/ui";
import { HowToPlayButton, TaskRunner } from "~/features/mission";

/** One draft test task, as both content editors hold it before publishing. */
export interface PreviewTask {
  taskType: MissionTaskType;
  content: Json;
}

export interface TestPreviewRunnerProps {
  open: boolean;
  onClose: () => void;
  /** Heading, e.g. "Preview — Grammar test". */
  title: string;
  tasks: PreviewTask[];
}

/**
 * Port of upstream's `teacher/TestPreviewRunner.tsx`: the teacher plays a
 * draft test exactly as a student would — the same `TaskRunner` — before it
 * reaches the class. Nothing is saved, no pass recorded, no XP granted. A
 * full-screen modal here, since the games need the room; Android's back
 * button leaves it.
 */
export function TestPreviewRunner({ open, onClose, title, tasks }: TestPreviewRunnerProps) {
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      {/* Mounted only while open, so every opening is a clean run. */}
      {open ? <PreviewSession title={title} tasks={tasks} onClose={onClose} /> : null}
    </Modal>
  );
}

function PreviewSession({ title, tasks, onClose }: { title: string; tasks: PreviewTask[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  // Bumped on Restart so the task remounts clean instead of keeping the last pass's answers.
  const [runKey, setRunKey] = useState(0);
  const total = tasks.length;
  const current = tasks[index];
  const finished = index >= total;

  const restart = () => {
    setIndex(0);
    setRunKey((k) => k + 1);
  };

  return (
    <AppContainer>
      <View style={styles.header}>
        <SlayText variant="h3" weight="900" accessibilityRole="header" numberOfLines={1}>
          {title}
        </SlayText>
      </View>

      {total === 0 ? (
        <View style={styles.center}>
          <SlayText variant="small" color={alpha.white50}>
            No test tasks to preview yet.
          </SlayText>
        </View>
      ) : finished ? (
        <View style={styles.center}>
          <View style={styles.party}>
            <SlayText variant="h1" accessible={false}>
              🎉
            </SlayText>
          </View>
          <SlayText variant="h3" weight="700" style={styles.centerText}>
            You went through the whole test.
          </SlayText>
          <SlayText variant="small" color={alpha.white60} style={styles.centerText}>
            {total} task{total === 1 ? "" : "s"} — nothing was saved. Fix anything that felt off, then publish.
          </SlayText>
        </View>
      ) : (
        <View style={styles.fill}>
          <View style={styles.progressRow}>
            <SlayText variant="label" weight="700" color={alpha.white50}>
              Task {index + 1} of {total}
            </SlayText>
            <HowToPlayButton text={taskTypeInstructions(current.taskType)} />
          </View>
          <ProgressBar value={(index / total) * 100} variant="pink" />
          <ScrollView style={styles.fill} contentContainerStyle={styles.task} keyboardShouldPersistTaps="handled">
            <TaskRunner
              key={`${runKey}-${index}`}
              taskType={current.taskType}
              content={current.content}
              actionLabel={index === total - 1 ? "Finish" : "Next"}
              onComplete={() => setIndex((i) => i + 1)}
            />
          </ScrollView>
        </View>
      )}

      <View style={styles.footer}>
        <SlayButton variant="ghost" style={styles.grow} onPress={onClose}>
          Exit
        </SlayButton>
        <SlayButton variant="green" disabled={total === 0} onPress={restart}>
          Restart
        </SlayButton>
      </View>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingVertical: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerText: { textAlign: "center" },
  party: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: withAlpha(colors.limeGreen, 0.15) },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 },
  task: { paddingVertical: 12 },
  footer: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: alpha.white10, paddingVertical: 12 },
  grow: { flex: 1 },
});
