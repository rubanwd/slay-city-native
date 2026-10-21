import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import type { QuizContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

import type { TaskProps } from "../taskContract";

/**
 * Port of upstream's `QuizTask.tsx` — the WP-3.2 reference task. A
 * multiple-choice question: picking an option reveals feedback (the correct
 * answer turns green, a wrong pick pink) before the student continues. It
 * reports completion and nothing else; the answer earns nothing extra.
 */
export function QuizTask({ content, onComplete, actionLabel }: TaskProps<QuizContent>) {
  const { question, imageUrl, options, correctIndex } = content;
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const isCorrect = selected === correctIndex;
  const image = imageSource(imageUrl);

  return (
    <View style={styles.wrap}>
      <SlayText variant="h2" weight="900" style={styles.center} accessibilityRole="header">
        {question}
      </SlayText>

      {image ? (
        <View style={styles.imageFrame}>
          <Image source={image} style={styles.image} resizeMode="cover" accessible={false} />
        </View>
      ) : null}

      <View style={styles.options} accessibilityRole="radiogroup">
        {options.map((option, index) => {
          const revealCorrect = answered && index === correctIndex;
          const revealWrong = answered && selected === index && index !== correctIndex;
          return (
            <SlayPressable
              // Options are plain strings and may repeat; their position is their identity.
              key={index}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === index, disabled: answered }}
              disabled={answered}
              onPress={() => setSelected(index)}
              style={({ pressed }) => [
                styles.option,
                revealCorrect ? styles.correct : revealWrong ? styles.wrong : styles.idle,
                pressed && !answered && styles.pressed,
              ]}
            >
              <SlayText
                variant="body"
                weight="500"
                color={revealCorrect ? colors.limeGreen : revealWrong ? colors.neonPink : colors.white}
              >
                {option}
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
          {isCorrect ? "You got this! 🎉" : "Not quite — the answer is highlighted."}
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
  center: {
    textAlign: "center",
  },
  imageFrame: {
    alignSelf: "center",
    width: 192,
    height: 192,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: alpha.white5,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  options: {
    gap: 12,
  },
  option: {
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  idle: {
    borderColor: alpha.white15,
    backgroundColor: alpha.white5,
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
});
