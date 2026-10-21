import type { ReactNode } from "react";
import { StyleSheet } from "react-native";

import { alpha, colors } from "@slay/tokens";

import { SlayText } from "~/components/ui";

/** A task's question — upstream's `text-h2 font-black text-white text-center`. */
export function TaskPrompt({ children, variant = "h2" }: { children: ReactNode; variant?: "h1" | "h2" | "h3" }) {
  return (
    <SlayText variant={variant} weight="900" accessibilityRole="header" style={styles.center}>
      {children}
    </SlayText>
  );
}

/** A small grey line above a word — upstream's `text-small text-white/50`. */
export function TaskHint({ children }: { children: ReactNode }) {
  return (
    <SlayText variant="small" color={alpha.white50} style={styles.center}>
      {children}
    </SlayText>
  );
}

/** The word being asked about, big and cyan — upstream's `text-h1 font-black text-cyan`. */
export function TaskWord({ children }: { children: ReactNode }) {
  return (
    <SlayText variant="h1" weight="900" color={colors.cyan} style={styles.center}>
      {children}
    </SlayText>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: "center",
  },
});
