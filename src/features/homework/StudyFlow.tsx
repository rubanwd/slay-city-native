import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { BackHandler, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { taskTypeInstructions, type MissionTaskType, type MissionTaskViewModel } from "@slay/core";
import { completeHomeworkGrammar, completeHomeworkVocab } from "@slay/data";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { ProgressBar, SlayButton, SlayPressable, SlayText, XpAmount } from "~/components/ui";
import { HowToPlayButton, TaskRunner } from "~/features/mission";
import { supabase } from "~/lib/supabase";

import { HOMEWORK_QUERY_KEY } from "./queryKeys";

/** Task types that take over the whole panel and manage their own progress. */
const IMMERSIVE_TASK_TYPES: MissionTaskType[] = ["snake_game", "bubble_pop"];

export type StudyKind = "vocab" | "grammar";

/** Upstream's two flows differ only in these words and the RPC they record a pass with. */
const KINDS = {
  vocab: {
    title: "Learn the Words",
    unit: "word",
    passed: "You've passed these words.",
    card: "Word",
    test: "Word Test",
    doneTitle: "Words passed!",
    doneText: "You learned every word and finished the test. Your teacher can see it too.",
    complete: completeHomeworkVocab,
  },
  grammar: {
    title: "Learn the Grammar",
    unit: "rule",
    passed: "You've passed this grammar.",
    card: "Rule",
    test: "Grammar Test",
    doneTitle: "Grammar passed!",
    doneText: "You studied every rule and finished the test. Your teacher can see it too.",
    complete: completeHomeworkGrammar,
  },
} as const;

export interface StudyFlowProps<Card extends { id: string }> {
  kind: StudyKind;
  topicId: string;
  topicTitle: string;
  cards: Card[];
  /** The test tasks that check the cards. */
  tasks: MissionTaskViewModel[];
  /** Whether the student has already passed this module. */
  alreadyPassed: boolean;
  /** Back to the topic's intro screen. */
  onExit: () => void;
  /** One card, with the button that moves on. */
  renderCard: (card: Card, onNext: () => void, actionLabel: string) => ReactNode;
}

type FlowMode = "intro" | "cards" | "test" | "done";

function ExitButton({ onPress }: { onPress: () => void }) {
  return (
    <SlayPressable accessibilityRole="button" accessibilityLabel="Exit" hitSlop={4} onPress={onPress} style={styles.exit}>
      <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
        <Path d="M2 2l12 12M14 2L2 14" stroke={alpha.white70} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </SlayPressable>
  );
}

/**
 * Port of upstream's `VocabularyFlow.tsx` and `GrammarFlow.tsx`, which are
 * the same flow twice: step through every card, then take the test built from
 * them. Finishing records a pass (`complete_homework_vocab` /
 * `complete_homework_grammar`) the teacher can see too, and the database grants
 * XP for a first pass — coins stay with missions.
 *
 * The test plays the mission tasks through the same `TaskRunner`. Android's
 * back button leaves the flow for the topic, as the × does.
 */
export function StudyFlow<Card extends { id: string }>({
  kind,
  topicId,
  topicTitle,
  cards,
  tasks,
  alreadyPassed,
  onExit,
  renderCard,
}: StudyFlowProps<Card>) {
  const words = KINDS[kind];
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<FlowMode>("intro");
  const [cardIndex, setCardIndex] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);

  const save = useMutation({
    mutationFn: () => words.complete(supabase, topicId),
    onSuccess: (result) => {
      if (!result.ok) return;
      // The list's "passed" counts and this topic's badge both changed.
      void queryClient.invalidateQueries({ queryKey: [HOMEWORK_QUERY_KEY] });
    },
  });
  const passed = alreadyPassed || (save.data?.ok ?? false);
  const xpEarned = save.data?.ok ? save.data.xpEarned : 0;
  const error = save.data && !save.data.ok ? save.data.error : save.error?.message;

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onExit();
      return true;
    });
    return () => subscription.remove();
  }, [onExit]);

  const totalCards = cards.length;
  const totalTasks = tasks.length;
  const currentCard = cards[cardIndex];
  const currentTask = tasks[taskIndex];

  const finish = () => {
    save.mutate();
    setMode("done");
  };

  const start = () => {
    save.reset();
    setCardIndex(0);
    setTaskIndex(0);
    setMode("cards");
  };

  const nextCard = () => {
    if (cardIndex < totalCards - 1) {
      setCardIndex((i) => i + 1);
    } else if (totalTasks > 0) {
      setMode("test");
    } else {
      finish();
    }
  };

  const nextTask = () => {
    if (taskIndex < totalTasks - 1) {
      setTaskIndex((i) => i + 1);
    } else {
      finish();
    }
  };

  if (mode === "intro") {
    return (
      <AppContainer>
        <ScrollView contentContainerStyle={styles.page}>
          <SlayPressable accessibilityRole="button" onPress={onExit} hitSlop={8} style={styles.back}>
            <SlayText variant="small" color={alpha.white50}>
              ← {topicTitle}
            </SlayText>
          </SlayPressable>
          <SlayText variant="h2" weight="900" accessibilityRole="header">
            {words.title}
          </SlayText>
          <SlayText variant="small" color={alpha.white60}>
            {totalCards} {words.unit}
            {totalCards === 1 ? "" : "s"} to study, then a {totalTasks}-task test.
          </SlayText>
          {passed ? (
            <View style={styles.passed}>
              <SlayText variant="h3" color={colors.limeGreen} accessible={false}>
                ✓
              </SlayText>
              <SlayText variant="small" weight="700" color={colors.limeGreen}>
                {words.passed}
              </SlayText>
            </View>
          ) : null}
          <SlayButton variant="green" size="lg" onPress={start}>
            {passed ? "Study Again" : "Start"}
          </SlayButton>
        </ScrollView>
      </AppContainer>
    );
  }

  if (mode === "cards" && currentCard) {
    const isLast = cardIndex === totalCards - 1;
    return (
      <AppContainer>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <ExitButton onPress={onExit} />
            <SlayText variant="label" weight="700" color={alpha.white50} numberOfLines={1} style={styles.shrink}>
              {words.card} {cardIndex + 1} of {totalCards}
            </SlayText>
            <SlayText variant="small" weight="700" color={alpha.white50}>
              {cardIndex + 1}/{totalCards}
            </SlayText>
          </View>
          <ProgressBar value={(cardIndex / totalCards) * 100} variant="pink" />
        </View>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View key={currentCard.id}>
            {renderCard(currentCard, nextCard, isLast ? (totalTasks > 0 ? "Start Test" : "Finish") : "Next")}
          </View>
        </ScrollView>
      </AppContainer>
    );
  }

  if (mode === "test" && currentTask) {
    const isLast = taskIndex === totalTasks - 1;
    return (
      <AppContainer>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <ExitButton onPress={onExit} />
            <SlayText variant="label" weight="700" color={alpha.white50} numberOfLines={1} style={styles.shrink}>
              {words.test}
            </SlayText>
            <View style={styles.headerRight}>
              <HowToPlayButton text={taskTypeInstructions(currentTask.taskType)} />
              <SlayText variant="small" weight="700" color={alpha.white50}>
                {taskIndex + 1}/{totalTasks}
              </SlayText>
            </View>
          </View>
          {!IMMERSIVE_TASK_TYPES.includes(currentTask.taskType) ? (
            <ProgressBar value={(taskIndex / totalTasks) * 100} variant="pink" />
          ) : null}
        </View>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          <TaskRunner
            key={currentTask.id}
            taskType={currentTask.taskType}
            content={currentTask.content}
            actionLabel={isLast ? "Finish" : "Next"}
            onComplete={nextTask}
          />
        </ScrollView>
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <ScrollView contentContainerStyle={[styles.page, styles.done]}>
        <View style={styles.party}>
          <SlayText variant="h1" accessible={false}>
            🎉
          </SlayText>
        </View>
        <SlayText variant="h2" weight="900" accessibilityRole="header" style={styles.center}>
          {words.doneTitle}
        </SlayText>
        <SlayText variant="body" color={alpha.white60} style={styles.center} accessibilityLiveRegion="polite">
          {save.isPending ? "Saving your progress…" : words.doneText}
        </SlayText>
        {!save.isPending && xpEarned > 0 ? (
          <XpAmount value={`+${xpEarned} XP`} label={`Earned ${xpEarned} XP`} variant="h3" style={styles.xp} />
        ) : null}
        {error ? (
          <SlayText variant="body" color={colors.neonPink} accessibilityRole="alert" style={styles.center}>
            {error}
          </SlayText>
        ) : null}
        {error ? (
          <SlayButton variant="pink" onPress={() => save.mutate()}>
            Try Again
          </SlayButton>
        ) : null}
        <View style={styles.actions}>
          <SlayButton variant="green" style={styles.grow} onPress={start}>
            Study Again
          </SlayButton>
          <SlayButton variant="ghost" style={styles.grow} onPress={onExit}>
            Back to Topic
          </SlayButton>
        </View>
      </ScrollView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16, paddingTop: 32, paddingBottom: 24 },
  back: { alignSelf: "flex-start" },
  passed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.limeGreen, 0.3),
    backgroundColor: withAlpha(colors.limeGreen, 0.1),
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: { gap: 16, paddingTop: 16, paddingBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  shrink: { flexShrink: 1 },
  exit: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: alpha.white15,
  },
  body: { flex: 1 },
  bodyContent: { paddingVertical: 8 },
  done: { alignItems: "center" },
  party: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: withAlpha(colors.limeGreen, 0.15),
  },
  center: { textAlign: "center" },
  xp: { borderRadius: 999, backgroundColor: withAlpha(colors.cyan, 0.1), paddingHorizontal: 16, paddingVertical: 6 },
  actions: { flexDirection: "row", gap: 8, alignSelf: "stretch" },
  grow: { flex: 1 },
});
