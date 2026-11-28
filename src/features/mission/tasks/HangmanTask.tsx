import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import type { HangmanContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { useReducedMotion } from "~/hooks/useReducedMotion";
import { haptic } from "~/lib/haptics";

import type { TaskProps } from "../taskContract";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_WRONG = 6;

const guessable = (char: string) => /[A-Z]/.test(char);

type LastGuess = { letter: string; hits: number } | null;

/**
 * Port of upstream's `HangmanTask`: reveal the word by guessing letters; six
 * wrong guesses end the round and offer a retry.
 *
 * Laid out so the goal reads at a glance: the clue sits in its own card under
 * a "Guess the word" heading with the letter count, lives are a row of hearts
 * rather than a face, and every guess answers back — the word shakes and a
 * heart breaks on a miss, found letters pop into their tiles, and a line under
 * the word says what just happened.
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
  const [last, setLast] = useState<LastGuess>(null);

  const letters = word.split("");
  const requiredLetters = new Set(letters.filter(guessable));
  const won = [...requiredLetters].every((c) => guessed.has(c));
  const lost = wrong >= MAX_WRONG;
  const finished = won || lost;
  const lives = MAX_WRONG - wrong;
  const shake = useShake(wrong);
  const toFind = letters.filter(guessable).length;
  const found = letters.filter((c) => guessable(c) && guessed.has(c)).length;
  // Long words get narrower tiles so the word stays on one or two lines at 390pt.
  const compact = letters.length > 7;

  const guess = (letter: string) => {
    if (guessed.has(letter) || finished) return;
    const hits = letters.filter((c) => c === letter).length;
    setGuessed((prev) => new Set(prev).add(letter));
    setLast({ letter, hits });
    if (hits === 0) {
      setWrong((w) => w + 1);
      haptic("wrong");
    } else {
      haptic("correct");
    }
  };

  const reset = () => {
    setGuessed(new Set());
    setWrong(0);
    setLast(null);
  };

  // What a screen reader hears for the word: the letters found so far, blanks spoken as "blank".
  const spoken = letters
    .map((char) => (char.trim() === "" ? "," : !guessable(char) || guessed.has(char) || lost ? char : "blank"))
    .join(" ");

  return (
    <View style={styles.wrap}>
      <View style={styles.clueCard}>
        <SlayText variant="label" color={colors.cyan} style={styles.center} accessibilityRole="header">
          Guess the word
        </SlayText>
        {hint ? (
          <SlayText variant="h3" weight="700" style={styles.center}>
            💡 {hint}
          </SlayText>
        ) : null}
        <SlayText variant="small" color={alpha.white60} style={styles.center}>
          {toFind} {toFind === 1 ? "letter" : "letters"} · tap the letters below
        </SlayText>
      </View>

      <View style={styles.lives}>
        <View style={styles.hearts} accessible={false}>
          {Array.from({ length: MAX_WRONG }, (_, i) => (
            <Heart key={i} alive={i < lives} />
          ))}
        </View>
        <SlayText
          variant="small"
          weight="600"
          color={lives <= 2 && !won ? colors.neonPink : alpha.white60}
          accessibilityLiveRegion="polite"
        >
          {lives} {lives === 1 ? "life" : "lives"} left
        </SlayText>
      </View>

      <Animated.View style={[styles.word, shake]} accessible accessibilityLabel={`Word: ${spoken}`}>
        {letters.map((char, index) => {
          if (char.trim() === "") return <View key={index} style={styles.space} />;
          if (!guessable(char)) {
            return (
              <View key={index} style={[styles.tile, compact && styles.tileCompact, styles.tileFree]}>
                <SlayText variant="h3" weight="900">
                  {char}
                </SlayText>
              </View>
            );
          }
          const revealed = guessed.has(char) || lost;
          const missed = lost && !guessed.has(char);
          return (
            <Tile
              key={index}
              char={char}
              revealed={revealed}
              tone={won ? "won" : missed ? "missed" : revealed ? "found" : "empty"}
              delay={won ? index * 60 : 0}
              celebrate={won}
              compact={compact}
            />
          );
        })}
      </Animated.View>

      {!finished ? (
        <View style={styles.feedback}>
          <SlayText
            variant="bodyStrong"
            weight="700"
            color={!last ? alpha.white50 : last.hits > 0 ? colors.limeGreen : colors.neonPink}
            style={styles.center}
            accessibilityLiveRegion="polite"
          >
            {!last
              ? `Found ${found} of ${toFind}`
              : last.hits > 0
                ? `Yes! ${last.letter} is in the word${last.hits > 1 ? ` ×${last.hits}` : ""} · ${found}/${toFind}`
                : `No ${last.letter} — you lost a heart`}
          </SlayText>
        </View>
      ) : null}

      {finished ? (
        <View style={styles.result}>
          <SlayText
            variant="h3"
            weight="900"
            color={won ? colors.limeGreen : colors.neonPink}
            style={styles.center}
            accessibilityLiveRegion="polite"
          >
            {won ? "You saved the word! 🎉" : "Out of lives — the word is revealed."}
          </SlayText>
          {won && translation ? (
            <SlayText variant="bodyStrong" weight="600" color={colors.cyan} style={styles.center}>
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
                  variant="bodyStrong"
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

/** One letter of the word: an empty box until found, then the letter pops in. */
function Tile({
  char,
  revealed,
  tone,
  delay,
  celebrate,
  compact,
}: {
  char: string;
  revealed: boolean;
  tone: "empty" | "found" | "won" | "missed";
  delay: number;
  celebrate: boolean;
  compact: boolean;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const y = useSharedValue(0);
  const wasRevealed = useRef(revealed);

  useEffect(() => {
    if (reduced) return;
    if (revealed && !wasRevealed.current) {
      scale.value = withSequence(withTiming(0.6, { duration: 0 }), withSpring(1, { damping: 8, stiffness: 220 }));
    }
    wasRevealed.current = revealed;
  }, [revealed, reduced, scale]);

  useEffect(() => {
    if (reduced || !celebrate) return;
    const timer = setTimeout(() => {
      y.value = withSequence(withTiming(-12, { duration: 140 }), withSpring(0, { damping: 6, stiffness: 200 }));
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimation(y);
    };
  }, [celebrate, delay, reduced, y]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: scale.value }] }));
  const color = tone === "won" ? colors.limeGreen : tone === "missed" ? colors.neonPink : colors.white;

  return (
    <Animated.View style={[styles.tile, compact && styles.tileCompact, TILE_TONES[tone], animated]}>
      <SlayText variant="h3" weight="900" color={color}>
        {revealed ? char : " "}
      </SlayText>
    </Animated.View>
  );
}

/** A life: a solid pink heart, or a faint outline once it has been lost — it jolts as it goes. */
function Heart({ alive }: { alive: boolean }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const wasAlive = useRef(alive);

  useEffect(() => {
    if (!reduced && wasAlive.current && !alive) {
      scale.value = withSequence(withTiming(1.5, { duration: 120 }), withSpring(1, { damping: 6, stiffness: 180 }));
    }
    wasAlive.current = alive;
  }, [alive, reduced, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animated}>
      <Svg width={24} height={22} viewBox="0 0 24 22">
        <Path
          d="M12 21s-8.5-5.3-10.6-10.2C-0.3 6.6 2.4 1.5 6.9 1.5c2.3 0 4 1.3 5.1 3 1.1-1.7 2.8-3 5.1-3 4.5 0 7.2 5.1 5.5 9.3C20.5 15.7 12 21 12 21z"
          fill={alive ? colors.neonPink : "none"}
          stroke={alive ? colors.neonPink : alpha.white25}
          strokeWidth={1.5}
        />
      </Svg>
    </Animated.View>
  );
}

/** A quick left-right shake for the word, played each time the miss count goes up. */
function useShake(misses: number) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);

  useEffect(() => {
    if (reduced || misses === 0) return;
    x.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [misses, reduced, x]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  center: { textAlign: "center" },
  clueCard: {
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: withAlpha(colors.cyan, 0.5),
    backgroundColor: withAlpha(colors.cyan, 0.08),
  },
  lives: { alignItems: "center", gap: 6 },
  hearts: { flexDirection: "row", gap: 6 },
  word: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  space: { width: 16 },
  tile: {
    width: 40,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 2,
  },
  tileCompact: { width: 32, height: 44 },
  tileFree: { borderColor: "transparent" },
  feedback: { minHeight: 24, justifyContent: "center" },
  result: { gap: 12 },
  // Seven keys a row, as upstream's `grid-cols-7`: 12% each leaves room for six gaps, not eight keys.
  keyboard: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  key: {
    width: "12%",
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  keyIdle: { borderColor: alpha.white20, backgroundColor: alpha.white10 },
  keyRight: { borderColor: withAlpha(colors.limeGreen, 0.4), backgroundColor: withAlpha(colors.limeGreen, 0.1) },
  keyWrong: { borderColor: withAlpha(colors.neonPink, 0.4), backgroundColor: withAlpha(colors.neonPink, 0.1) },
});

const TILE_TONES = StyleSheet.create({
  empty: { borderColor: alpha.white25, backgroundColor: alpha.white5, borderStyle: "dashed" },
  found: { borderColor: alpha.white50, backgroundColor: alpha.white10 },
  won: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.12) },
  missed: { borderColor: colors.neonPink, backgroundColor: withAlpha(colors.neonPink, 0.12) },
});
