import { Tabs } from "expo-router";

import { getMessages } from "@slay/core";

import { SlayTabBar, slayTabScreenOptions, tabIcon } from "~/components/navigation";
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
    <Tabs screenOptions={slayTabScreenOptions} tabBar={SlayTabBar}>
      <Tabs.Screen name="index" options={{ title: nav.dashboard, tabBarIcon: tabIcon("dashboard") }} />
      <Tabs.Screen name="map" options={{ title: nav.map, tabBarIcon: tabIcon("map") }} />
      <Tabs.Screen name="profile" options={{ title: nav.profile, tabBarIcon: tabIcon("profile") }} />
    </Tabs>
  );
}
