import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { HangmanContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";

import type { TaskProps } from "../taskContract";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_WRONG = 6;
/** The gallows fills in one emoji at a time as wrong guesses stack up. */
const STAGES = ["😀", "😯", "😟", "😧", "😨", "😰", "💀"];

const guessable = (char: string) => /[A-Z]/.test(char);

/**
 * Port of upstream's `HangmanTask`: reveal the word by guessing letters; six
 * wrong guesses end the round and offer a retry.
 *
 * Only A–Z can be guessed from the keyboard, so everything else in the answer —
 * spaces, punctuation, digits, accented or non-Latin letters — is shown for
 * free: a character the student cannot type must never sit in the word as a
 * blank they have no way to fill.
 */
export function HangmanTask({ content, onComplete, actionLabel }: TaskProps<HangmanContent>) {
  const { word, hint, translation } = content;
  const [guessed, setGuessed] = useState<Set<string>>(() => new Set());
  const [wrong, setWrong] = useState(0);

  const letters = word.split("");
  const requiredLetters = new Set(letters.filter(guessable));
  const won = [...requiredLetters].every((c) => guessed.has(c));
  const lost = wrong >= MAX_WRONG;
  const finished = won || lost;
  const lives = MAX_WRONG - wrong;

  const guess = (letter: string) => {
    if (guessed.has(letter) || finished) return;
    setGuessed((prev) => new Set(prev).add(letter));
    if (!requiredLetters.has(letter)) setWrong((w) => w + 1);
  };

  const reset = () => {
    setGuessed(new Set());
    setWrong(0);
  };

  // What a screen reader hears for the word: the letters found so far, blanks spoken as "blank".
  const spoken = letters
    .map((char) => (char.trim() === "" ? "," : !guessable(char) || guessed.has(char) || lost ? char : "blank"))
    .join(" ");

  return (
    <View style={styles.wrap}>
      <View style={styles.status}>
        <SlayText variant="display" style={styles.center} accessible={false}>
          {STAGES[Math.min(wrong, STAGES.length - 1)]}
        </SlayText>
        <SlayText variant="small" color={alpha.white50} style={styles.center} accessibilityLiveRegion="polite">
          {lives} {lives === 1 ? "life" : "lives"} left
        </SlayText>
        {hint ? (
          <SlayText variant="small" color={alpha.white60} style={styles.center}>
            Hint: {hint}
          </SlayText>
        ) : null}
      </View>

      <View style={styles.word} accessible accessibilityLabel={`Word: ${spoken}`}>
        {letters.map((char, index) => {
          if (char.trim() === "") return <View key={index} style={styles.space} />;
          if (!guessable(char)) {
            return (
              <View key={index} style={[styles.slot, styles.slotIdle]}>
                <SlayText variant="h3" weight="900">
                  {char}
                </SlayText>
              </View>
            );
          }
          const revealed = guessed.has(char) || lost;
          const missed = lost && !guessed.has(char);
          return (
            <View key={index} style={[styles.slot, won ? styles.slotWon : missed ? styles.slotMissed : styles.slotIdle]}>
              <SlayText variant="h3" weight="900" color={won ? colors.limeGreen : missed ? colors.neonPink : colors.white}>
                {revealed ? char : " "}
              </SlayText>
            </View>
          );
        })}
      </View>

      {finished ? (
        <View style={styles.result}>
          <SlayText
            variant="bodyStrong"
            weight="700"
            color={won ? colors.limeGreen : colors.neonPink}
            style={styles.center}
            accessibilityLiveRegion="polite"
          >
            {won ? "You saved the word! 🎉" : "Out of lives — the word is revealed."}
          </SlayText>
          {won && translation ? (
            <SlayText variant="small" color={alpha.white60} style={styles.center}>
              {translation}
            </SlayText>
          ) : null}
          {won ? (
            <SlayButton variant="green" size="lg" onPress={() => onComplete()}>
              {actionLabel}
            </SlayButton>
          ) : (
            <SlayButton variant="pink" size="lg" onPress={reset}>
              Try Again
            </SlayButton>
          )}
        </View>
      ) : (
        <View style={styles.keyboard}>
          {ALPHABET.map((letter) => {
            const used = guessed.has(letter);
            const isWrong = used && !requiredLetters.has(letter);
            return (
              <SlayPressable
                key={letter}
                accessibilityRole="button"
                accessibilityLabel={letter}
                accessibilityState={{ disabled: used }}
                disabled={used}
                onPress={() => guess(letter)}
                style={[styles.key, used ? (isWrong ? styles.keyWrong : styles.keyRight) : styles.keyIdle]}
              >
                <SlayText
                  variant="small"
                  weight="700"
                  color={used ? (isWrong ? withAlpha(colors.neonPink, 0.5) : colors.limeGreen) : colors.white}
                >
                  {letter}
                </SlayText>
              </SlayPressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  center: { textAlign: "center" },
  status: { alignItems: "center", gap: 4 },
  word: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "center", gap: 6 },
  space: { width: 12 },
  slot: { width: 32, height: 44, alignItems: "center", justifyContent: "flex-end", borderBottomWidth: 2, paddingBottom: 4 },
  slotIdle: { borderColor: alpha.white40 },
  slotWon: { borderColor: colors.limeGreen },
  slotMissed: { borderColor: colors.neonPink },
  result: { gap: 12 },
  // Seven keys a row, as upstream's `grid-cols-7`: 12% each leaves room for six gaps, not eight keys.
  keyboard: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  key: {
    width: "12%",
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  keyIdle: { borderColor: alpha.white20, backgroundColor: alpha.white10 },
  keyRight: { borderColor: withAlpha(colors.limeGreen, 0.4), backgroundColor: withAlpha(colors.limeGreen, 0.1) },
  keyWrong: { borderColor: withAlpha(colors.neonPink, 0.4), backgroundColor: withAlpha(colors.neonPink, 0.1) },
});
