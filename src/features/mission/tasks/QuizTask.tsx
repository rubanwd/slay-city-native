import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import type { QuizContent } from "@slay/core";
import { alpha, radii } from "@slay/tokens";

import { imageSource } from "~/lib/imageSource";

import type { TaskProps } from "../taskContract";
import { ChoiceTask } from "./ChoiceTask";
import { TaskPrompt } from "./TaskText";

/**
 * Port of upstream's `QuizTask.tsx` — the WP-3.2 reference task. A
 * multiple-choice question: picking an option reveals feedback (the correct
 * answer turns green, a wrong pick pink) before the student continues.
 */
export function QuizTask({ content, onComplete, actionLabel }: TaskProps<QuizContent>) {
  const { question, imageUrl, options, correctIndex } = content;
  const image = imageSource(imageUrl);

  return (
    <ChoiceTask
      layout="list"
      options={options}
      correctIndex={correctIndex}
      successText="You got this! 🎉"
      onComplete={onComplete}
      actionLabel={actionLabel}
      header={() => (
        <View style={styles.header}>
          <TaskPrompt>{question}</TaskPrompt>
          {image ? (
            <View style={styles.imageFrame}>
              <Image source={image} style={styles.image} contentFit="cover" accessible={false} />
            </View>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 24,
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
});
