import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import type { VocabularyContent } from "@slay/core";
import { alpha, colors, radii } from "@slay/tokens";

import { SlayButton, SlayCard, SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

import type { TaskProps } from "../taskContract";

/**
 * Port of upstream's `VocabularyTask`: a "learn this word" card — the word, its
 * translation, a picture and an example. No wrong answer; the student reads it
 * and moves on.
 */
export function VocabularyTask({ content, onComplete, actionLabel }: TaskProps<VocabularyContent>) {
  const { word, translation, imageUrl, exampleSentence } = content;
  const image = imageSource(imageUrl);

  return (
    <View style={styles.wrap}>
      <SlayCard variant="cyan" style={styles.card}>
        {image ? (
          <View style={styles.frame}>
            <Image source={image} style={styles.image} contentFit="cover" accessibilityLabel={word} />
          </View>
        ) : null}
        <View style={styles.words}>
          <SlayText variant="h2" weight="900" style={styles.center} accessibilityRole="header">
            {word}
          </SlayText>
          <SlayText variant="bodyStrong" weight="600" color={colors.cyan} style={styles.center}>
            {translation}
          </SlayText>
        </View>
        {exampleSentence ? (
          <SlayText variant="body" color={alpha.white70} style={[styles.center, styles.example]}>
            “{exampleSentence}”
          </SlayText>
        ) : null}
      </SlayCard>

      <SlayButton variant="green" size="lg" onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 24,
  },
  card: {
    alignItems: "center",
    gap: 16,
  },
  frame: {
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
  words: {
    gap: 4,
  },
  center: {
    textAlign: "center",
  },
  example: {
    fontStyle: "italic",
    maxWidth: 320,
  },
});
