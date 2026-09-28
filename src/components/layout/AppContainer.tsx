import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { colors } from "@slay/tokens";

const MAX_WIDTH = 448;
const GUTTER = 20;

export interface AppContainerProps {
  children?: ReactNode;
  /**
   * Which edges get the safe-area inset. Screens inside a tab navigator should
   * pass `["top"]` — the tab bar owns the bottom inset.
   * @default ["top", "bottom"]
   */
  edges?: readonly Edge[];
  /** Removes the 20pt horizontal gutter. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * design/SCN-5 "AppContainer" — the safe-area screen wrapper every route renders
 * inside. Mirrors the web's `w-full max-w-md mx-auto bg-black text-white px-5`
 * (`src/components/layout/AppContainer.tsx` upstream).
 */
export function AppContainer({ children, edges = ["top", "bottom"], flush = false, style }: AppContainerProps) {
  return (
    <SafeAreaView edges={edges as Edge[]} style={styles.ground}>
      <View style={[styles.centerer, !flush && styles.gutter, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ground: {
    flex: 1,
    backgroundColor: colors.black,
  },
  centerer: {
    flex: 1,
    width: "100%",
    maxWidth: MAX_WIDTH,
    alignSelf: "center",
  },
  gutter: {
    paddingHorizontal: GUTTER,
  },
});
