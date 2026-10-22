import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { alpha, colors, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";

/**
 * The teacher console's take on upstream's `AdminCreateModal`: a bottom sheet
 * over a dark backdrop. Android's back button and a backdrop tap close it.
 */
export function FormSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={`Close ${title}`}>
          <Pressable style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]} onPress={() => {}} accessibilityViewIsModal accessibilityLabel={title}>
            <View style={styles.header}>
              <SlayText variant="h3" weight="900" accessibilityRole="header">
                {title}
              </SlayText>
              <SlayPressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
                <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
                  <Path d="M2 2l12 12M14 2L2 14" stroke={alpha.white40} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </SlayPressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: withAlpha(colors.black, 0.8) },
  sheet: {
    maxHeight: "92%",
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  close: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 999 },
});
