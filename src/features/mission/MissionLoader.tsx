import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { loadMission } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

import { MissionScreen } from "./MissionScreen";

/** `/mission/[missionId]`: loads the mission (`loadMission`) and runs it. */
export function MissionLoader({ missionId }: { missionId: string }) {
  const router = useRouter();
  const mission = useQuery({
    queryKey: ["mission", missionId],
    queryFn: () => loadMission(supabase, missionId),
    // A mission run keeps the content it started with; a refetch mid-run
    // could reorder the tasks under the player.
    staleTime: Infinity,
  });

  if (mission.isPending) {
    return (
      <AppContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.limeGreen} accessibilityLabel="Loading mission…" />
      </AppContainer>
    );
  }

  if (mission.isError || !mission.data) {
    return (
      <AppContainer style={styles.center}>
        <View style={styles.message}>
          <SlayText variant="body" color={alpha.white60} style={styles.centerText}>
            {mission.isError
              ? "Could not load this mission. Check your connection and try again."
              : "This mission isn't available."}
          </SlayText>
          {mission.isError ? (
            <SlayButton loading={mission.isFetching} onPress={() => mission.refetch()}>
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

  return <MissionScreen {...mission.data} />;
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    width: "100%",
    gap: 16,
  },
  centerText: {
    textAlign: "center",
  },
});
