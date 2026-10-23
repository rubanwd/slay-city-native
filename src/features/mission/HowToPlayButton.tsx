import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";

/**
 * Port of upstream's `HowToPlayButton.tsx`: an "i" in the mission header that
 * shows the current task's instructions. The web's tooltip becomes a small
 * sheet here — a tap anywhere outside closes it, as an outside click does there.
 */
export function HowToPlayButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <>
      <SlayPressable
        accessibilityRole="button"
        accessibilityLabel="How to play"
        accessibilityState={{ expanded: open }}
        hitSlop={4}
        onPress={() => setOpen(true)}
        style={[styles.button, open && styles.buttonOpen]}
      >
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <Circle cx={8} cy={8} r={7} stroke={open ? colors.cyan : alpha.white70} strokeWidth={1.5} />
          <Circle cx={8} cy={4.6} r={0.95} fill={open ? colors.cyan : alpha.white70} />
          <Path d="M8 7v4.5" stroke={open ? colors.cyan : alpha.white70} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      </SlayPressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} accessibilityRole="button" onPress={() => setOpen(false)} accessibilityLabel="Close">
          <View style={styles.card} accessibilityViewIsModal>
            <SlayText variant="label" color={colors.cyan} style={styles.title}>
              How to play
            </SlayText>
            <SlayText variant="small" color={alpha.white80}>
              {text}
            </SlayText>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: alpha.white15,
  },
  buttonOpen: {
    borderColor: colors.cyan,
    backgroundColor: withAlpha(colors.cyan, 0.15),
  },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: withAlpha(colors.black, 0.6),
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white15,
    backgroundColor: colors.surface,
    padding: 16,
  },
  title: {
    marginBottom: 6,
  },
});
