import { BottomTabBar, type BottomTabBarProps, type BottomTabNavigationOptions } from "expo-router/tabs";
import { StyleSheet, View } from "react-native";

import { alpha, colors, fontFamilyByWeight } from "@slay/tokens";

import { BrandWatermark } from "./BrandWatermark";
import { NavIcon, type NavIconName } from "./NavIcon";

/**
 * Port of upstream's `BottomNav.tsx` frame: the tabs, the Slay School
 * watermark strip under them, then the home-indicator inset — in that order,
 * as on the web, where the strip sits inside the safe-area padding. A screen
 * that hides the tab bar (`tabBarStyle: { display: "none" }`, a mission)
 * hides the whole frame.
 */
export function SlayTabBar(props: BottomTabBarProps) {
  const focused = props.descriptors[props.state.routes[props.state.index].key].options;
  const style = StyleSheet.flatten(focused.tabBarStyle) as { display?: string } | undefined;
  if (style?.display === "none") return null;

  return (
    <View style={styles.frame}>
      <BottomTabBar {...props} insets={{ ...props.insets, bottom: 0 }} />
      <BrandWatermark />
      <View style={{ height: props.insets.bottom }} />
    </View>
  );
}

/**
 * The look every role's tabs share: upstream's 40pt circle around the icon,
 * lime with a black icon when active, a grey line icon otherwise, and an 11pt
 * semibold label under it. Pass `tabBar={SlayTabBar}` alongside.
 */
export const slayTabScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.limeGreen,
  tabBarInactiveTintColor: alpha.white50,
  // 40pt circle + 4 + 13pt label + the item's own 5pt padding each side, as the web's ~79pt bar.
  tabBarStyle: { height: 76, paddingTop: 4, paddingBottom: 4, backgroundColor: colors.black, borderTopColor: alpha.white10 },
  tabBarIconStyle: { width: 40, height: 40 },
  tabBarLabelStyle: { fontFamily: fontFamilyByWeight["600"], fontSize: 11, lineHeight: 13, marginTop: 4 },
};

/** A tab's `tabBarIcon`: the named web icon in its active/inactive circle. */
export function tabIcon(name: NavIconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return (
      <View style={[styles.circle, focused && styles.circleActive]}>
        <NavIcon name={name} color={focused ? colors.black : alpha.white50} />
      </View>
    );
  };
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.black },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  circleActive: { backgroundColor: colors.limeGreen },
});
