import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { getMessages, KNOWLEDGE_LEVEL_LABELS } from "@slay/core";
import { loadParentMap } from "@slay/data";
import { alpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { FullScreenLoader, SlayButton, SlayText } from "~/components/ui";
import { CityMapPreview } from "~/features/map";
import { useParentLocale } from "~/lib/locale";
import { supabase } from "~/lib/supabase";

/**
 * `/parent/map` — port of upstream's parent map page: the districts and stops
 * the student works through, at the student's own level, with what they have
 * finished marked ✓ and nothing to play. In the parent's language.
 */
export function ParentMapLoader() {
  const { locale } = useParentLocale();
  const strings = getMessages(locale);
  const map = useQuery({ queryKey: ["parent-map"], queryFn: () => loadParentMap(supabase), refetchOnWindowFocus: true });

  if (map.isPending) {
    return (
      <AppContainer>
        <FullScreenLoader label={strings.map.loadingMap} mascot={false} />
      </AppContainer>
    );
  }
  if (map.isError) {
    return (
      <AppContainer style={styles.center}>
        <View style={styles.message}>
          <SlayText variant="body" color={alpha.white60} style={styles.centerText}>
            Could not load the city map. Check your connection and try again.
          </SlayText>
          <SlayButton loading={map.isFetching} onPress={() => map.refetch()}>
            Try again
          </SlayButton>
        </View>
      </AppContainer>
    );
  }

  return (
    <CityMapPreview
      districts={map.data.districts}
      levelName={KNOWLEDGE_LEVEL_LABELS[map.data.level]}
      subtitle={strings.map.subtitle}
      progressLabel={map.data.linked ? (map.data.studentName ?? strings.dashboard.yourStudent) : null}
      locale={locale}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  message: { width: "100%", gap: 16 },
  centerText: { textAlign: "center" },
});
