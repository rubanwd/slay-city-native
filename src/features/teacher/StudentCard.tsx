import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

import { KNOWLEDGE_LEVEL_LABELS } from "@slay/core";
import type { TeacherGroupStudent } from "@slay/data";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.chip}>
      <SlayText variant="bodyStrong" weight="900">
        {value}
      </SlayText>
      <SlayText variant="label" color={alpha.white50} style={styles.chipLabel}>
        {label}
      </SlayText>
    </View>
  );
}

/**
 * Port of upstream's `teacher/StudentCard.tsx`: one student on the teacher
 * dashboard. Collapsed it stays scannable — the name and Topics/Missions
 * chips; a tap expands the level test result and the per-topic passes, so the
 * detail lives on the same screen without cluttering a class-sized list.
 *
 * `onHomework` is for a 1-on-1 student, who has no group header to carry the
 * Homework link — it then sits at the end of the row (upstream #121).
 */
export function StudentCard({ student, onHomework }: { student: TeacherGroupStudent; onHomework?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const totalTopics = student.topicResults.length;
  const passedCount = student.topicResults.filter((t) => t.passed).length;
  const hasTopics = totalTopics > 0;

  return (
    <View style={styles.card}>
      <View style={styles.rowWrap}>
        <SlayPressable
          accessibilityRole="button"
          accessibilityLabel={`${student.username}${hasTopics ? `, topics ${passedCount} of ${totalTopics}` : ""}, ${student.missionsCompleted} missions`}
          aria-expanded={expanded}
          onPress={() => setExpanded((prev) => !prev)}
          style={styles.row}
        >
          <SlayText variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {student.username}
          </SlayText>
          <View style={styles.stats}>
            {hasTopics ? <StatChip label="Topics" value={`${passedCount}/${totalTopics}`} /> : null}
            <StatChip label="Missions" value={student.missionsCompleted} />
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={expanded ? styles.flipped : undefined}>
              <Polyline points="6 9 12 15 18 9" stroke={alpha.white40} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        </SlayPressable>
        {onHomework ? (
          <SlayPressable
            accessibilityRole="link"
            accessibilityLabel={`${student.username} homework`}
            hitSlop={8}
            onPress={onHomework}
            style={({ pressed }) => [styles.homework, pressed && styles.homeworkPressed]}
          >
            <SlayText variant="label" weight="900" color={colors.limeGreen} style={styles.homeworkText}>
              Homework
            </SlayText>
          </SlayPressable>
        ) : null}
      </View>

      {expanded ? (
        <View style={styles.detail}>
          <SlayText variant="label" color={alpha.white50} style={styles.plain}>
            Level test:{" "}
            {student.placement ? (
              <SlayText variant="label" weight="600" color={colors.cyan} style={styles.plain}>
                {KNOWLEDGE_LEVEL_LABELS[student.placement.recommendedLevel]} ({student.placement.totalCorrect}/
                {student.placement.totalQuestions}) · {new Date(student.placement.takenAt).toLocaleDateString("en-GB")}
              </SlayText>
            ) : (
              "not taken yet"
            )}
          </SlayText>
          {!hasTopics ? (
            <SlayText variant="label" color={alpha.white50} style={styles.plain}>
              No homework topics yet.
            </SlayText>
          ) : (
            <View style={styles.topics}>
              <SlayText variant="label" weight="700" color={alpha.white50}>
                Topics passed {passedCount}/{totalTopics}
              </SlayText>
              <View style={styles.pills}>
                {student.topicResults.map((topic) => (
                  <View
                    key={topic.topicId}
                    accessibilityLabel={`${topic.title}, ${topic.passed ? "passed" : "not passed"}`}
                    style={[styles.pill, topic.passed ? styles.pillPassed : styles.pillOpen]}
                  >
                    <SlayText variant="label" weight="600" color={topic.passed ? colors.limeGreen : alpha.white50} style={styles.plain} numberOfLines={1}>
                      {topic.passed ? "✓" : "○"} {topic.title}
                    </SlayText>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, borderColor: alpha.white10, backgroundColor: colors.surface },
  rowWrap: { flexDirection: "row", alignItems: "center" },
  homework: { marginRight: 12, borderRadius: 999, borderWidth: 1, borderColor: withAlpha(colors.limeGreen, 0.5), paddingHorizontal: 10, paddingVertical: 4 },
  homeworkPressed: { backgroundColor: withAlpha(colors.limeGreen, 0.1) },
  homeworkText: { fontSize: 10 },
  row: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  name: { flexShrink: 1 },
  stats: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: { alignItems: "center", borderRadius: radii.md, backgroundColor: alpha.white5, paddingHorizontal: 10, paddingVertical: 6 },
  chipLabel: { fontSize: 10 },
  flipped: { transform: [{ rotate: "180deg" }] },
  detail: { gap: 12, borderTopWidth: 1, borderTopColor: alpha.white10, paddingHorizontal: 16, paddingVertical: 12 },
  plain: { textTransform: "none", letterSpacing: 0 },
  topics: { gap: 6 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { maxWidth: 180, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillPassed: { backgroundColor: withAlpha(colors.limeGreen, 0.15) },
  pillOpen: { backgroundColor: alpha.white5 },
});
