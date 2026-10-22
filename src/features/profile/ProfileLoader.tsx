import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { loadProfile } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayText } from "~/components/ui";
import { SignOutButton } from "~/features/auth";
import { supabase } from "~/lib/supabase";

import { ProfileScreen } from "./ProfileScreen";
import { PROFILE_QUERY_KEY } from "./queryKeys";

/**
 * `/profile`: loads the profile (`loadProfile`). If it can't, Log Out is still
 * offered — the profile is where a student goes to sign out, and that must
 * never depend on the network.
 */
export function ProfileLoader() {
  const profile = useQuery({ queryKey: [PROFILE_QUERY_KEY], queryFn: () => loadProfile(supabase) });

  if (profile.isPending) {
    return (
      <AppContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.limeGreen} accessibilityLabel="Loading profile…" />
      </AppContainer>
    );
  }

  if (profile.isError) {
    return (
      <AppContainer style={styles.center}>
        <View style={styles.message}>
          <SlayText variant="body" color={alpha.white60} style={styles.centerText}>
            Could not load your profile. Check your connection and try again.
          </SlayText>
          <SlayButton loading={profile.isFetching} onPress={() => profile.refetch()}>
            Try again
          </SlayButton>
          <SignOutButton />
        </View>
      </AppContainer>
    );
  }

  return <ProfileScreen {...profile.data} refreshing={profile.isRefetching} onRefresh={() => profile.refetch()} />;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  message: { width: "100%", gap: 16 },
  centerText: { textAlign: "center" },
});
