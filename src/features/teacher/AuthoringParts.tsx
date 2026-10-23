import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { alpha, colors, fontFamilyByWeight, radii, typeScale, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";

/** The pieces the vocabulary and grammar editors share, as upstream's two managers do. */

export type Status = { kind: "error" | "success"; text: string } | null;

/** A small labelled field, upstream's `INPUT_CLASS !py-2 text-small`. */
export function SmallField({ label, style, ...rest }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <SlayText variant="label" color={alpha.white50} style={styles.plain}>
        {label}
      </SlayText>
      <TextInput
        maxFontSizeMultiplier={1.5}
        accessibilityLabel={label}
        placeholderTextColor={alpha.white50}
        selectionColor={colors.neonPink}
        style={[authoringStyles.input, style]}
        {...rest}
      />
    </View>
  );
}

/** A count field kept as raw text, so it can be emptied while typing. */
export function CountField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <SmallField
      label={label}
      value={value}
      onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
      keyboardType="number-pad"
      maxLength={2}
      autoCorrect={false}
      autoCapitalize="none"
      spellCheck={false}
    />
  );
}

export interface TestPreviewPanelProps {
  count: number;
  /** What to say when there is no test. */
  empty: string;
  lines: { label: string; detail: string }[];
  busy: boolean;
  onTry: () => void;
  onRegenerate: () => void;
  regenerateLabel?: string;
  /** Whether Regenerate needs a test to exist (vocabulary) or can make one (grammar). */
  regenerateNeedsTasks?: boolean;
  footnote: string;
}

/** The draft test, listed, with Try the test and Regenerate test. */
export function TestPreviewPanel({
  count,
  empty,
  lines,
  busy,
  onTry,
  onRegenerate,
  regenerateLabel = "Regenerate test",
  regenerateNeedsTasks = true,
  footnote,
}: TestPreviewPanelProps) {
  const tryDisabled = busy || count === 0;
  const regenerateDisabled = busy || (regenerateNeedsTasks && count === 0);
  return (
    <View style={authoringStyles.panel}>
      <View style={styles.head}>
        <SlayText variant="label" color={alpha.white50}>
          Test preview ({count} task{count === 1 ? "" : "s"})
        </SlayText>
        <View style={styles.buttons}>
          <SlayPressable accessibilityRole="button" disabled={tryDisabled} onPress={onTry} style={[styles.small, styles.cyan, tryDisabled && styles.dim]}>
            <SlayText variant="label" weight="700" color={colors.cyan} style={styles.smallText}>
              Try the test
            </SlayText>
          </SlayPressable>
          <SlayPressable
            accessibilityRole="button"
            disabled={regenerateDisabled}
            onPress={onRegenerate}
            style={[styles.small, styles.purple, regenerateDisabled && styles.dim]}
          >
            <SlayText variant="label" weight="700" style={styles.smallText}>
              {regenerateLabel}
            </SlayText>
          </SlayPressable>
        </View>
      </View>
      {count === 0 ? (
        <SlayText variant="label" color={alpha.white50} style={styles.plain}>
          {empty}
        </SlayText>
      ) : (
        lines.map((line, i) => (
          <View key={i} style={styles.line}>
            <View style={styles.tag}>
              <SlayText variant="label" weight="700" style={styles.smallText}>
                {line.label}
              </SlayText>
            </View>
            <SlayText variant="small" color={alpha.white60} numberOfLines={1} style={styles.shrink}>
              {line.detail}
            </SlayText>
          </View>
        ))
      )}
      <SlayText variant="label" color={alpha.white50} style={styles.plain}>
        {footnote}
      </SlayText>
    </View>
  );
}

/** Upstream's toasts, as one line by the Publish button. */
export function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <SlayText
      variant="small"
      weight="600"
      color={status.kind === "error" ? colors.neonPink : colors.limeGreen}
      accessibilityRole={status.kind === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
    >
      {status.text}
    </SlayText>
  );
}

export const authoringStyles = StyleSheet.create({
  panel: { gap: 12, borderRadius: radii.md, borderWidth: 1, borderColor: alpha.white10, backgroundColor: withAlpha(colors.black, 0.3), padding: 12 },
  input: {
    minWidth: 0,
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha.white20,
    backgroundColor: alpha.white10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.white,
    fontFamily: fontFamilyByWeight["400"],
    fontSize: typeScale.small.max,
  },
});

const styles = StyleSheet.create({
  field: { flex: 1, gap: 4 },
  plain: { textTransform: "none", letterSpacing: 0 },
  head: { gap: 8 },
  buttons: { flexDirection: "row", gap: 6 },
  small: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  cyan: { borderWidth: 1, borderColor: withAlpha(colors.cyan, 0.6) },
  purple: { backgroundColor: withAlpha(colors.purple, 0.8) },
  smallText: { fontSize: 10 },
  dim: { opacity: 0.4 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  tag: { borderRadius: 4, backgroundColor: withAlpha(colors.purple, 0.25), paddingHorizontal: 6, paddingVertical: 2 },
  shrink: { flexShrink: 1 },
});
