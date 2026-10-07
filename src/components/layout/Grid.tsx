import { Children, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export type GridCols = 1 | 2 | 3 | 4;
export type GridGap = "none" | "xs" | "sm" | "md" | "lg";

export interface GridProps {
  children?: ReactNode;
  /**
   * Number of equal columns.
   * @default 2
   */
  cols?: GridCols;
  /**
   * Gap between cells, in both axes.
   * @default "md"
   */
  gap?: GridGap;
  style?: StyleProp<ViewStyle>;
}

/** The web's `gap-*` classes in points (Tailwind unit = 4pt). */
const GAP: Record<GridGap, number> = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
};

/**
 * design/SCN-56 §3.1 "Grid" — a wrapping row of equal-width cells.
 *
 * Each cell is exactly `(W − gap·(cols−1)) / cols` wide, derived from the gap
 * actually passed. The web hardcodes those widths for the `md` gap only
 * (`basis-[calc(50%-0.375rem)]`), so `cols={3} gap="lg"` is subtly wrong there;
 * design/SCN-56 D7 fixes it here rather than porting the bug.
 *
 * The arithmetic is done with a negative outer margin instead of measuring the
 * container: the wrapper is inset by `-gap/2` on every side, each cell is
 * `100/cols` percent wide with `gap/2` of padding, and the two cancel at the
 * outer edges. That gives the exact width with no layout pass and no first
 * frame at the wrong size — React Native cannot express `calc(50% - 6pt)`.
 *
 * Upstream's `grid` prop (CSS Grid, "better for equal-height cards") has no
 * native counterpart and needs none: a wrapping flex row already stretches
 * every cell in a row to the tallest one.
 */
export function Grid({ children, cols = 2, gap = "md", style }: GridProps) {
  const half = GAP[gap] / 2;
  const cells = Children.toArray(children);

  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", margin: -half }, style]}>
      {cells.map((cell, index) => (
        <View key={index} style={{ width: `${100 / cols}%`, padding: half }}>
          {cell}
        </View>
      ))}
    </View>
  );
}
