import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";

import { loadMapScreen, resetLocationProgress, restartMyLevel } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayText } from "~/components/ui";
import { useSession } from "~/hooks/useSession";
import { supabase } from "~/lib/supabase";

import { CityMap, type MapArrival } from "./CityMap";

export const MAP_QUERY_KEY = "map";

type ResetResult = { ok: true } | { ok: false; error: string };

function confirm(title: string, message: string, action: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: action, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

/**
 * The student map with its data: `loadMapScreen` from `@slay/data` (the web
 * page's queries), restart and replay through their RPC wrappers. Both resets
 * ask first, with the web's wording, and refetch the map afterwards — the
 * mobile `revalidatePath`.
 */
export function MapScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const params = useLocalSearchParams<{ focus?: string; milestone?: MapArrival["milestone"]; name?: string }>();

  const map = useQuery({
    queryKey: [MAP_QUERY_KEY, session?.user.id],
    queryFn: () => loadMapScreen(supabase),
    enabled: Boolean(session),
  });

  const reset = useMutation({
    mutationFn: (run: () => Promise<ResetResult>) => run(),
    onSuccess: (result) => {
      if (!result.ok) Alert.alert("Something went wrong", result.error);
      return queryClient.invalidateQueries({ queryKey: [MAP_QUERY_KEY] });
    },
    onError: (error) => Alert.alert("Something went wrong", error.message),
  });

  if (map.isPending) {
    return (
      <AppContainer edges={["top"]} style={styles.center}>
        <ActivityIndicator size="large" color={colors.limeGreen} accessibilityLabel="Loading map…" />
      </AppContainer>
    );
  }

  if (map.isError) {
    return (
      <AppContainer edges={["top"]} style={styles.center}>
        <View style={styles.error}>
          <SlayText variant="body" color={alpha.white60} style={styles.centerText}>
            Could not load the map. Check your connection and try again.
          </SlayText>
          <SlayButton loading={map.isFetching} onPress={() => map.refetch()}>
            Try again
          </SlayButton>
        </View>
      </AppContainer>
    );
  }

  return (
    <AppContainer edges={["top"]} flush>
      <CityMap
        {...map.data}
        arrival={params}
        restarting={reset.isPending}
        onStartMission={(missionId) => router.push({ pathname: "/mission/[missionId]", params: { missionId } })}
        onRestartLocation={async (locationId, name) => {
          if (await confirm(`Restart ${name}?`, "You'll replay every mission here from the start.", "Restart")) {
            reset.mutate(() => resetLocationProgress(supabase, locationId));
          }
        }}
        onReplayLevel={async (levelName) => {
          if (
            await confirm(
              `Replay ${levelName}?`,
              "Every mission in this level starts over — your XP and coins stay.",
              "Replay",
            )
          ) {
            reset.mutate(() => restartMyLevel(supabase));
          }
        }}
      />
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    width: "100%",
    gap: 16,
  },
  centerText: {
    textAlign: "center",
  },
});
