import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { loadRewardScreen } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

import { RewardScreen } from "./RewardScreen";

/**
 * What `complete_mission` returned, handed over by `MissionScreen` as route
 * params. Absent when the screen is reopened from a link, and then the
 * completion row's recorded amounts stand in, as on the web.
 */
export interface CompletionResult {
  xp: number;
  coins: number;
  alreadyCompleted: boolean;
}

/**
 * `/mission/[missionId]/reward`: loads the reward screen (`loadRewardScreen`)
 * and shows it. No completion for this mission means no reward to show, so
 * it goes back to the map, as the web's server page redirects.
 */
export function RewardLoader({ missionId, result }: { missionId: string; result: CompletionResult | null }) {
  const router = useRouter();
  const reward = useQuery({
    queryKey: ["reward", missionId],
    queryFn: () => loadRewardScreen(supabase, missionId),
  });

  if (reward.isPending) {
    return (
      <AppContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.limeGreen} accessibilityLabel="Loading your reward…" />
      </AppContainer>
    );
  }

  if (reward.data === "not-completed") {
    return <Redirect href="/map" />;
  }

  if (reward.isError || !reward.data) {
    return (
      <AppContainer style={styles.center}>
        <View style={styles.message}>
          <SlayText variant="body" color={alpha.white60} style={styles.centerText}>
            {reward.isError
              ? "Your rewards are saved, but this screen could not load. Check your connection and try again."
              : "This mission isn't available."}
          </SlayText>
          {reward.isError ? (
            <SlayButton loading={reward.isFetching} onPress={() => reward.refetch()}>
              Try again
            </SlayButton>
          ) : null}
          <SlayButton variant="ghost" onPress={() => router.replace("/map")}>
            Back to Map
          </SlayButton>
        </View>
      </AppContainer>
    );
  }

  const data = reward.data;
  return (
    <RewardScreen
      xp={result?.xp ?? data.recordedXp}
      coins={result?.coins ?? data.recordedCoins}
      alreadyCompleted={result?.alreadyCompleted ?? false}
      missionTitle={data.missionTitle}
      taskNames={data.taskNames}
      locationName={data.locationName}
      missionsCompletedAtLocation={data.missionsCompletedAtLocation}
      totalMissionsAtLocation={data.totalMissionsAtLocation}
      milestone={data.milestone}
      clearedLevelName={data.clearedLevelName}
      nextLevelName={data.nextLevelName}
      advancedToLevelName={data.advancedToLevelName}
      onContinue={() => router.replace({ pathname: "/map", params: data.continueTo })}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  message: { width: "100%", gap: 16 },
  centerText: { textAlign: "center" },
});
