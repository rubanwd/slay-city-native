import { StyleSheet, View } from "react-native";

import type { CompletionRow } from "@slay/data";
import { alpha, colors, radii } from "@slay/tokens";

import { SlayText } from "~/components/ui";

/**
 * Port of upstream's `VocabularyCompletions.tsx` and `GrammarCompletions.tsx`,
 * which differ only in their heading: who in the group has passed this module.
 */
export function Completions({ title, rows }: { title: string; rows: CompletionRow[] }) {
  if (rows.length === 0) return null;
  const passedCount = rows.filter((r) => r.passed).length;

  return (
    <View style={styles.box}>
      <SlayText variant="label" color={alpha.white50} accessibilityRole="header">
        {title} ({passedCount}/{rows.length})
      </SlayText>
      {rows.map((row) => (
        <View key={row.studentId} style={styles.row}>
          <SlayText variant="small" numberOfLines={1} style={styles.shrink}>
            {row.username}
          </SlayText>
          <SlayText variant="label" weight="700" color={row.passed ? colors.limeGreen : alpha.white40}>
            {row.passed ? "Passed ✓" : "Not yet"}
          </SlayText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shrink: { flexShrink: 1 },
});
