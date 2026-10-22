import { StyleSheet, View } from "react-native";

import { colors } from "@slay/tokens";

import { SlayText } from "~/components/ui";

/**
 * Port of upstream's `qa/UnreadBadge.tsx`: a small neon-pink pill with the
 * number of unread Q&A messages, "9+" past nine. Renders nothing at zero, so
 * callers can drop it in unconditionally.
 */
export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = `${count} unread message${count === 1 ? "" : "s"}`;
  return (
    <View style={styles.pill} accessible accessibilityLabel={label}>
      <SlayText variant="label" weight="700" style={styles.text}>
        {count > 9 ? "9+" : String(count)}
      </SlayText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 20,
    height: 20,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.neonPink,
    paddingHorizontal: 6,
  },
  text: { letterSpacing: 0 },
});
