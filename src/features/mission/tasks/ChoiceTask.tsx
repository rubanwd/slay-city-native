import { useState, type ReactNode } from "react";
import { StyleSheet, View, type TextStyle, type ViewStyle } from "react-native";

import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";

/**
 * How the options are laid out — the four arrangements upstream's
 * single-choice tasks use.
 *
 * - `list`: full-width rows, left-aligned (quiz, cause → effect, emoji decode)
 * - `grid`: two big tiles per row (analogy, antonym, rhyme, odd one out, clock)
 * - `numbers`: four short tiles per row (counting)
 * - `replies`: chat bubbles from the right (dialogue choice)
 */
export type ChoiceLayout = "list" | "grid" | "numbers" | "replies";

export interface ChoiceTaskProps extends Omit<TaskProps<unknown>, "content"> {
  /** What sits above the options. Receives whether the student has answered. */
  header: (answered: boolean) => ReactNode;
  options: readonly string[];
  correctIndex: number;
  layout: ChoiceLayout;
  /** Upstream's per-task praise, e.g. "Sharp thinking! 🎉". */
  successText: string;
  /** @default "Not quite — the answer is highlighted." */
  failText?: string;
  /** Shown under the verdict once answered, e.g. a dialogue's translation. */
  footnote?: string | null;
}

/**
 * The shape upstream's single-choice tasks share, written once: a header,
 * options that lock on the first tap, the correct option turning green and a
 * wrong pick pink, the task's own verdict line, then the action button —
 * enabled only once the student has answered. Every one of them reports a
 * plain completion; getting it right earns nothing extra (AGENTS.md).
 */
export function ChoiceTask({
  header,
  options,
  correctIndex,
  layout,
  successText,
  failText = "Not quite — the answer is highlighted.",
  footnote,
  onComplete,
  actionLabel,
}: ChoiceTaskProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const isCorrect = selected === correctIndex;
  const look = LAYOUTS[layout];

  return (
    <View style={styles.wrap}>
      {header(answered)}

      <View style={look.container} accessibilityRole="radiogroup">
        {options.map((option, index) => {
          const revealCorrect = answered && index === correctIndex;
          const revealWrong = answered && selected === index && index !== correctIndex;
          return (
            <SlayPressable
              // Options are plain strings and may repeat; their position is their identity.
              key={index}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === index, disabled: answered }}
              accessibilityLabel={option}
              disabled={answered}
              onPress={() => setSelected(index)}
              style={({ pressed }) => [
                styles.option,
                look.option,
                revealCorrect ? styles.correct : revealWrong ? styles.wrong : look.idle,
                pressed && !answered && styles.pressed,
              ]}
            >
              <SlayText
                variant={look.text.variant}
                weight={look.text.weight}
                color={revealCorrect ? colors.limeGreen : revealWrong ? colors.neonPink : colors.white}
                style={look.label}
              >
                {option}
              </SlayText>
            </SlayPressable>
          );
        })}
      </View>

      {answered ? (
        <View style={styles.verdict} accessibilityLiveRegion="polite">
          <SlayText
            variant="bodyStrong"
            weight="700"
            color={isCorrect ? colors.limeGreen : colors.neonPink}
            style={styles.center}
          >
            {isCorrect ? successText : failText}
          </SlayText>
          {footnote ? (
            <SlayText variant="small" color={alpha.white50} style={styles.center}>
              {footnote}
            </SlayText>
          ) : null}
        </View>
      ) : null}

      <SlayButton variant="green" size="lg" disabled={!answered} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

interface LayoutLook {
  container: ViewStyle;
  option: ViewStyle;
  idle: ViewStyle;
  label: TextStyle;
  text: { variant: "body" | "bodyStrong" | "h3"; weight: "500" | "700" | "900" };
}

const idle: ViewStyle = { borderColor: alpha.white15, backgroundColor: alpha.white5 };
const tileRow: ViewStyle = { flexDirection: "row", flexWrap: "wrap", gap: 12 };

const LAYOUTS: Record<ChoiceLayout, LayoutLook> = {
  list: {
    container: { gap: 12 },
    option: { minHeight: 56, paddingHorizontal: 20, paddingVertical: 16 },
    idle,
    label: {},
    text: { variant: "body", weight: "500" },
  },
  grid: {
    container: tileRow,
    // Two per row: half the row less half the gap.
    option: { flexBasis: "47%", flexGrow: 1, minHeight: 72, alignItems: "center", paddingHorizontal: 16, paddingVertical: 24 },
    idle,
    label: { textAlign: "center" },
    text: { variant: "bodyStrong", weight: "700" },
  },
  numbers: {
    container: tileRow,
    option: { flexBasis: "21%", flexGrow: 1, minHeight: 64, alignItems: "center", paddingVertical: 20 },
    idle,
    label: { textAlign: "center" },
    text: { variant: "h3", weight: "900" },
  },
  replies: {
    container: { alignItems: "flex-end", gap: 8 },
    // The speech bubble's tail sits top-right, as upstream's rounded-tr-sm.
    option: { maxWidth: "85%", paddingHorizontal: 16, paddingVertical: 12, borderTopRightRadius: 4 },
    idle: { borderColor: withAlpha(colors.cyan, 0.4), backgroundColor: withAlpha(colors.cyan, 0.1) },
    label: {},
    text: { variant: "body", weight: "500" },
  },
};

const styles = StyleSheet.create({
  wrap: {
    gap: 24,
  },
  center: {
    textAlign: "center",
  },
  option: {
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  correct: {
    borderColor: colors.limeGreen,
    backgroundColor: withAlpha(colors.limeGreen, 0.15),
  },
  wrong: {
    borderColor: colors.neonPink,
    backgroundColor: withAlpha(colors.neonPink, 0.15),
  },
  pressed: {
    borderColor: alpha.white40,
  },
  verdict: {
    gap: 4,
  },
});
