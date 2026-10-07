import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { alpha } from "@slay/tokens";

import { SlayText } from "~/components/ui/SlayText";

export type SectionSpacing = "none" | "xs" | "sm" | "md" | "lg" | "xl";

export interface SectionProps {
  children?: ReactNode;
  /** Vertical padding above the section. Overrides `py`. */
  pt?: SectionSpacing;
  /** Vertical padding below the section. Overrides `py`. */
  pb?: SectionSpacing;
  /**
   * Shorthand — sets both `pt` and `pb` when neither is given.
   * @default "md"
   */
  py?: SectionSpacing;
  /** Rendered above the content as an uppercase white/50 label. */
  title?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * design/SCN-56 §3.1 "Section" — the vertical rhythm of a screen. A column with
 * a 12pt gap and a padding scale on each end, mirroring
 * `src/components/layout/Section.tsx` upstream.
 *
 * The scale is the web's rem values converted to points (0.5rem → 8, 1rem → 16,
 * 1.5rem → 24 …), so a screen ported from the web keeps the same `py` token and
 * lands on the same spacing.
 */
const SPACING: Record<SectionSpacing, number> = {
  none: 0,
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
};

export function Section({ children, pt, pb, py = "md", title, style }: SectionProps) {
  return (
    <View
      style={[
        styles.column,
        { paddingTop: SPACING[pt ?? py], paddingBottom: SPACING[pb ?? py] },
        style,
      ]}
    >
      {title ? (
        <SlayText variant="label" color={alpha.white50}>
          {title}
        </SlayText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flexDirection: "column",
    gap: 12,
  },
});
