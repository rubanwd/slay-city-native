import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import type { RewardMilestone } from "@slay/data";
import { alpha, artwork, colors, radii, withAlpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { CoinIcon, SlayButton, SlayText, XpIcon } from "~/components/ui";
import { playSfx } from "~/lib/sfx";

import { HERO_IMAGE } from "./assets";
import { RewardRain } from "./RewardRain";
import { useRewardPop, useRewardRise, useWiggle } from "./useRewardMotion";

export interface RewardScreenProps {
  /** Coins this completion granted — what `complete_mission` returned. */
  coins: number;
  /** XP this completion granted — what `complete_mission` returned. */
  xp: number;
  /**
   * The mission had been completed before, so `complete_mission` granted
   * nothing (WP-3.7 AC4): the screen says so instead of showing rewards.
   */
  alreadyCompleted?: boolean;
  missionTitle: string;
  /** Names of the mission's tasks, for the recap line. */
  taskNames: string[];
  onContinue: () => void;
  locationName?: string | null;
  /** How many of the location's missions are done now, including this one. */
  missionsCompletedAtLocation?: number;
  totalMissionsAtLocation?: number;
  milestone?: RewardMilestone | null;
  clearedLevelName?: string | null;
  nextLevelName?: string | null;
  advancedToLevelName?: string | null;
}

/** A festive headline word and the colour its glow and mascot frame share. */
interface GreetingTheme {
  word: string;
  color: string;
  frame: string;
}

const GREETING_THEMES: GreetingTheme[] = [
  { word: "Amazing!", color: colors.neonPink, frame: colors.purple },
  { word: "Awesome!", color: colors.limeGreen, frame: colors.cyan },
  { word: "Legendary!", color: colors.cyan, frame: colors.purple },
  { word: "Fantastic!", color: colors.neonOrange, frame: colors.neonPink },
  { word: "Incredible!", color: colors.purple, frame: colors.neonOrange },
  { word: "Iconic!", color: artwork.reward.gold, frame: colors.limeGreen },
  { word: "Unstoppable!", color: colors.limeGreen, frame: colors.neonPink },
  { word: "Slay!", color: colors.neonPink, frame: colors.cyan },
];

/**
 * The last theme shown, so back-to-back reward screens never look the same.
 * Upstream keeps it in localStorage; for a phone, the running app is enough.
 */
let lastThemeIndex = -1;

function pickGreetingTheme(): GreetingTheme {
  let index = Math.floor(Math.random() * GREETING_THEMES.length);
  while (GREETING_THEMES.length > 1 && index === lastThemeIndex) {
    index = Math.floor(Math.random() * GREETING_THEMES.length);
  }
  lastThemeIndex = index;
  return GREETING_THEMES[index];
}

/**
 * The one payoff moment of the loop: a round of applause and a success
 * haptic, once, as the screen lands — upstream plays `playRewardApplauseSfx`
 * on mount and never re-fires it.
 */
function useCelebration() {
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    playSfx("rewardApplause");
  }, []);
}

function Milestone({ title, children, style }: { title: string; children: string; style: object }) {
  return (
    <Animated.View style={[styles.milestone, style]} accessibilityLiveRegion="polite">
      <SlayText variant="bodyStrong" weight="900" color={colors.limeGreen} style={styles.upper}>
        {title}
      </SlayText>
      <SlayText variant="small" color={alpha.white70}>
        {children}
      </SlayText>
    </Animated.View>
  );
}

/**
 * Port of upstream's `RewardScreen.tsx`: the celebration after a mission —
 * a themed headline that pops and pulses, the mascot wiggling in its frame,
 * coin and XP cards, the mission recap, what this completion means for the
 * location, district or level, and Claim Reward back to the map.
 *
 * The amounts are whatever `complete_mission` returned (AC3); this screen
 * computes nothing. A replay — the database grants nothing a second time —
 * says so in place of the reward cards (AC4).
 */
export function RewardScreen({
  coins,
  xp,
  alreadyCompleted = false,
  missionTitle,
  taskNames,
  onContinue,
  locationName = null,
  missionsCompletedAtLocation = 0,
  totalMissionsAtLocation = 0,
  milestone = null,
  clearedLevelName = null,
  nextLevelName = null,
  advancedToLevelName = null,
}: RewardScreenProps) {
  const [theme] = useState(pickGreetingTheme);
  useCelebration();

  const headline = useRewardPop(0, 500, true);
  const mascot = useRewardPop(100, 600);
  const wiggle = useWiggle();
  const cards = useRewardRise(250);
  const recap = useRewardRise(350);
  const tasks = useRewardRise(450);
  const progress = useRewardRise(500);
  const action = useRewardRise(550);

  return (
    <AppContainer>
      <RewardRain />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={headline}>
          <SlayText
            variant="display"
            weight="900"
            color={theme.color}
            accessibilityRole="header"
            style={[styles.headline, { textShadowColor: withAlpha(theme.color, 0.9) }]}
          >
            {theme.word}
          </SlayText>
        </Animated.View>

        <Animated.View
          style={[
            styles.frame,
            { borderColor: withAlpha(theme.color, 0.35), backgroundColor: withAlpha(theme.frame, 0.2) },
            mascot,
          ]}
        >
          <Animated.View style={wiggle}>
            <Image source={HERO_IMAGE} style={styles.hero} resizeMode="contain" accessibilityLabel="Slay celebrating" />
          </Animated.View>
        </Animated.View>

        {alreadyCompleted ? (
          <Animated.View style={[styles.replay, cards]} accessibilityLiveRegion="polite">
            <SlayText variant="bodyStrong" weight="900" style={styles.upper}>
              Already completed
            </SlayText>
            <SlayText variant="small" color={alpha.white70} style={styles.center}>
              You earned this mission&apos;s coins and XP the first time. Replays are for practice — they don&apos;t pay out
              again.
            </SlayText>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.cards, cards]}>
            <View style={styles.card} accessible accessibilityLabel={`${coins} coins`}>
              <CoinIcon size={40} />
              <SlayText variant="h2" weight="900" color={artwork.coin.text}>
                +{coins}
              </SlayText>
              <SlayText variant="small" weight="700" color={alpha.white50} style={styles.upper}>
                Coins
              </SlayText>
            </View>
            <View style={styles.card} accessible accessibilityLabel={`${xp} XP`}>
              <XpIcon size={40} color={colors.cyan} />
              <SlayText variant="h2" weight="900" color={colors.cyan}>
                +{xp}
              </SlayText>
              <SlayText variant="small" weight="700" color={alpha.white50} style={styles.upper}>
                XP
              </SlayText>
            </View>
          </Animated.View>
        )}

        <Animated.View style={[styles.recap, recap]}>
          <SlayText variant="small" weight="700" color={alpha.white50} style={styles.upper}>
            Mission Complete
          </SlayText>
          <SlayText variant="h3" weight="900" style={styles.center}>
            {missionTitle}
          </SlayText>
        </Animated.View>

        {taskNames.length > 0 ? (
          <Animated.View style={tasks}>
            <SlayText variant="body" color={alpha.white60} style={styles.center}>
              {taskNames.join(" · ")}
            </SlayText>
          </Animated.View>
        ) : null}

        {milestone === "level" ? (
          <Milestone title={`🏆 ${clearedLevelName} cleared!`} style={progress}>
            {advancedToLevelName
              ? `You finished every district in ${clearedLevelName}. You're moving up to ${advancedToLevelName} — a whole new map is waiting.`
              : nextLevelName
                ? `You finished every district in ${clearedLevelName}. ${nextLevelName} is coming soon — until then you can replay this level from the map.`
                : `You finished every district in ${clearedLevelName} — that's the whole city!`}
          </Milestone>
        ) : milestone === "district" ? (
          <Milestone title="🏙️ District cleared!" style={progress}>
            Every location here is done. A new district just unlocked on the map.
          </Milestone>
        ) : milestone === "location" ? (
          <Milestone title={`✓ ${locationName} complete!`} style={progress}>
            You&apos;ve finished every mission here. Head back to the map to pick your next stop.
          </Milestone>
        ) : locationName && totalMissionsAtLocation > 0 ? (
          <Animated.View style={progress}>
            <SlayText variant="small" weight="700" color={alpha.white60} style={styles.center}>
              {missionsCompletedAtLocation}/{totalMissionsAtLocation} missions done at{" "}
              <SlayText variant="small" weight="700">
                {locationName}
              </SlayText>{" "}
              — keep going!
            </SlayText>
          </Animated.View>
        ) : null}

        <Animated.View style={[styles.action, action]}>
          <SlayButton variant="green" size="lg" onPress={onContinue}>
            {alreadyCompleted ? "Back to Map" : "Claim Reward"}
          </SlayButton>
        </Animated.View>
      </ScrollView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  // Above the rain, as upstream's `z-10` content sits over its `z-0` drops.
  scroll: { flex: 1, zIndex: 1 },
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 24, paddingVertical: 32 },
  center: { textAlign: "center" },
  upper: { textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" },
  headline: { textTransform: "uppercase", textAlign: "center", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 },
  frame: { borderRadius: radii.card, borderWidth: 2, padding: 12 },
  hero: { width: 200, height: 200 },
  cards: { flexDirection: "row", gap: 12, alignSelf: "stretch" },
  card: { flex: 1, alignItems: "center", gap: 6, borderRadius: radii.lg, backgroundColor: alpha.white5, paddingVertical: 20 },
  replay: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white15,
    backgroundColor: alpha.white5,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  recap: { alignItems: "center", gap: 4 },
  milestone: {
    alignSelf: "stretch",
    gap: 4,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.limeGreen,
    backgroundColor: withAlpha(colors.limeGreen, 0.1),
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  action: { alignSelf: "stretch" },
});
