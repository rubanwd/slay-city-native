import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton } from "./SlayButton";
import { SlayPressable } from "./SlayPressable";
import { SlayText } from "./SlayText";

export interface RewardModalProps {
  open: boolean;
  onClose: () => void;
  /** Large headline, e.g. "AMAZING!" */
  title: ReactNode;
  /** Reward graphic — an image or an emoji. */
  image?: ReactNode;
  /** Supporting copy below the title. */
  description?: ReactNode;
  /** Reward chips row (coins, XP, …). */
  rewards?: ReactNode;
  /** Primary action — a pink Continue button that closes the modal if omitted. */
  action?: ReactNode;
}

/**
 * design/SCN-5 "RewardModal" — port of upstream's
 * `src/components/ui/RewardModal.tsx`: a centred celebration card over a dark
 * backdrop, with a close ×, a neon accent line, an optional image, the title,
 * copy, reward chips and one action.
 *
 * The web's focus trap, Escape key and scroll lock are what a native `Modal`
 * already is; Android's back button closes it as Escape does, and a tap on
 * the backdrop closes it as an outside click does. The web's scale-in becomes
 * the modal's fade.
 */
export function RewardModal({ open, onClose, title, image, description, rewards, action }: RewardModalProps) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} accessibilityRole="button" onPress={onClose} accessibilityLabel="Close reward">
        {/* A press inside the panel must not reach the backdrop. */}
        <Pressable style={styles.panel} onPress={() => {}} accessibilityViewIsModal accessibilityLabel="Reward">
          <SlayPressable
            accessibilityRole="button"
            accessibilityLabel="Close reward"
            hitSlop={8}
            onPress={onClose}
            style={styles.close}
          >
            <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <Path d="M2 2l12 12M14 2L2 14" stroke={alpha.white40} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </SlayPressable>

          <LinearGradient
            colors={["transparent", colors.neonPink, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.accent}
          />

          {image ? (
            <LinearGradient
              colors={[withAlpha(colors.purple, 0.3), withAlpha(colors.neonPink, 0.2)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.image}
            >
              {image}
            </LinearGradient>
          ) : null}

          {typeof title === "string" ? (
            <SlayText variant="display" weight="900" accessibilityRole="header" style={styles.center}>
              {title}
            </SlayText>
          ) : (
            title
          )}

          {typeof description === "string" ? (
            <SlayText variant="body" color={alpha.white60} style={styles.center}>
              {description}
            </SlayText>
          ) : (
            description
          )}

          {rewards ? <View style={styles.rewards}>{rewards}</View> : null}

          <View style={styles.divider} />

          <View style={styles.action}>
            {action ?? (
              <SlayButton variant="pink" size="lg" onPress={onClose}>
                Continue
              </SlayButton>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: withAlpha(colors.black, 0.75),
  },
  panel: {
    width: "100%",
    maxWidth: 384,
    alignItems: "center",
    gap: 16,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: withAlpha(colors.neonPink, 0.5),
    backgroundColor: colors.surface,
    boxShadow: `0 0 40px 8px ${withAlpha(colors.neonPink, 0.3)}`,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  close: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  accent: { position: "absolute", top: 0, alignSelf: "center", width: 96, height: 1 },
  image: {
    width: 144,
    height: 144,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: withAlpha(colors.neonPink, 0.3),
  },
  center: { textAlign: "center" },
  rewards: { flexDirection: "row", alignItems: "center", gap: 12 },
  divider: { alignSelf: "stretch", height: 1, backgroundColor: alpha.white10 },
  action: { alignSelf: "stretch" },
});
