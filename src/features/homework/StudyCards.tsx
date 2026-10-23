import { Image, StyleSheet, View } from "react-native";

import type { HomeworkGrammarPoint, HomeworkWord } from "@slay/core";
import { alpha, colors, radii } from "@slay/tokens";

import { SlayButton, SlayCard, SlayPressable, SlayText } from "~/components/ui";
import { useSpokenWord } from "~/features/mission";
import { imageSource } from "~/lib/imageSource";

interface CardProps {
  onNext: () => void;
  /** "Next", or "Start Test" / "Finish" on the last card. */
  actionLabel: string;
}

/**
 * Port of upstream's `WordCard.tsx`: the word's picture, the word, its
 * transcription and translation, and Listen. The web speaks it with the
 * browser's speech synthesis — words have no recorded audio — so the phone
 * uses its own, through the same `useSpokenWord` as the spelling bee. There is
 * no wrong answer: the student studies the card and moves on.
 */
export function WordCard({ word, onNext, actionLabel }: CardProps & { word: HomeworkWord }) {
  const speak = useSpokenWord(word.word, null);
  const picture = imageSource(word.imageUrl);

  return (
    <View style={styles.wrap}>
      <SlayCard variant="cyan">
        {/* SlayCard's style is its outer glow wrapper; the layout lives inside. */}
        <View style={styles.card}>
          {picture ? (
            <Image
              source={picture}
              style={styles.picture}
              resizeMode="cover"
              accessibilityLabel={word.word}
            />
          ) : null}
          <View style={styles.words}>
            <SlayText variant="h2" weight="900" style={styles.center}>
              {word.word}
            </SlayText>
            {word.transcription ? (
              <SlayText variant="h3" weight="600" color={alpha.white60} style={styles.center}>
                {word.transcription}
              </SlayText>
            ) : null}
            <SlayText variant="h3" weight="600" color={colors.cyan} style={styles.center}>
              {word.translation}
            </SlayText>
          </View>
          <SlayPressable
            accessibilityRole="button"
            accessibilityLabel={`Listen to ${word.word}`}
            haptic
            onPress={speak}
            style={({ pressed }) => [styles.listen, pressed && styles.listenPressed]}
          >
            <SlayText variant="h3" accessible={false}>
              🔊
            </SlayText>
            <SlayText variant="bodyStrong" weight="700">
              Listen
            </SlayText>
          </SlayPressable>
        </View>
      </SlayCard>
      <SlayButton variant="green" size="lg" onPress={onNext}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

/**
 * Port of upstream's `GrammarCard.tsx`: the rule's title, its explanation and
 * an example sentence. The student reads it and moves on.
 */
export function GrammarCard({
  point,
  onNext,
  actionLabel,
}: CardProps & { point: HomeworkGrammarPoint }) {
  return (
    <View style={styles.wrap}>
      <SlayCard variant="cyan">
        <View style={styles.rule}>
          <SlayText variant="h3" weight="900" accessibilityRole="header">
            {point.title}
          </SlayText>
          <SlayText variant="body" color={alpha.white80}>
            {point.explanation}
          </SlayText>
          {point.example ? (
            <View style={styles.example}>
              <SlayText variant="label" weight="700" color={alpha.white50}>
                Example
              </SlayText>
              <SlayText variant="h3" weight="600" color={colors.cyan}>
                {point.example}
              </SlayText>
            </View>
          ) : null}
        </View>
      </SlayCard>
      <SlayButton variant="green" size="lg" onPress={onNext}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  card: { alignItems: "center", gap: 16 },
  center: { textAlign: "center" },
  picture: { width: 160, height: 160, borderRadius: radii.lg, backgroundColor: alpha.white5 },
  words: { gap: 4 },
  listen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: alpha.white20,
    backgroundColor: alpha.white5,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  listenPressed: { backgroundColor: alpha.white10 },
  rule: { gap: 16 },
  example: {
    gap: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: alpha.white5,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
