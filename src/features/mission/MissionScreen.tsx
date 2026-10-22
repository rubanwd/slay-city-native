import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  missionRewardFraction,
  taskRewardFraction,
  taskTypeInstructions,
  type MissionTaskType,
  type MissionTaskViewModel,
  type MissionViewModel,
} from "@slay/core";
import { submitMissionCompletion } from "@slay/data";
import { alpha, colors, withAlpha } from "@slay/tokens";

import { AppContainer, Section } from "~/components/layout";
import { ProgressBar, SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";
import { supabase } from "~/lib/supabase";

import { HowToPlayButton } from "./HowToPlayButton";
import { TaskRunner } from "./TaskRunner";

/** Task types that take over the whole panel and manage their own progress. */
const IMMERSIVE_TASK_TYPES: MissionTaskType[] = ["snake_game", "bubble_pop"];

/** The map's query key — refetched after a completion so the map shows it. */
const MAP_QUERY_KEY = "map";

export interface MissionScreenProps {
  mission: MissionViewModel;
  location?: { name: string; iconUrl: string | null } | null;
  tasks: MissionTaskViewModel[];
  /**
   * Review mode: play the mission as a student sees it but record nothing — no
   * completion, no XP or coins, no reward screen. For the teacher console (WP-5.7).
   */
  review?: boolean;
  /** Where exiting (and finishing a review) goes. Defaults to the student map. */
  exitHref?: Href;
  /** Review mode only: the next mission at this location, offered at the end. */
  nextMission?: { title: string; href: Href } | null;
}

function confirm(message: string, action: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(message, undefined, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: action, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Port of upstream's `MissionScreen.tsx`: runs a mission's tasks in order
 * through `TaskRunner`, then records the completion with `complete_mission()`
 * and moves on to the reward screen. The reward share comes from
 * `missionRewardFraction` in `@slay/core` — the same arithmetic as the web —
 * and the database grants the XP and coins; nothing here computes them.
 */
export function MissionScreen({
  mission,
  location,
  tasks,
  review = false,
  exitHref = "/map",
  nextMission = null,
}: MissionScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewFinished, setReviewFinished] = useState(false);

  // Running share of the reward the played tasks earned: a task that can end
  // early reports a fraction, every other one counts as 1.
  const rewardFractionRef = useRef(1);
  // Tasks skipped outright — `missionRewardFraction` owns the arithmetic.
  const skippedCountRef = useRef(0);

  const total = tasks.length;
  const currentTask = tasks[currentIndex];
  const isLastTask = currentIndex === total - 1;

  const submit = useMutation({
    mutationFn: (rewardFraction: number) => submitMissionCompletion(supabase, mission.id, rewardFraction),
    onSuccess: async (result) => {
      if (!result.ok) return;
      await queryClient.invalidateQueries({ queryKey: [MAP_QUERY_KEY] });
      // The reward screen shows exactly what `complete_mission` granted — a
      // replay grants nothing, and says so (WP-3.7 AC3–4).
      router.replace({
        pathname: "/mission/[missionId]/reward",
        params: {
          missionId: mission.id,
          xp: String(result.xpEarned),
          coins: String(result.coinsEarned),
          replay: result.alreadyCompleted ? "1" : "0",
        },
      });
    },
  });
  const error = submit.data && !submit.data.ok ? submit.data.error : submit.error?.message;

  const earnedFraction = () =>
    missionRewardFraction({ playedFraction: rewardFractionRef.current, skipped: skippedCountRef.current, total });

  const finishMission = (rewardFraction: number) => {
    if (review) {
      setReviewFinished(true);
      return;
    }
    submit.mutate(rewardFraction);
  };

  const advance = () => {
    if (isLastTask) {
      finishMission(earnedFraction());
    } else {
      setCurrentIndex((index) => index + 1);
    }
  };

  const handleTaskComplete = (rewardFraction?: number) => {
    rewardFractionRef.current *= taskRewardFraction(rewardFraction);
    advance();
  };

  /**
   * Moves past a task the player can't (or won't) finish, so one broken task
   * never walls off the rest of the mission. The mission still counts as
   * completed; the skipped task pays nothing.
   */
  const handleSkip = async () => {
    if (await confirm("Skip this task? You'll move on, but you won't earn anything for it.", "Skip")) {
      skippedCountRef.current += 1;
      advance();
    }
  };

  const handleExit = async () => {
    // A review records nothing, so there is nothing to warn about losing.
    if (review || (await confirm("Leave this mission? Your progress on this task will be lost.", "Leave"))) {
      router.replace(exitHref);
    }
  };

  const restart = () => {
    rewardFractionRef.current = 1;
    skippedCountRef.current = 0;
    setCurrentIndex(0);
    setReviewFinished(false);
  };

  if (total === 0 || reviewFinished) {
    return (
      <AppContainer style={styles.centered}>
        <Section py="sm" style={styles.endCard}>
          <SlayText variant="h2" weight="900" style={styles.center}>
            {mission.title}
          </SlayText>
          <SlayText variant="body" color={alpha.white60} style={styles.center}>
            {total === 0
              ? "This mission has no tasks yet."
              : "That's every task in this mission. Reviews aren't recorded — no progress, XP or coins were given."}
          </SlayText>
          {reviewFinished && nextMission ? (
            <SlayButton onPress={() => router.replace(nextMission.href)}>Next: {nextMission.title}</SlayButton>
          ) : null}
          {reviewFinished ? (
            <SlayButton variant="ghost" onPress={restart}>
              Play Again
            </SlayButton>
          ) : null}
          <SlayButton variant="ghost" onPress={() => router.replace(exitHref)}>
            {review ? "Back" : "Back to Map"}
          </SlayButton>
        </Section>
      </AppContainer>
    );
  }

  const actionLabel = isLastTask ? (review ? "Finish Review" : "Finish Mission") : "Next";
  const locationIcon = imageSource(location?.iconUrl);

  return (
    <AppContainer>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <SlayPressable
              accessibilityRole="button"
              accessibilityLabel="Exit mission"
              hitSlop={4}
              onPress={handleExit}
              style={styles.roundButton}
            >
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Path d="M2 2l12 12M14 2L2 14" stroke={alpha.white70} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </SlayPressable>
            {locationIcon ? <Image source={locationIcon} style={styles.locationIcon} accessible={false} /> : null}
            {location ? (
              <SlayText variant="label" color={alpha.white50} numberOfLines={1} style={styles.shrink}>
                {location.name}
              </SlayText>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <HowToPlayButton text={taskTypeInstructions(currentTask.taskType)} />
            <SlayText variant="small" weight="700" color={alpha.white50}>
              {currentIndex + 1}/{total}
            </SlayText>
          </View>
        </View>
        {review ? (
          // A teacher must never mistake a review for a real run (WP-5.7).
          <View style={styles.reviewBadge} accessibilityRole="text" accessibilityLabel="Review mode: nothing is saved">
            <SlayText variant="label" weight="700" color={colors.cyan}>
              Review · nothing is saved
            </SlayText>
          </View>
        ) : null}
        {!IMMERSIVE_TASK_TYPES.includes(currentTask.taskType) ? (
          <ProgressBar
            value={(currentIndex / Math.max(total, 1)) * 100}
            variant="pink"
            label="Progress"
            labelRight={`${currentIndex}/${total}`}
          />
        ) : null}
      </View>

      {/*
        The typing tasks (WP-3.5 AC1): on iOS the body shrinks by the keyboard's
        height so the field and its Check button stay above it; Android's
        default adjustResize window already does that, as on the auth screens.
      */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.body}>
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <TaskRunner
            key={currentTask.id}
            taskType={currentTask.taskType}
            content={currentTask.content}
            actionLabel={actionLabel}
            onComplete={handleTaskComplete}
            onSkip={handleSkip}
          />
        </ScrollView>

        {submit.isPending || error ? (
          <View style={styles.footer}>
            {submit.isPending ? (
              <SlayText variant="body" color={alpha.white60}>
                Saving your rewards…
              </SlayText>
            ) : (
              <>
                <SlayText variant="body" color={colors.neonPink} accessibilityRole="alert" style={styles.center}>
                  {error}
                </SlayText>
                <SlayButton variant="pink" onPress={() => finishMission(earnedFraction())}>
                  Try Again
                </SlayButton>
              </>
            )}
          </View>
        ) : (
          // Hidden once the run is over — there is no task left to skip.
          <View style={styles.footer}>
            <SlayPressable accessibilityRole="button" hitSlop={12} onPress={handleSkip}>
              <SlayText variant="small" color={alpha.white40} style={styles.underline}>
                Skip this task
              </SlayText>
            </SlayPressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  reviewBadge: {
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withAlpha(colors.cyan, 0.4),
    backgroundColor: withAlpha(colors.cyan, 0.1),
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  centered: {
    justifyContent: "center",
  },
  endCard: {
    gap: 16,
  },
  center: {
    textAlign: "center",
  },
  header: {
    paddingTop: 16,
    paddingBottom: 8,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roundButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: alpha.white15,
  },
  locationIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: withAlpha(colors.limeGreen, 0.6),
  },
  shrink: {
    flexShrink: 1,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingVertical: 8,
  },
  footer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  underline: {
    textDecorationLine: "underline",
  },
});
