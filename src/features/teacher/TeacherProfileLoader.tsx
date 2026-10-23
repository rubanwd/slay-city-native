import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { loadTeacherProfile } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayText } from "~/components/ui";
import { SignOutButton } from "~/features/auth";
import { ProfileScreen } from "~/features/profile";
import { supabase } from "~/lib/supabase";

/**
 * `/teacher/profile` — port of upstream's teacher profile page: the student's
 * profile screen minus what only a player has. The plain snake as the avatar,
 * a Teacher badge, the rename card, the level card (which picks the city the
 * teacher's map previews), Feedback & Bugs, and Log Out. English throughout,
 * as the teacher console is: no language picker, no level test.
 */
export function TeacherProfileLoader() {
  // Under ["profile", …] so the rename card's refresh reaches it too.
  const profile = useQuery({ queryKey: ["profile", "teacher"], queryFn: () => loadTeacherProfile(supabase) });

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

  return (
    <ProfileScreen
      {...profile.data}
      locale="en"
      roleLabel="Teacher"
      levelHint="Sets which level your city map shows."
      showLanguagePicker={false}
      refreshing={profile.isRefetching}
      onRefresh={() => profile.refetch()}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  message: { width: "100%", gap: 16 },
  centerText: { textAlign: "center" },
});
