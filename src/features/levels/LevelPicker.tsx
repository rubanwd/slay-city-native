import { StyleSheet, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

import { KNOWLEDGE_LEVEL_DESCRIPTIONS, KNOWLEDGE_LEVEL_LABELS } from "@slay/core";
import type { KnowledgeLevel } from "@slay/core/types";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";

export interface LevelPickerProps {
  /** Levels with content, in learning order — see `getAvailableLevels`. */
  levels: readonly KnowledgeLevel[];
  /** Currently picked level; null before anything is picked. */
  value: KnowledgeLevel | null;
  onChange: (level: KnowledgeLevel) => void;
  disabled?: boolean;
}

/**
 * Port of upstream's `levels/LevelPicker.tsx`: big tappable level cards — the
 * level equivalent of picking a difficulty at the start of a game. Used on the
 * profile screen and, next, at onboarding, so it stays presentational: the
 * caller owns the value and what a change means.
 *
 * Only levels that already have playable content are ever passed in; the rest
 * of the ladder is shown as a locked footnote by {@link LockedLevelsNote}.
 */
export function LevelPicker({ levels, value, onChange, disabled = false }: LevelPickerProps) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Knowledge level" style={styles.list}>
      {levels.map((level) => {
        const selected = level === value;
        return (
          <SlayPressable
            key={level}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={KNOWLEDGE_LEVEL_LABELS[level]}
            accessibilityHint={KNOWLEDGE_LEVEL_DESCRIPTIONS[level]}
            disabled={disabled}
            onPress={() => onChange(level)}
            style={({ pressed }) => [
              styles.card,
              selected ? styles.cardSelected : pressed && styles.cardPressed,
              disabled && styles.disabled,
            ]}
          >
            <View style={styles.text}>
              <SlayText variant="bodyStrong" weight="700" color={selected ? colors.limeGreen : colors.white}>
                {KNOWLEDGE_LEVEL_LABELS[level]}
              </SlayText>
              <SlayText variant="small" color={alpha.white50}>
                {KNOWLEDGE_LEVEL_DESCRIPTIONS[level]}
              </SlayText>
            </View>
            <View style={[styles.check, selected && styles.checkSelected]}>
              {selected ? (
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Polyline
                    points="20 6 9 17 4 12"
                    stroke={colors.black}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              ) : null}
            </View>
          </SlayPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white15,
    backgroundColor: alpha.white5,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardPressed: { borderColor: withAlpha(colors.white, 0.3), backgroundColor: alpha.white10 },
  cardSelected: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.1) },
  disabled: { opacity: 0.5 },
  text: { flexShrink: 1 },
  check: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: alpha.white25,
  },
  checkSelected: { borderColor: colors.limeGreen, backgroundColor: colors.limeGreen },
});
