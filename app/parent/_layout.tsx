import { Tabs } from "expo-router";

import { getMessages } from "@slay/core";
import { alpha, colors } from "@slay/tokens";

import { useParentLocale } from "~/lib/locale";

/**
 * Mirrors the web parent console's `BottomNav` (dashboard, map, profile; see
 * `upstream/src/components/layout/navigation.ts` `consoleItems`) and its paths:
 * `/parent` is the dashboard — the linked student's progress — and `map` and
 * `profile` sit under it, so `roleHome("parent")` from `@slay/core` addresses
 * this screen directly (WP-2.6). The console is fully translated, tabs
 * included, in the parent's language.
 */
export default function ParentLayout() {
  const nav = getMessages(useParentLocale().locale).nav;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.limeGreen,
        tabBarInactiveTintColor: alpha.white50,
        tabBarStyle: { backgroundColor: colors.black, borderTopColor: alpha.white10 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: nav.dashboard }} />
      <Tabs.Screen name="map" options={{ title: nav.map }} />
      <Tabs.Screen name="profile" options={{ title: nav.profile }} />
    </Tabs>
  );
}
