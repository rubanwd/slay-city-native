import { Tabs } from "expo-router";

import { alpha, colors } from "@slay/tokens";

/**
 * WP-1.5 route skeleton — mirrors the web teacher console's `BottomNav`
 * (dashboard, map, profile; see `upstream/src/components/layout/navigation.ts`
 * `consoleItems`). The dashboard is the teacher's list of groups, so its file
 * is named `groups` rather than `index`.
 *
 * `map` and `profile` are named `teacher-map` / `teacher-profile` rather than
 * the bare names the student group uses: Expo Router strips a route group's
 * parens from the URL, so an unqualified `map.tsx` here would resolve to the
 * same `/map` pathname as `(student)/map.tsx`. Real role-based routing
 * (WP-2.6) mounts exactly one role group at a time, which would make that
 * safe, but nothing enforces that yet in this phase — the dev switcher can
 * reach any group from `/`. Revisit once that guard exists.
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
      <Tabs.Screen name="groups" options={{ title: "Groups" }} />
      <Tabs.Screen name="teacher-map" options={{ title: "Map" }} />
      <Tabs.Screen name="teacher-profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
