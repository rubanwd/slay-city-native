import { Tabs, type ErrorBoundaryProps } from "expo-router";

import { SlayTabBar, slayTabScreenOptions, tabIcon } from "~/components/navigation";
import { RouteError } from "~/features/errors";

/**
 * Mirrors the web teacher console's `BottomNav` (dashboard, map, profile; see
 * `upstream/src/components/layout/navigation.ts` `consoleItems`) and its paths:
 * `/teacher` is the dashboard — the teacher's list of groups — and `map` and
 * `profile` sit under it, so `roleHome("teacher")` from `@slay/core` addresses
 * this screen directly (WP-2.6).
 */
export default function TeacherLayout() {
  return (
    <Tabs screenOptions={slayTabScreenOptions} tabBar={SlayTabBar}>
      <Tabs.Screen name="index" options={{ title: "Groups", tabBarIcon: tabIcon("dashboard") }} />
      <Tabs.Screen name="map" options={{ title: "Map", tabBarIcon: tabIcon("map") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: tabIcon("profile") }} />
      {/* A group's topics and a topic's authoring are full-screen, as on the web: no tab, no tab bar. */}
      <Tabs.Screen name="groups/[groupId]/index" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="groups/[groupId]/topics/[topicId]" options={{ href: null, tabBarStyle: { display: "none" } }} />
      {/* The map's stops and their missions in review: a stop's list keeps the tab bar, a mission is full-screen. */}
      <Tabs.Screen name="location/[locationId]" options={{ href: null }} />
      <Tabs.Screen name="mission/[missionId]" options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}

/** A crash in any teacher screen lands here instead of closing the app (WP-6.7). */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteError {...props} where="teacher" />;
}
