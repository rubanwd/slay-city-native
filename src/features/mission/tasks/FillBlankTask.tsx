import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { normalizeAnswer, type FillBlankContent } from "@slay/core";
import { alpha, colors, radii, typeScale, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";
import { AnswerInput } from "./AnswerInput";

const BLANK_PATTERN = /_{2,}/;

/**
 * Port of upstream's `FillBlankTask`: a sentence with a gap. With two or more
 * authored options the student taps one; otherwise they type the word. The
 * check is case- and space-insensitive (`normalizeAnswer` from `@slay/core`).
 *
 * The typed field gets the same no-help keyboard as the spelling bee — a
 * suggestion strip would show the missing word — starts lowercase, since the
 * gap sits mid-sentence, and checks on the return key.
 */
export function FillBlankTask({ content, onComplete, actionLabel }: TaskProps<FillBlankContent>) {
  const { sentence, answer, options, translation } = content;
  const hasOptions = options.length >= 2;

  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);

  const isCorrect = hasOptions
    ? selected !== null && normalizeAnswer(options[selected]) === normalizeAnswer(answer)
    : normalizeAnswer(typed) === normalizeAnswer(answer);
  const canCheck = hasOptions ? selected !== null : typed.trim() !== "";

  const parts = sentence.split(BLANK_PATTERN);
  const before = parts[0] ?? "";
  const after = parts.slice(1).join(" ");
  const filledWord = checked && isCorrect ? answer : hasOptions && selected !== null ? options[selected] : typed;
  const blankColor = checked ? (isCorrect ? colors.limeGreen : colors.neonPink) : colors.cyan;

  const check = () => {
    if (canCheck) setChecked(true);
  };

  const retry = () => {
    setChecked(false);
    setSelected(null);
    setTyped("");
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <SlayText variant="h3" weight="700" style={styles.sentence}>
          {before}
          <SlayText
            variant="h3"
            weight="700"
            color={blankColor}
            style={[styles.blank, { textDecorationColor: blankColor }]}
          >
            {` ${filledWord || "…"} `}
          </SlayText>
          {after}
        </SlayText>
      </View>
      {translation ? (
        <SlayText variant="small" color={alpha.white50} style={styles.center}>
          {translation}
        </SlayText>
      ) : null}

      {hasOptions ? (
        <View style={styles.options} accessibilityRole="radiogroup">
          {options.map((option, index) => {
            const revealCorrect = checked && normalizeAnswer(option) === normalizeAnswer(answer);
            const revealWrong = checked && selected === index && !isCorrect;
            return (
              <SlayPressable
                // Options are plain strings and may repeat; their position is their identity.
                key={index}
                accessibilityRole="radio"
                accessibilityLabel={option}
                accessibilityState={{ checked: selected === index, disabled: checked }}
                disabled={checked}
                onPress={() => setSelected(index)}
                style={[
                  styles.option,
                  revealCorrect
                    ? styles.correct
                    : revealWrong
                      ? styles.wrong
                      : selected === index
                        ? styles.selected
                        : styles.idle,
                ]}
              >
                <SlayText
                  variant="bodyStrong"
                  weight="700"
                  color={revealCorrect ? colors.limeGreen : revealWrong ? colors.neonPink : colors.white}
                  style={styles.center}
                >
                  {option}
                </SlayText>
              </SlayPressable>
            );
          })}
        </View>
      ) : (
        <AnswerInput
          accessibilityLabel="The missing word"
          value={typed}
          onChangeText={(text) => !checked && setTyped(text)}
          placeholder="Type the missing word"
          editable={!checked}
          autoCapitalize="none"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={check}
          style={styles.typed}
        />
      )}

      {checked ? (
        <SlayText
          variant="bodyStrong"
          weight="700"
          color={isCorrect ? colors.limeGreen : colors.neonPink}
          style={styles.center}
          accessibilityLiveRegion="polite"
        >
          {isCorrect ? "Correct! 🎉" : `The answer is "${answer}".`}
        </SlayText>
      ) : null}

      {!checked ? (
        <SlayButton variant="pink" size="lg" disabled={!canCheck} onPress={check}>
          Check
        </SlayButton>
      ) : isCorrect ? (
        <SlayButton variant="green" size="lg" onPress={() => onComplete()}>
          {actionLabel}
        </SlayButton>
      ) : (
        <SlayButton variant="pink" size="lg" onPress={retry}>
          Try Again
        </SlayButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  center: { textAlign: "center" },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white15,
    backgroundColor: alpha.white5,
    padding: 20,
  },
  sentence: { textAlign: "center", lineHeight: 30 },
  blank: { textDecorationLine: "underline" },
  // Two options a row, as upstream's `grid-cols-2`.
  options: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 },
  option: {
    width: "47%",
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  idle: { borderColor: alpha.white15, backgroundColor: alpha.white5 },
  selected: { borderColor: colors.cyan, backgroundColor: withAlpha(colors.cyan, 0.1) },
  correct: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.15) },
  wrong: { borderColor: colors.neonPink, backgroundColor: withAlpha(colors.neonPink, 0.15) },
  // Upstream's typed field is body-size, not the spelling bee's big h3.
  typed: { fontSize: typeScale.body.max },
});
