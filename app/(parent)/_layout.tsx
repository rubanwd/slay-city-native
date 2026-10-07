import { Tabs } from "expo-router";

import { alpha, colors } from "@slay/tokens";

/**
 * WP-1.5 route skeleton — mirrors the web parent console's `BottomNav`
 * (dashboard, map, profile; see `upstream/src/components/layout/navigation.ts`
 * `consoleItems`). The dashboard shows the linked student's progress, so its
 * file is named `progress` rather than `index`.
 *
 * `map` and `profile` are qualified as `parent-map` / `parent-profile` for the
 * same reason as the teacher group — see that `_layout.tsx` for why bare names
 * would collide across role groups.
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
      <Tabs.Screen name="progress" options={{ title: "Progress" }} />
      <Tabs.Screen name="parent-map" options={{ title: "Map" }} />
      <Tabs.Screen name="parent-profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
