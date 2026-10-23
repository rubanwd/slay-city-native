import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { loadTeacherDashboard } from "@slay/data";
import { alpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { FullScreenLoader, SlayButton, SlayText } from "~/components/ui";
import { SignOutButton } from "~/features/auth";
import { supabase } from "~/lib/supabase";

import { TEACHER_DASHBOARD_QUERY_KEY } from "./queryKeys";
import { TeacherDashboard } from "./TeacherDashboard";

/**
 * `/teacher`: loads the groups (`loadTeacherDashboard`). Refetches when the
 * app comes back to the foreground (TanStack Query's focus manager), so the
 * students' progress is current whenever the teacher looks; pull to refresh
 * does the same on demand.
 */
export function TeacherDashboardLoader() {
  const dashboard = useQuery({
    queryKey: [TEACHER_DASHBOARD_QUERY_KEY],
    queryFn: () => loadTeacherDashboard(supabase),
    refetchOnWindowFocus: true,
  });

  if (dashboard.isPending) {
    return (
      <AppContainer>
        <FullScreenLoader label="Loading dashboard…" mascot={false} />
      </AppContainer>
    );
  }

  if (dashboard.isError) {
    return (
      <AppContainer style={styles.center}>
        <View style={styles.message}>
          <SlayText variant="body" color={alpha.white60} style={styles.centerText}>
            Could not load your groups. Check your connection and try again.
          </SlayText>
          <SlayButton loading={dashboard.isFetching} onPress={() => dashboard.refetch()}>
            Try again
          </SlayButton>
          <SignOutButton />
        </View>
      </AppContainer>
    );
  }

  return <TeacherDashboard {...dashboard.data} refreshing={dashboard.isRefetching} onRefresh={() => dashboard.refetch()} />;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  message: { width: "100%", gap: 16 },
  centerText: { textAlign: "center" },
});
