import { StyleSheet, TextInput, View } from "react-native";

import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";

import { authoringStyles } from "./AuthoringParts";

/** One editable grammar point in the teacher's draft. */
export interface DraftGrammarPoint {
  key: string;
  title: string;
  explanation: string;
  example: string;
}

export interface GrammarPointEditorProps {
  point: DraftGrammarPoint;
  index: number;
  onChange: (patch: Partial<DraftGrammarPoint>) => void;
  onRemove: () => void;
}

/** Prose for children: the keyboard may help, and sentences start with a capital. */
const PROSE = { autoCapitalize: "sentences", autoCorrect: true, spellCheck: true } as const;

/** Port of upstream's `teacher/GrammarPointEditor.tsx`: one rule — title, explanation, example. Presentational. */
export function GrammarPointEditor({ point, index, onChange, onRemove }: GrammarPointEditorProps) {
  const label = point.title.trim() || `rule ${index + 1}`;
  return (
    <View style={styles.row}>
      <View style={styles.titleLine}>
        <SlayText variant="label" weight="700" color={withAlpha(colors.white, 0.3)}>
          #{index + 1}
        </SlayText>
        <TextInput
          value={point.title}
          onChangeText={(text) => onChange({ title: text })}
          placeholder="rule title (e.g. Present Simple: he/she/it + s)"
          placeholderTextColor={alpha.white40}
          selectionColor={colors.neonPink}
          accessibilityLabel={`Rule ${index + 1} title`}
          style={[authoringStyles.input, styles.grow]}
          {...PROSE}
        />
        <SlayPressable accessibilityRole="button" accessibilityLabel={`Remove ${label}`} hitSlop={8} onPress={onRemove} style={styles.remove}>
          <SlayText variant="small" color={colors.neonPink}>
            ✕
          </SlayText>
        </SlayPressable>
      </View>
      <TextInput
        value={point.explanation}
        onChangeText={(text) => onChange({ explanation: text })}
        placeholder="short, kid-friendly explanation"
        placeholderTextColor={alpha.white40}
        selectionColor={colors.neonPink}
        accessibilityLabel={`Rule ${index + 1} explanation`}
        multiline
        style={[authoringStyles.input, styles.multiline]}
        {...PROSE}
      />
      <TextInput
        value={point.example}
        onChangeText={(text) => onChange({ example: text })}
        placeholder="example sentence"
        placeholderTextColor={alpha.white40}
        selectionColor={colors.neonPink}
        accessibilityLabel={`Rule ${index + 1} example`}
        style={authoringStyles.input}
        {...PROSE}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6, borderRadius: radii.lg, borderWidth: 1, borderColor: alpha.white10, backgroundColor: colors.surface, padding: 12 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  grow: { flex: 1 },
  remove: { paddingHorizontal: 6, paddingVertical: 4 },
  multiline: { minHeight: 64, textAlignVertical: "top" },
});
