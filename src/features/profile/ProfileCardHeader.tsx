import { StyleSheet, View } from "react-native";

import { alpha, colors, radii } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";

export interface ProfileCardHeaderProps {
  title: string;
  value: string;
  valueColor?: string;
  /** The Change / Cancel chip; left out when there is nothing to change. */
  toggle?: { label: string; onPress: () => void; disabled?: boolean; expanded: boolean };
}

/**
 * The top row the name and level cards share on the web: a small label over
 * the current value, and a pill that opens or closes the editor below.
 */
export function ProfileCardHeader({ title, value, valueColor = colors.white, toggle }: ProfileCardHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <SlayText variant="label" color={alpha.white50}>
          {title}
        </SlayText>
        <SlayText variant="bodyStrong" weight="700" color={valueColor}>
          {value}
        </SlayText>
      </View>
      {toggle ? (
        <SlayPressable
          accessibilityRole="button"
          accessibilityLabel={`${toggle.label} ${title.toLowerCase()}`}
          aria-expanded={toggle.expanded}
          disabled={toggle.disabled}
          hitSlop={8}
          onPress={toggle.onPress}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed, toggle.disabled && styles.disabled]}
        >
          <SlayText variant="label" weight="700" color={alpha.white60}>
            {toggle.label}
          </SlayText>
        </SlayPressable>
      ) : null}
    </View>
  );
}

export const cardStyle = {
  gap: 12,
  borderRadius: radii.lg,
  borderWidth: 1,
  borderColor: alpha.white10,
  backgroundColor: alpha.white5,
  padding: 16,
} as const;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  text: { flexShrink: 1, minWidth: 0 },
  chip: {
    flexShrink: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: alpha.white20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipPressed: { backgroundColor: alpha.white10 },
  disabled: { opacity: 0.5 },
});
