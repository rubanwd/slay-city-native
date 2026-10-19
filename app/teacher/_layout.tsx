import { Tabs } from "expo-router";

import { alpha, colors } from "@slay/tokens";

/**
 * Mirrors the web teacher console's `BottomNav` (dashboard, map, profile; see
 * `upstream/src/components/layout/navigation.ts` `consoleItems`) and its paths:
 * `/teacher` is the dashboard — the teacher's list of groups — and `map` and
 * `profile` sit under it, so `roleHome("teacher")` from `@slay/core` addresses
 * this screen directly (WP-2.6).
 */
export default function TeacherLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.limeGreen,
        tabBarInactiveTintColor: alpha.white50,
        tabBarStyle: { backgroundColor: colors.black, borderTopColor: alpha.white10 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Groups" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
