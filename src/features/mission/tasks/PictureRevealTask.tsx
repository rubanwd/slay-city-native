import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import type { PictureRevealContent } from "@slay/core";
import { alpha, colors, radii } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

import type { TaskProps } from "../taskContract";
import { ChoiceTask } from "./ChoiceTask";
import { TaskPrompt } from "./TaskText";

/** Upstream's CSS blur steps; `blurRadius` on a phone reads close to these. */
const BLUR_STAGES = [20, 12, 6];
const MAX_HINT_STAGE = BLUR_STAGES.length - 1;

/**
 * Port of upstream's `PictureRevealTask`: a blurred picture sharpens with each
 * "Reveal more". The student can guess at any point; answering shows it whole.
 */
export function PictureRevealTask({ content, onComplete, actionLabel }: TaskProps<PictureRevealContent>) {
  const { prompt, imageUrl, options, correctIndex } = content;
  const [stage, setStage] = useState(0);
  const image = imageSource(imageUrl);

  return (
    <ChoiceTask
      layout="list"
      options={options}
      correctIndex={correctIndex}
      successText="Sharp eyes! 🎉"
      onComplete={onComplete}
      actionLabel={actionLabel}
      header={(answered) => (
        <View style={styles.header}>
          <TaskPrompt>{prompt}</TaskPrompt>
          <View style={styles.frame}>
            {image ? (
              <Image
                source={image}
                blurRadius={answered ? 0 : BLUR_STAGES[stage]}
                style={styles.image}
                resizeMode="cover"
                accessible={false}
              />
            ) : null}
          </View>
          {!answered && stage < MAX_HINT_STAGE ? (
            <SlayPressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => setStage((s) => Math.min(MAX_HINT_STAGE, s + 1))}
              style={styles.reveal}
            >
              <SlayText variant="label" color={colors.cyan}>
                Reveal more
              </SlayText>
            </SlayPressable>
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
  frame: {
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
  reveal: {
    alignSelf: "center",
  },
});
