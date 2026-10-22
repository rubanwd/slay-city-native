import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BackHandler, Image, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import {
  closestAvailableLevel,
  KNOWLEDGE_LEVEL_LABELS,
  percent,
  PLACEMENT_PASS_PERCENT,
  shuffledOptionOrder,
  type PlacementAnswers,
  type PlacementQuestion,
  type PlacementResult,
} from "@slay/core";
import type { KnowledgeLevel } from "@slay/core/types";
import { changeMyLevel, submitPlacementTest, type SubmitPlacementResult } from "@slay/data";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { ProgressBar, SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { useLookFloat } from "~/animations/useLookFloat";
import { MAP_QUERY_KEY } from "~/features/map";
import { PROFILE_QUERY_KEY } from "~/features/profile/queryKeys";
import { imageSource } from "~/lib/imageSource";
import { supabase } from "~/lib/supabase";

export interface PlacementTestProps {
  questions: PlacementQuestion[];
  /** The level the student is studying now. */
  currentLevel: KnowledgeLevel;
  /** Levels with content — what the result can switch them to. */
  availableLevels: readonly KnowledgeLevel[];
  mascotImageUrl: string;
  /** Grades the answers; `submitPlacementTest` unless a preview supplies its own. */
  submit?: (answers: PlacementAnswers) => Promise<SubmitPlacementResult>;
}

/**
 * How long the tapped answer stays lit before the next question comes in —
 * long enough to see what you picked, short enough not to drag across 40.
 */
const PICK_FEEDBACK_MS = 450;
/** "I don't know" just needs a press acknowledgement. */
const SKIP_FEEDBACK_MS = 200;

type Picked = { questionId: string; choice: number | null };

type Phase = { kind: "intro" } | { kind: "question"; index: number } | { kind: "result"; result: PlacementResult };

/** Renders a prompt with its "___" gap drawn as a highlighted blank. */
function Prompt({ text }: { text: string }) {
  const parts = text.split("___");
  return (
    <SlayText variant="h2" weight="900" style={styles.prompt} accessibilityRole="header">
      {parts.map((part, i) => (
        <SlayText key={i} variant="h2" weight="900">
          {part}
          {i < parts.length - 1 ? (
            <SlayText variant="h2" weight="900" color={colors.cyan} accessibilityLabel="blank">
              {" ____ "}
            </SlayText>
          ) : null}
        </SlayText>
      ))}
    </SlayText>
  );
}

function Mascot({ url, compact }: { url: string; compact?: boolean }) {
  const float = useLookFloat();
  const source = imageSource(url);
  if (!source) return null;
  const size = compact ? 72 : 112;
  return (
    <Animated.View style={float}>
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="Slay" />
    </Animated.View>
  );
}

function Shell({ mascotImageUrl, compact, children }: { mascotImageUrl: string; compact?: boolean; children: ReactNode }) {
  return (
    <AppContainer>
      <ScrollView contentContainerStyle={styles.shell}>
        <Mascot url={mascotImageUrl} compact={compact} />
        <View style={styles.shellBody}>{children}</View>
      </ScrollView>
    </AppContainer>
  );
}

/**
 * Port of upstream's `placement/PlacementTest.tsx`, as a signed-in student
 * sees it: an intro, one question per screen, and a result that recommends a
 * knowledge level and can switch the map to it. Questions arrive without the
 * answer key; grading is `submit_placement_test`'s.
 *
 * Option order is shuffled per attempt, so the right answer's stored position
 * tells nothing; answers are still sent as indices into the stored order.
 * Android's back button steps back a question, as the ← does.
 */
export function PlacementTest({ questions, currentLevel, availableLevels, mascotImageUrl, submit = (answers) => submitPlacementTest(supabase, answers) }: PlacementTestProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [answers, setAnswers] = useState<PlacementAnswers>({});
  const [attemptSeed, setAttemptSeed] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Never advance a test the screen no longer shows.
  useEffect(
    () => () => {
      if (pickTimer.current) clearTimeout(pickTimer.current);
    },
    [],
  );

  const total = questions.length;
  const optionOrders = useMemo(
    () => questions.map((q) => shuffledOptionOrder(q.options.length, `${attemptSeed}:${q.id}`)),
    [questions, attemptSeed],
  );

  const grade = useMutation({
    mutationFn: (finalAnswers: PlacementAnswers) => submit(finalAnswers),
    onSuccess: (response) => {
      if (!response.ok) return;
      setPhase({ kind: "result", result: response.result });
      // The profile card shows the latest result.
      void queryClient.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY] });
    },
  });

  const apply = useMutation({
    mutationFn: (level: KnowledgeLevel) => changeMyLevel(supabase, level),
    onSuccess: async (response) => {
      if (!response.ok) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [MAP_QUERY_KEY] }),
      ]);
      router.navigate("/map");
    },
  });

  const submitting = grade.isPending;
  const error =
    (grade.data && !grade.data.ok ? grade.data.error : grade.error?.message) ??
    (apply.data && !apply.data.ok ? apply.data.error : apply.error?.message);

  const start = () => {
    setAnswers({});
    grade.reset();
    apply.reset();
    setAttemptSeed(`${Date.now()}-${Math.random()}`);
    setPhase({ kind: "question", index: 0 });
  };

  const back = () => {
    if (phase.kind !== "question" || picked || submitting) return;
    setPhase(phase.index === 0 ? { kind: "intro" } : { kind: "question", index: phase.index - 1 });
  };

  useEffect(() => {
    if (phase.kind !== "question") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => subscription.remove();
  });

  const answer = (index: number, choice: number | null) => {
    const question = questions[index];
    const next = { ...answers };
    if (choice === null) delete next[question.id];
    else next[question.id] = choice;
    setAnswers(next);

    if (index + 1 >= total) grade.mutate(next);
    else setPhase({ kind: "question", index: index + 1 });
  };

  /** Lights up the tapped answer, then records it and moves on; taps are ignored meanwhile, so a double tap cannot skip a question. */
  const pick = (index: number, choice: number | null) => {
    if (picked || submitting) return;
    setPicked({ questionId: questions[index].id, choice });
    pickTimer.current = setTimeout(
      () => {
        pickTimer.current = null;
        setPicked(null);
        answer(index, choice);
      },
      choice === null ? SKIP_FEEDBACK_MS : PICK_FEEDBACK_MS,
    );
  };

  if (total === 0) {
    return (
      <Shell mascotImageUrl={mascotImageUrl}>
        <SlayText variant="h2" weight="900" style={styles.center} accessibilityRole="header">
          The level test is not ready yet
        </SlayText>
        <SlayText variant="body" color={alpha.white60} style={styles.center}>
          Please come back a bit later.
        </SlayText>
        <SlayButton variant="pink" size="lg" style={styles.wide} onPress={() => router.navigate("/profile")}>
          Back to profile
        </SlayButton>
      </Shell>
    );
  }

  if (phase.kind === "intro") {
    return (
      <Shell mascotImageUrl={mascotImageUrl}>
        <SlayText variant="h1" weight="900" style={styles.center} accessibilityRole="header">
          What&apos;s my English level?
        </SlayText>
        <View style={styles.rules}>
          {[
            `📝 ${total} questions — from Beginner to Upper Intermediate.`,
            "👆 Pick the word that fits the gap.",
            "🤷 Too hard? Tap “I don’t know”. That’s OK!",
            "🏁 You can finish at any time.",
          ].map((line) => (
            <SlayText key={line} variant="body" color={alpha.white80}>
              {line}
            </SlayText>
          ))}
        </View>
        <SlayButton variant="pink" size="lg" style={styles.wide} onPress={start}>
          Start the test
        </SlayButton>
        <SlayPressable accessibilityRole="link" hitSlop={8} onPress={() => router.navigate("/profile")}>
          <SlayText variant="small" weight="600" color={alpha.white50}>
            ← Back to profile
          </SlayText>
        </SlayPressable>
      </Shell>
    );
  }

  if (phase.kind === "question") {
    const { index } = phase;
    const question = questions[index];
    const order = optionOrders[index];
    const chosen = answers[question.id];
    const answeredCount = Object.keys(answers).length;
    const pickedHere = picked?.questionId === question.id ? picked : null;
    const busy = submitting || pickedHere !== null;

    return (
      <AppContainer>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <SlayPressable accessibilityRole="button" disabled={busy} hitSlop={8} onPress={back} style={busy && styles.dim}>
              <SlayText variant="small" weight="600" color={alpha.white50}>
                ← Back
              </SlayText>
            </SlayPressable>
            <View style={styles.levelChip}>
              <SlayText variant="label" weight="700" color={colors.cyan}>
                {KNOWLEDGE_LEVEL_LABELS[question.level]}
              </SlayText>
            </View>
            <SlayPressable
              accessibilityRole="button"
              disabled={busy}
              hitSlop={8}
              onPress={() => grade.mutate(answers)}
              style={busy && styles.dim}
            >
              {/* Upstream's one student-facing use of the admin orange: finishing early is the exception. */}
              <SlayText variant="small" weight="600" color={colors.neonOrange}>
                Finish now
              </SlayText>
            </SlayPressable>
          </View>
          <ProgressBar value={((index + 1) / total) * 100} variant="cyan" animate={false} labelRight={`${index + 1} / ${total}`} />
        </View>

        <ScrollView key={question.id} style={styles.fill} contentContainerStyle={styles.question}>
          <Prompt text={question.prompt} />

          <View accessibilityRole="radiogroup" accessibilityLabel="Answers" style={styles.options}>
            {order.map((optionIndex) => {
              const isPicked = pickedHere?.choice === optionIndex;
              const dimmed = pickedHere !== null && !isPicked;
              const selected = isPicked || (pickedHere === null && chosen === optionIndex);
              return (
                <SlayPressable
                  key={`${question.id}:${optionIndex}`}
                  accessibilityRole="radio"
                  aria-checked={selected}
                  disabled={submitting || dimmed}
                  haptic
                  onPress={() => pick(index, optionIndex)}
                  style={({ pressed }) => [
                    styles.option,
                    selected ? styles.optionSelected : styles.optionIdle,
                    pressed && !pickedHere && styles.optionPressed,
                    (dimmed || submitting) && styles.dimmer,
                  ]}
                >
                  <SlayText variant="h3" weight="700" color={selected ? colors.limeGreen : colors.white}>
                    {question.options[optionIndex]}
                  </SlayText>
                </SlayPressable>
              );
            })}
          </View>

          <SlayPressable
            accessibilityRole="button"
            disabled={submitting || (pickedHere !== null && pickedHere.choice !== null)}
            onPress={() => pick(index, null)}
            style={[
              styles.skip,
              pickedHere && pickedHere.choice === null ? styles.skipActive : styles.skipIdle,
              pickedHere && pickedHere.choice !== null && styles.dimmer,
            ]}
          >
            <SlayText variant="small" weight="600" color={pickedHere?.choice === null ? colors.white : alpha.white60}>
              I don&apos;t know
            </SlayText>
          </SlayPressable>
        </ScrollView>

        <View style={styles.footer} accessibilityLiveRegion="polite">
          <SlayText variant="small" color={alpha.white40}>
            {submitting ? "Checking your answers…" : `${answeredCount} answered`}
          </SlayText>
          {error ? (
            <SlayText variant="small" weight="600" color={colors.neonPink} accessibilityRole="alert">
              {error}
            </SlayText>
          ) : null}
        </View>
      </AppContainer>
    );
  }

  const { result } = phase;
  const startLevel = closestAvailableLevel(result.recommendedLevel, availableLevels);
  const alreadyThere = startLevel === currentLevel;

  const applyLevel = () => {
    if (!startLevel || alreadyThere) {
      router.navigate("/map");
      return;
    }
    apply.mutate(startLevel);
  };

  return (
    <Shell mascotImageUrl={mascotImageUrl} compact>
      <View style={styles.resultHead}>
        <SlayText variant="label" color={alpha.white50}>
          Your English level
        </SlayText>
        <SlayText variant="display" weight="900" color={colors.limeGreen} style={styles.center} accessibilityRole="header">
          {KNOWLEDGE_LEVEL_LABELS[result.recommendedLevel]}
        </SlayText>
        <SlayText variant="body" color={alpha.white70} style={styles.center}>
          {result.totalCorrect} of {result.totalQuestions} answers right ({percent(result.totalCorrect, result.totalQuestions)}%)
        </SlayText>
      </View>

      <View style={styles.scores}>
        {result.levelScores.map((score) => (
          <ProgressBar
            key={score.level}
            value={percent(score.correct, score.total)}
            variant={score.passed ? "green" : "pink"}
            height={8}
            label={`${score.passed ? "✓ " : ""}${KNOWLEDGE_LEVEL_LABELS[score.level]}`}
            labelRight={`${score.correct}/${score.total}`}
          />
        ))}
        <SlayText variant="label" color={alpha.white40} style={styles.plain}>
          A level counts as passed at {PLACEMENT_PASS_PERCENT}% or more.
        </SlayText>
      </View>

      {startLevel && startLevel !== result.recommendedLevel ? (
        <SlayText variant="small" color={alpha.white60} style={styles.center}>
          {KNOWLEDGE_LEVEL_LABELS[result.recommendedLevel]} has no districts yet — start with {KNOWLEDGE_LEVEL_LABELS[startLevel]}.
        </SlayText>
      ) : null}

      <SlayButton variant="pink" size="lg" style={styles.wide} loading={apply.isPending} onPress={applyLevel}>
        {!startLevel || alreadyThere ? "Go to the map" : `Play ${KNOWLEDGE_LEVEL_LABELS[startLevel]}`}
      </SlayButton>
      {error ? (
        <SlayText variant="small" weight="600" color={colors.neonPink} accessibilityRole="alert" style={styles.center}>
          {error}
        </SlayText>
      ) : null}
      <SlayPressable accessibilityRole="button" disabled={apply.isPending} hitSlop={8} onPress={start}>
        <SlayText variant="small" weight="600" color={alpha.white50}>
          Take the test again
        </SlayText>
      </SlayPressable>
    </Shell>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shell: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 24 },
  shellBody: { width: "100%", alignItems: "center", gap: 16 },
  center: { textAlign: "center" },
  wide: { alignSelf: "stretch" },
  rules: {
    alignSelf: "stretch",
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: alpha.white5,
    padding: 16,
  },
  header: { gap: 12, paddingTop: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  levelChip: { borderRadius: 999, backgroundColor: withAlpha(colors.purple, 0.3), paddingHorizontal: 12, paddingVertical: 4 },
  dim: { opacity: 0.4 },
  dimmer: { opacity: 0.4 },
  question: { flexGrow: 1, justifyContent: "center", gap: 24, paddingVertical: 16 },
  prompt: { textAlign: "center" },
  options: { gap: 12 },
  option: { borderRadius: radii.lg, borderWidth: 2, paddingHorizontal: 20, paddingVertical: 14 },
  optionIdle: { borderColor: alpha.white15, backgroundColor: alpha.white5 },
  optionSelected: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.15) },
  optionPressed: { transform: [{ scale: 0.97 }] },
  skip: { alignSelf: "center", borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  skipIdle: { borderColor: alpha.white20 },
  skipActive: { borderColor: alpha.white60, backgroundColor: alpha.white15 },
  footer: { alignItems: "center", gap: 8, paddingVertical: 12 },
  resultHead: { alignItems: "center", gap: 4 },
  scores: {
    alignSelf: "stretch",
    gap: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: alpha.white5,
    padding: 16,
  },
  plain: { textTransform: "none", letterSpacing: 0 },
});
