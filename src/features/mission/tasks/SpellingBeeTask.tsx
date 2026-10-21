import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { normalizeAnswer, type SpellingBeeContent } from "@slay/core";
import { alpha, colors, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";
import { useSpokenWord } from "../useSpokenWord";
import { AnswerInput } from "./AnswerInput";

/**
 * Port of upstream's `SpellingBeeTask`: hear the word — the authored clip, or
 * the device's speech synthesis — and type its spelling. The check is case-
 * and space-insensitive (`normalizeAnswer` from `@slay/core`).
 *
 * The keyboard offers no corrections or suggestions and starts lowercase
 * (WP-3.5 AC2–3); the return key checks the answer (AC4).
 */
export function SpellingBeeTask({ content, onComplete, actionLabel }: TaskProps<SpellingBeeContent>) {
  const { word, audioUrl, translation, prompt } = content;
  const play = useSpokenWord(word, audioUrl);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);

  const isCorrect = normalizeAnswer(typed) === normalizeAnswer(word);
  const canCheck = typed.trim() !== "";

  const check = () => {
    if (canCheck) setChecked(true);
  };

  const retry = () => {
    setChecked(false);
    setTyped("");
  };

  return (
    <View style={styles.wrap}>
      <SlayText variant="h3" weight="600" style={styles.center}>
        {prompt}
      </SlayText>

      <View style={styles.speaker}>
        <SlayPressable
          accessibilityRole="button"
          accessibilityLabel="Play the word"
          haptic
          onPress={play}
          style={({ pressed }) => [styles.speakerButton, pressed && styles.pressed]}
        >
          <SlayText variant="display" accessible={false}>
            🔊
          </SlayText>
        </SlayPressable>
        <SlayText variant="small" color={alpha.white50} style={styles.center}>
          Tap to hear it again
        </SlayText>
      </View>

      <AnswerInput
        accessibilityLabel="Your spelling"
        value={typed}
        onChangeText={(text) => !checked && setTyped(text)}
        placeholder="Type what you hear"
        editable={!(checked && isCorrect)}
        autoCapitalize="none"
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={check}
        state={checked ? (isCorrect ? "right" : "wrong") : "idle"}
      />

      {checked ? (
        <SlayText
          variant="bodyStrong"
          weight="700"
          color={isCorrect ? colors.limeGreen : colors.neonPink}
          style={styles.center}
          accessibilityLiveRegion="polite"
        >
          {isCorrect
            ? translation
              ? `Correct — ${translation}! 🎉`
              : "Correct! 🎉"
            : `Not quite — it's spelled "${word}".`}
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
  speaker: { alignItems: "center", gap: 8 },
  speakerButton: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.cyan,
    backgroundColor: withAlpha(colors.cyan, 0.1),
  },
  pressed: { transform: [{ scale: 0.95 }] },
});
