import { useState } from "react";
import { Image, StyleSheet, View, type ViewStyle } from "react-native";

import type { TrueFalseContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

import type { TaskProps } from "../taskContract";
import { TaskPrompt } from "./TaskText";

/**
 * Port of upstream's `TrueFalseTask`. Its own two-button look — True green and
 * False pink before answering, the right one lit and the other faded after —
 * so it does not use the shared `ChoiceTask`.
 */
export function TrueFalseTask({ content, onComplete, actionLabel }: TaskProps<TrueFalseContent>) {
  const { statement, isTrue, imageUrl } = content;
  const [answer, setAnswer] = useState<boolean | null>(null);
  const answered = answer !== null;
  const isCorrect = answer === isTrue;
  const image = imageSource(imageUrl);

  const look = (value: boolean): { box: ViewStyle; text: string } => {
    if (!answered) {
      return value
        ? { box: { borderColor: withAlpha(colors.limeGreen, 0.4), backgroundColor: withAlpha(colors.limeGreen, 0.05) }, text: colors.limeGreen }
        : { box: { borderColor: withAlpha(colors.neonPink, 0.4), backgroundColor: withAlpha(colors.neonPink, 0.05) }, text: colors.neonPink };
    }
    if (value === isTrue) {
      return { box: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.15) }, text: colors.limeGreen };
    }
    if (answer === value) {
      return { box: { borderColor: colors.neonPink, backgroundColor: withAlpha(colors.neonPink, 0.15) }, text: colors.neonPink };
    }
    return { box: { borderColor: alpha.white10, backgroundColor: withAlpha(colors.white, 0.03) }, text: alpha.white40 };
  };

  return (
    <View style={styles.wrap}>
      {image ? (
        <View style={styles.frame}>
          <Image source={image} style={styles.image} resizeMode="cover" accessible={false} />
        </View>
      ) : null}
      <TaskPrompt>{statement}</TaskPrompt>

      <View style={styles.row} accessibilityRole="radiogroup">
        {[true, false].map((value) => {
          const { box, text } = look(value);
          return (
            <SlayPressable
              key={String(value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: answer === value, disabled: answered }}
              disabled={answered}
              onPress={() => setAnswer(value)}
              style={[styles.choice, box]}
            >
              <SlayText variant="h3" weight="900" color={text}>
                {value ? "True" : "False"}
              </SlayText>
            </SlayPressable>
          );
        })}
      </View>

      {answered ? (
        <SlayText
          variant="bodyStrong"
          weight="700"
          color={isCorrect ? colors.limeGreen : colors.neonPink}
          accessibilityLiveRegion="polite"
          style={styles.center}
        >
          {isCorrect ? "Correct! 🎉" : `Actually, that's ${isTrue ? "true" : "false"}.`}
        </SlayText>
      ) : null}

      <SlayButton variant="green" size="lg" disabled={!answered} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 24,
  },
  frame: {
    alignSelf: "center",
    width: 160,
    height: 160,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: alpha.white5,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  choice: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 72,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: 24,
  },
  center: {
    textAlign: "center",
  },
});
