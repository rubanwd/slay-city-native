import { Redirect, Tabs } from "expo-router";

import { SlayTabBar, slayTabScreenOptions, tabIcon } from "~/components/navigation";

/**
 * The student tab bar — icons, active circle, Slay School strip — around the
 * loaders, with no backend. `/dev/tabs` is the student loader, `/dev/tabs/console`
 * the teacher and parent one. Dev-only.
 */
export default function DevTabsLayout() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Tabs screenOptions={slayTabScreenOptions} tabBar={SlayTabBar}>
      <Tabs.Screen name="index" options={{ title: "Map", tabBarIcon: tabIcon("map") }} />
      <Tabs.Screen name="wardrobe" options={{ title: "Wardrobe", tabBarIcon: tabIcon("wardrobe") }} />
      <Tabs.Screen name="console" options={{ title: "Homework", tabBarIcon: tabIcon("homework") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: tabIcon("profile") }} />
    </Tabs>
  );
}
