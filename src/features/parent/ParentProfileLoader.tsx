import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { loadParentProfile } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayText } from "~/components/ui";
import { SignOutButton } from "~/features/auth";
import { useLocalePreference, useParentLocale } from "~/lib/locale";
import { supabase } from "~/lib/supabase";

import { ParentProfileScreen } from "./ParentProfileScreen";

/** `/parent/profile`: the parent's account (`loadParentProfile`) in their language. */
export function ParentProfileLoader() {
  const { locale, detected, manual } = useParentLocale();
  const { choose } = useLocalePreference();
  // Under ["profile", …] so the rename card's refresh reaches it too.
  const profile = useQuery({ queryKey: ["profile", "parent"], queryFn: () => loadParentProfile(supabase) });

  if (profile.isPending) {
    return (
      <AppContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.limeGreen} />
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

  return <ParentProfileScreen {...profile.data} locale={locale} manualLocale={manual} detectedLocale={detected} onChooseLocale={choose} />;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  message: { width: "100%", gap: 16 },
  centerText: { textAlign: "center" },
});
