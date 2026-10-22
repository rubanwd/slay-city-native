import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";

export interface CollapsibleSectionProps {
  title: string;
  /** One line under the title. */
  subtitle?: string;
  /** Shown next to the title, e.g. an unread badge. */
  badge?: ReactNode;
  defaultOpen?: boolean;
  /** Called when the section opens. */
  onOpen?: () => void;
  children: ReactNode;
}

/**
 * Port of upstream's `teacher/CollapsibleSection.tsx`: a titled, purple-edged
 * panel on the teacher's topic screen, collapsed by default so the screen
 * opens compact and the teacher expands only what they work on.
 */
export function CollapsibleSection({ title, subtitle, badge, defaultOpen = false, onOpen, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    if (!open) onOpen?.();
    setOpen(!open);
  };

  return (
    <View style={styles.section}>
      <SlayPressable accessibilityRole="button" aria-expanded={open} onPress={toggle} style={styles.head}>
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <SlayText variant="bodyStrong">{title}</SlayText>
            {badge}
          </View>
          {subtitle ? (
            <SlayText variant="small" color={alpha.white50}>
              {subtitle}
            </SlayText>
          ) : null}
        </View>
        <Svg width={20} height={20} viewBox="0 0 20 20" fill="none" style={open ? styles.flipped : undefined}>
          <Path d="M5 7.5L10 12.5L15 7.5" stroke={alpha.white60} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </SlayPressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24, borderRadius: radii.lg, borderWidth: 1, borderColor: withAlpha(colors.purple, 0.3), backgroundColor: withAlpha(colors.purple, 0.05) },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16 },
  text: { flexShrink: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flipped: { transform: [{ rotate: "180deg" }] },
  body: { gap: 16, paddingHorizontal: 16, paddingBottom: 16 },
});
