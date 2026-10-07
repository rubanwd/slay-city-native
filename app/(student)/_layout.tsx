import { Tabs } from "expo-router";

import { alpha, colors } from "@slay/tokens";

/**
 * WP-1.5 route skeleton — mirrors the web's student `BottomNav` (map, wardrobe,
 * homework, profile; see `upstream/src/components/layout/navigation.ts`), minus
 * the "has a teacher group" condition on Homework, which needs real data this
 * phase deliberately doesn't fetch. No icons yet — `BottomNav`'s tab icons were
 * never ported to `src/components/ui/icons` (WP-1.4 only covers the shared
 * icon set), so labels stand alone until that lands.
 */
export default function StudentLayout() {
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
      <Tabs.Screen name="homework" options={{ title: "Homework" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
