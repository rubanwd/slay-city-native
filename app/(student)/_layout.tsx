import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router";

import { getMessages } from "@slay/core";
import { hasAnyGroup } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { HOMEWORK_QUERY_KEY } from "~/features/homework";
import { useStudentLocale } from "~/lib/locale";
import { supabase } from "~/lib/supabase";

/**
 * Mirrors the web's student `BottomNav` (map, wardrobe, homework, profile; see
 * `upstream/src/components/layout/navigation.ts`). Homework shows only for a
 * student in a teacher's group, as the web's `showHomework` does — hidden until
 * that is known, so it never flashes in and out. No icons yet — `BottomNav`'s tab icons were
 * never ported to `src/components/ui/icons` (WP-1.4 only covers the shared
 * icon set), so labels stand alone until that lands.
 *
 * The labels follow the student's language (upstream's `studentNavLabels`):
 * the tab bar is one of the two student surfaces that are translated, with
 * the profile.
 */
export default function StudentLayout() {
  const nav = getMessages(useStudentLocale()).student.nav;
  const inGroup = useQuery({ queryKey: [HOMEWORK_QUERY_KEY, "visible"], queryFn: () => hasAnyGroup(supabase) });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.limeGreen,
        tabBarInactiveTintColor: alpha.white50,
        tabBarStyle: { backgroundColor: colors.black, borderTopColor: alpha.white10 },
      }}
    >
      <Tabs.Screen name="map" options={{ title: nav.map }} />
      <Tabs.Screen name="wardrobe" options={{ title: nav.wardrobe }} />
      <Tabs.Screen name="homework/index" options={{ title: nav.homework, href: inGroup.data ? undefined : null }} />
      <Tabs.Screen name="profile" options={{ title: nav.profile }} />
      {/* A mission is full-screen, as on the web: no tab of its own, no tab bar. */}
      <Tabs.Screen name="mission/[missionId]/index" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="mission/[missionId]/reward" options={{ href: null, tabBarStyle: { display: "none" } }} />
      {/* A topic is full-screen too: its study flows run like a mission. */}
      <Tabs.Screen name="homework/[topicId]" options={{ href: null, tabBarStyle: { display: "none" } }} />
      {/* The level test is full-screen too, one question at a time. */}
      <Tabs.Screen name="placement-test" options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}
