import { useEffect, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";
import { haptic } from "~/lib/haptics";

/**
 * The pieces upstream's tap-to-arrange tasks (sentence builder, size order,
 * word scramble, letter fill, category sort — and reaction tap's word field)
 * are built from, written once.
 */

/** The dark answer row that fills up as the student taps — upstream's `bg-black/30` tray. */
export function Tray({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.tray, style]}>{children}</View>;
}

/** The grey line shown in an empty tray. */
export function TrayPlaceholder({ children }: { children: string }) {
  return (
    <SlayText variant="body" color={alpha.white40}>
      {children}
    </SlayText>
  );
}

export type ChipState = "pool" | "used" | "placed" | "solved" | "selected" | "wrong" | "missed";

const CHIP: Record<ChipState, { box: ViewStyle; text: string }> = {
  pool: { box: { borderColor: alpha.white20, backgroundColor: alpha.white10 }, text: colors.white },
  used: { box: { borderColor: alpha.white10, backgroundColor: withAlpha(colors.white, 0.03) }, text: alpha.white20 },
  placed: { box: { borderColor: withAlpha(colors.cyan, 0.6), backgroundColor: withAlpha(colors.cyan, 0.1) }, text: colors.white },
  solved: { box: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.15) }, text: colors.limeGreen },
  selected: { box: { borderColor: colors.cyan, backgroundColor: withAlpha(colors.cyan, 0.2), borderWidth: 2 }, text: colors.white },
  wrong: { box: { borderColor: colors.neonPink, backgroundColor: withAlpha(colors.neonPink, 0.15) }, text: colors.neonPink },
  /** A right answer the student never reached — shown once a timed round ends. */
  missed: {
    box: { borderColor: withAlpha(colors.limeGreen, 0.6), backgroundColor: withAlpha(colors.limeGreen, 0.05) },
    text: withAlpha(colors.limeGreen, 0.7),
  },
};

export interface ChipProps {
  label: string;
  state: ChipState;
  onPress?: () => void;
  disabled?: boolean;
  /** Fixed-size letter tile instead of a word chip. */
  letter?: boolean;
  accessibilityLabel?: string;
}

/** A tappable word or letter. */
export function Chip({ label, state, onPress, disabled, letter = false, accessibilityLabel }: ChipProps) {
  const look = CHIP[state];
  return (
    <SlayPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected: state === "selected" }}
      disabled={disabled}
      onPress={onPress}
      style={[letter ? styles.letter : styles.word, look.box]}
    >
      <SlayText variant={letter ? "h3" : "bodyStrong"} weight={letter ? "900" : "700"} color={look.text}>
        {label}
      </SlayText>
    </SlayPressable>
  );
}

/** Upstream's small "Clear" link under a half-built answer. */
export function ClearButton({ onPress }: { onPress: () => void }) {
  return (
    <SlayPressable accessibilityRole="button" hitSlop={12} onPress={onPress} style={styles.clear}>
      <SlayText variant="label" color={alpha.white50}>
        Clear
      </SlayText>
    </SlayPressable>
  );
}

/** The verdict line once the answer is built — and the `correct` or `wrong` haptic as it appears. */
export function Verdict({ ok, children }: { ok: boolean; children: string }) {
  useEffect(() => {
    haptic(ok ? "correct" : "wrong");
  }, [ok]);

  return (
    <SlayText
      variant="bodyStrong"
      weight="700"
      color={ok ? colors.limeGreen : colors.neonPink}
      accessibilityLiveRegion="polite"
      style={styles.center}
    >
      {children}
    </SlayText>
  );
}

/** A wrapping row of chips. */
export function ChipRow({ children, gap = 8 }: { children: ReactNode; gap?: number }) {
  return <View style={[styles.row, { gap }]}>{children}</View>;
}

const styles = StyleSheet.create({
  tray: {
    minHeight: 56,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white15,
    backgroundColor: withAlpha(colors.black, 0.3),
    padding: 12,
  },
  word: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  letter: {
    width: 44,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
  },
  clear: {
    alignSelf: "center",
  },
  center: {
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
});
