import { type ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@slay/tokens";

/** Height of the teacher console's "viewing as" banner (design/SCN-56 §3.1). */
export const VIEW_AS_BANNER_OFFSET = 49;

export interface ScrollScreenProps {
  children?: ReactNode;
  /** Pinned below the scrolling area, never over it — the role's tab bar. */
  footer?: ReactNode;
  /**
   * Height of a banner drawn *over* the top of the screen, taken off the scroll
   * area's height exactly as the web's `--screen-top-offset` does. Pass
   * {@link VIEW_AS_BANNER_OFFSET} for the teacher "viewing as" banner. Leave at 0
   * when the banner is a sibling above this screen in a column — flex already
   * accounts for it then.
   * @default 0
   */
  topOffset?: number;
  /**
   * Clearance under the content for a bar that floats *over* the scroll area —
   * Expo Router's own tab bar, whose height includes the bottom safe-area inset
   * (`useBottomTabBarHeight()`). Never the web's fixed 150px (design/SCN-56 X6).
   * @default 0
   */
  bottomClearance?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

/**
 * design/SCN-56 §3.1 "ScrollScreen" — a full-height screen whose content scrolls
 * in its own view, with an optional bar pinned below it. Mirrors
 * `src/components/layout/ScrollScreen.tsx` upstream, which exists because the
 * parent and teacher consoles would not scroll at all on iOS when left to the
 * document scroll.
 *
 * Native drops two of the web's workarounds. `h-dvh` becomes plain `flex: 1`,
 * and the web's fixed 150px bottom clearance becomes nothing at all by default:
 * `footer` is laid out *below* the ScrollView rather than fixed on top of it, so
 * it cannot cover the last row. `bottomClearance` is only for a bar that really
 * does float over the content.
 *
 * Per design/SCN-56 G8 the bottom safe-area inset belongs to whatever sits at
 * the bottom: the `footer` gets it when there is one, the content when there is
 * not. Compose it inside an `AppContainer` with `edges={["top"]}` for the top
 * inset and the gutter.
 */
export function ScrollScreen({
  children,
  footer,
  topOffset = 0,
  bottomClearance = 0,
  contentContainerStyle,
  style,
}: ScrollScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, topOffset > 0 && { marginTop: topOffset }, style]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          { paddingBottom: bottomClearance + (footer ? 0 : insets.bottom) },
          contentContainerStyle,
        ]}
      >
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingBottom: insets.bottom }}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.black,
  },
  scroll: {
    flex: 1,
  },
});
