import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { loadPlacementScreen } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

import { PlacementTest } from "./PlacementTest";

/** `/placement-test`: loads the questions, levels and mascot (`loadPlacementScreen`), then the test. */
export function PlacementLoader() {
  const router = useRouter();
  // Fresh questions every visit: the set is what an admin last published.
  const screen = useQuery({ queryKey: ["placement"], queryFn: () => loadPlacementScreen(supabase), gcTime: 0 });

  if (screen.isPending) {
    return (
      <AppContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.limeGreen} accessibilityLabel="Loading the level test…" />
      </AppContainer>
    );
  }

  if (screen.isError) {
    return (
      <AppContainer style={styles.center}>
        <View style={styles.message}>
          <SlayText variant="body" color={alpha.white60} style={styles.centerText}>
            Could not load the level test. Check your connection and try again.
          </SlayText>
          <SlayButton loading={screen.isFetching} onPress={() => screen.refetch()}>
            Try again
          </SlayButton>
          <SlayButton variant="ghost" onPress={() => router.navigate("/profile")}>
            Back to profile
          </SlayButton>
        </View>
      </AppContainer>
    );
  }

  return <PlacementTest {...screen.data} />;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  message: { width: "100%", gap: 16 },
  centerText: { textAlign: "center" },
});
