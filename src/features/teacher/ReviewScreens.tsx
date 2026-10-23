import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter, type Href } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

import { loadReviewLocation, loadReviewMission, loadTeacherMap, type ReviewLocationData } from "@slay/data";
import { alpha, colors, radii } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { FullScreenLoader, SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { CityMapPreview } from "~/features/map";
import { MissionScreen } from "~/features/mission";
import { supabase } from "~/lib/supabase";

import { TeacherHeader } from "./TeacherHeader";

function Loading({ label }: { label: string }) {
  return (
    <AppContainer>
      <FullScreenLoader label={label} mascot={false} />
    </AppContainer>
  );
}

function Failed({ text, onRetry, retrying, back }: { text: string; onRetry: () => void; retrying: boolean; back?: Href }) {
  const router = useRouter();
  return (
    <AppContainer style={styles.centered}>
      <View style={styles.message}>
        <SlayText variant="body" color={alpha.white60} style={styles.center}>
          {text}
        </SlayText>
        <SlayButton loading={retrying} onPress={onRetry}>
          Try again
        </SlayButton>
        {back ? (
          <SlayButton variant="ghost" onPress={() => router.navigate(back)}>
            Back
          </SlayButton>
        ) : null}
      </View>
    </AppContainer>
  );
}

/**
 * `/teacher/map` — port of upstream's teacher map page: the whole city as a
 * student sees it at the teacher's own level, every district and stop open,
 * no student's progress drawn. A stop opens its missions to run in review.
 */
export function TeacherMapLoader() {
  const map = useQuery({ queryKey: ["teacher-map"], queryFn: () => loadTeacherMap(supabase) });
  if (map.isPending) return <Loading label="Loading map…" />;
  if (map.isError) return <Failed text="Could not load the city map." onRetry={() => map.refetch()} retrying={map.isFetching} />;
  return (
    <CityMapPreview
      districts={map.data.districts}
      levelName={map.data.levelName}
      subtitle="Every district and mission"
      locationHref={(locationId) => ({ pathname: "/teacher/location/[locationId]", params: { locationId } })}
    />
  );
}

/**
 * Port of upstream's `src/app/teacher/location/[locationId]/page.tsx`: every
 * mission at one stop, any of them openable — a student is handed the next
 * one in order, a teacher checking content wants to open any. Missions run in
 * review, so nothing here reports "done".
 */
export function ReviewLocationScreen({ location, missions }: ReviewLocationData) {
  const router = useRouter();
  return (
    <AppContainer edges={["top"]}>
      <FlatList
        data={missions}
        keyExtractor={(m) => m.id}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.head}>
            <TeacherHeader title={location.name} backHref="/teacher/map" />
            {location.districtName ? (
              <SlayText variant="label" color={alpha.white50}>
                {location.districtName}
              </SlayText>
            ) : null}
            {location.description ? (
              <SlayText variant="small" color={alpha.white60}>
                {location.description}
              </SlayText>
            ) : null}
            <SlayText variant="small" color={colors.cyan}>
              Missions run in review: as a student plays them, with nothing recorded.
            </SlayText>
          </View>
        }
        renderItem={({ item, index }) => (
          <SlayPressable
            accessibilityRole="button"
            accessibilityLabel={`Review mission ${index + 1}: ${item.title}`}
            onPress={() => router.push({ pathname: "/teacher/mission/[missionId]", params: { missionId: item.id } })}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <SlayText variant="label" weight="700" color={alpha.white50}>
              Mission {index + 1}
            </SlayText>
            <SlayText variant="bodyStrong">{item.title}</SlayText>
            {item.description ? (
              <SlayText variant="small" color={alpha.white50} numberOfLines={2}>
                {item.description}
              </SlayText>
            ) : null}
          </SlayPressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <SlayText variant="small" color={alpha.white50} style={styles.center}>
              No published missions here yet.
            </SlayText>
          </View>
        }
      />
    </AppContainer>
  );
}

/** `/teacher/location/[locationId]`. An unpublished stop goes back to the map, as upstream's `notFound()`. */
export function ReviewLocationLoader({ locationId }: { locationId: string }) {
  const location = useQuery({ queryKey: ["teacher-location", locationId], queryFn: () => loadReviewLocation(supabase, locationId) });
  if (location.isPending) return <Loading label="Loading missions…" />;
  if (location.isError) return <Failed text="Could not load this location." onRetry={() => location.refetch()} retrying={location.isFetching} back="/teacher/map" />;
  if (!location.data) return <Redirect href="/teacher/map" />;
  return <ReviewLocationScreen {...location.data} />;
}

/**
 * `/teacher/mission/[missionId]` — port of upstream's teacher mission page: the
 * same `MissionScreen` a student gets, in review mode — no completion, no XP or
 * coins, no reward screen, a badge saying so — running on into the next
 * mission at the stop. Exiting returns to the stop's list.
 */
export function ReviewMissionLoader({ missionId }: { missionId: string }) {
  const mission = useQuery({ queryKey: ["teacher-mission", missionId], queryFn: () => loadReviewMission(supabase, missionId), gcTime: 0 });
  if (mission.isPending) return <Loading label="Loading mission…" />;
  if (mission.isError) return <Failed text="Could not load this mission." onRetry={() => mission.refetch()} retrying={mission.isFetching} back="/teacher/map" />;
  if (!mission.data) return <Redirect href="/teacher/map" />;
  const { locationId, next, ...screen } = mission.data;
  return (
    <MissionScreen
      key={missionId}
      {...screen}
      review
      exitHref={{ pathname: "/teacher/location/[locationId]", params: { locationId } }}
      nextMission={next ? { title: next.title, href: { pathname: "/teacher/mission/[missionId]", params: { missionId: next.id } } } : null}
    />
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: "center", justifyContent: "center" },
  message: { width: "100%", gap: 16 },
  center: { textAlign: "center" },
  list: { paddingBottom: 32 },
  head: { gap: 6, paddingBottom: 16 },
  gap: { height: 8 },
  card: { gap: 4, borderRadius: radii.lg, borderWidth: 1, borderColor: alpha.white10, backgroundColor: colors.surface, padding: 16 },
  cardPressed: { borderColor: alpha.white20 },
  empty: { borderRadius: radii.lg, borderWidth: 1, borderColor: alpha.white10, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 24 },
});
