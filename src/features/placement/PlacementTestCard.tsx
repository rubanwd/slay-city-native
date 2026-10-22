import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { KNOWLEDGE_LEVEL_LABELS, type Messages } from "@slay/core";
import type { PlacementAttemptSummary } from "@slay/data";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";

export interface PlacementTestCardProps {
  /** The student's latest attempt, or null if they never took the test. */
  latest: PlacementAttemptSummary | null;
  messages: Messages["student"]["profile"];
}

/**
 * Port of upstream's `placement/PlacementTestCard.tsx`: the profile's way into
 * the placement test, with the last result when there is one. Deliberately
 * secondary-looking — the profile's primary action stays where it is.
 */
export function PlacementTestCard({ latest, messages }: PlacementTestCardProps) {
  const router = useRouter();
  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <SlayText variant="label" color={alpha.white50}>
          {messages.placementTitle}
        </SlayText>
        <SlayText variant="small" color={alpha.white70}>
          {latest
            ? messages.placementLast(KNOWLEDGE_LEVEL_LABELS[latest.recommendedLevel], latest.totalCorrect, latest.totalQuestions)
            : messages.placementIntro}
        </SlayText>
      </View>
      <SlayPressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => router.push("/placement-test")}
        style={({ pressed }) => [styles.go, pressed && styles.goPressed]}
      >
        <SlayText variant="label" weight="700" color={colors.black}>
          {latest ? messages.placementRetake : messages.placementStart}
        </SlayText>
      </SlayPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.cyan, 0.3),
    backgroundColor: withAlpha(colors.cyan, 0.05),
    padding: 16,
  },
  text: { flexShrink: 1, minWidth: 0, gap: 2 },
  go: { flexShrink: 0, borderRadius: 999, backgroundColor: colors.cyan, paddingHorizontal: 12, paddingVertical: 6 },
  goPressed: { opacity: 0.85 },
});
