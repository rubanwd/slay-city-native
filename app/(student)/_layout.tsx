import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router";

import { hasAnyGroup } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { HOMEWORK_QUERY_KEY } from "~/features/homework";
import { supabase } from "~/lib/supabase";

/**
 * Mirrors the web's student `BottomNav` (map, wardrobe, homework, profile; see
 * `upstream/src/components/layout/navigation.ts`). Homework shows only for a
 * student in a teacher's group, as the web's `showHomework` does — hidden until
 * that is known, so it never flashes in and out. No icons yet — `BottomNav`'s tab icons were
 * never ported to `src/components/ui/icons` (WP-1.4 only covers the shared
 * icon set), so labels stand alone until that lands.
 */
export default function StudentLayout() {
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
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="wardrobe" options={{ title: "Wardrobe" }} />
      <Tabs.Screen name="homework/index" options={{ title: "Homework", href: inGroup.data ? undefined : null }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      {/* A mission is full-screen, as on the web: no tab of its own, no tab bar. */}
      <Tabs.Screen name="mission/[missionId]/index" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="mission/[missionId]/reward" options={{ href: null, tabBarStyle: { display: "none" } }} />
      {/* A topic is full-screen too: its study flows run like a mission. */}
      <Tabs.Screen name="homework/[topicId]" options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}
