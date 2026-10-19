import { Tabs } from "expo-router";

import { alpha, colors } from "@slay/tokens";

/**
 * Mirrors the web parent console's `BottomNav` (dashboard, map, profile; see
 * `upstream/src/components/layout/navigation.ts` `consoleItems`) and its paths:
 * `/parent` is the dashboard — the linked student's progress — and `map` and
 * `profile` sit under it, so `roleHome("parent")` from `@slay/core` addresses
 * this screen directly (WP-2.6).
 */
export default function ParentLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.limeGreen,
        tabBarInactiveTintColor: alpha.white50,
        tabBarStyle: { backgroundColor: colors.black, borderTopColor: alpha.white10 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Progress" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
