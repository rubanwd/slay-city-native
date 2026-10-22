import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { getMessages } from "@slay/core";
import { loadParentDashboard } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayText } from "~/components/ui";
import { SignOutButton } from "~/features/auth";
import { useParentLocale } from "~/lib/locale";
import { supabase } from "~/lib/supabase";

import { ParentDashboard } from "./ParentDashboard";

export const PARENT_DASHBOARD_QUERY_KEY = "parent-dashboard";

/**
 * `/parent`: links the student if it can (`loadParentDashboard`) and shows
 * their progress, in the parent's language. Refetches when the app returns to
 * the foreground, so the numbers are current whenever the parent looks.
 */
export function ParentDashboardLoader() {
  const { locale } = useParentLocale();
  const strings = getMessages(locale);
  const dashboard = useQuery({ queryKey: [PARENT_DASHBOARD_QUERY_KEY], queryFn: () => loadParentDashboard(supabase), refetchOnWindowFocus: true });

  if (dashboard.isPending) {
    return (
      <AppContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.limeGreen} accessibilityLabel={strings.common.loading} />
      </AppContainer>
    );
  }

  if (dashboard.isError) {
    return (
      <AppContainer style={styles.center}>
        <View style={styles.message}>
          <SlayText variant="body" color={alpha.white60} style={styles.centerText}>
            Could not load the dashboard. Check your connection and try again.
          </SlayText>
          <SlayButton loading={dashboard.isFetching} onPress={() => dashboard.refetch()}>
            Try again
          </SlayButton>
          <SignOutButton />
        </View>
      </AppContainer>
    );
  }

  const state = dashboard.data;
  return (
    <ParentDashboard
      locale={locale}
      studentEmail={state.studentEmail}
      data={state.kind === "linked" ? state.data : undefined}
      pendingReason={state.kind === "pending" ? state.reason : undefined}
      refreshing={dashboard.isRefetching}
      onRefresh={() => dashboard.refetch()}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  message: { width: "100%", gap: 16 },
  centerText: { textAlign: "center" },
});
