import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { describeSource, type TopicContentKind, type TopicSource } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";

export interface TopicContentImporterProps {
  /** Topics that already carry content of this kind, from any of the teacher's groups. */
  sources: TopicSource[];
  kind: TopicContentKind;
  disabled?: boolean;
  /** While the chosen topic's content loads. */
  loading?: boolean;
  /** Called with the picked topic id — the editor loads it into its draft. */
  onImport: (sourceTopicId: string) => void;
}

/**
 * Port of upstream's `teacher/TopicContentImporter.tsx`: the third way to
 * author a topic, next to AI and by hand — copy what the teacher already wrote
 * for another group. A list of radio rows instead of the web's `<select>`.
 * Purely a picker: nothing is written until Publish.
 */
export function TopicContentImporter({ sources, kind, disabled = false, loading = false, onImport }: TopicContentImporterProps) {
  const [selected, setSelected] = useState("");
  const noun = kind === "vocabulary" ? "vocabulary" : "grammar";

  return (
    <View style={styles.box}>
      <SlayText variant="label" color={alpha.white50}>
        Copy from another topic
      </SlayText>
      {sources.length === 0 ? (
        <SlayText variant="label" color={alpha.white50} style={styles.plain}>
          None of your other topics has {noun} yet — publish one and you can reuse it here.
        </SlayText>
      ) : (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel="Existing topic" style={styles.list}>
            {sources.map((source) => {
              const checked = selected === source.topicId;
              return (
                <SlayPressable
                  key={source.topicId}
                  accessibilityRole="radio"
                  aria-checked={checked}
                  disabled={disabled || loading}
                  onPress={() => setSelected(source.topicId)}
                  style={[styles.row, checked && styles.rowChecked]}
                >
                  <SlayText variant="small" color={checked ? colors.limeGreen : alpha.white80}>
                    {describeSource(source, kind)}
                  </SlayText>
                </SlayPressable>
              );
            })}
          </View>
          <SlayButton variant="ghost" loading={loading} disabled={disabled || loading || !selected} onPress={() => selected && onImport(selected)}>
            {`Copy ${noun} here`}
          </SlayButton>
          <SlayText variant="label" color={alpha.white50} style={styles.plain}>
            Loads that topic&apos;s {noun} into the list below for review — publish to apply it.
          </SlayText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12, borderRadius: radii.md, borderWidth: 1, borderColor: alpha.white10, backgroundColor: withAlpha(colors.black, 0.3), padding: 12 },
  plain: { textTransform: "none", letterSpacing: 0 },
  list: { gap: 6 },
  row: { borderRadius: radii.md, borderWidth: 1, borderColor: alpha.white15, paddingHorizontal: 12, paddingVertical: 10 },
  rowChecked: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.1) },
});
