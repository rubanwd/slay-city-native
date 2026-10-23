import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { FEEDBACK_KINDS, feedbackKindLabel, MAX_MESSAGE_LENGTH, type FeedbackKind } from "@slay/core";
import { submitFeedbackReport } from "@slay/data";
import { alpha, colors, fontFamilyByWeight, radii, typeScale, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { supabase, supabaseUrl } from "~/lib/supabase";

import { FeedbackImagePicker } from "./FeedbackImagePicker";

const PLACEHOLDER: Record<FeedbackKind, string> = {
  bug: "What went wrong? Where were you when it happened?",
  feedback: "What would make SLAY CITY better?",
};

/**
 * Port of upstream's `feedback/FeedbackButton.tsx`: the Feedback & Bugs entry
 * point on the profile, for students and teachers. Opens a sheet where they
 * describe the problem and attach screenshots; the report lands in the admin
 * console's inbox.
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SlayPressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.entry, pressed && styles.entryPressed]}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke={colors.cyan}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M12 7v5M12 15h.01" stroke={colors.cyan} strokeWidth={2} strokeLinecap="round" />
        </Svg>
        <SlayText variant="small" weight="600" color={colors.cyan}>
          Feedback &amp; Bugs
        </SlayText>
      </SlayPressable>

      {/* Mounted only while open, so every visit starts from a blank draft. */}
      {open ? <FeedbackSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * The report sheet: a bottom sheet over a dark backdrop, as the web shows it on
 * a phone. Holds the draft, uploads screenshots as they are picked, and shows a
 * thank-you state after a successful send. Android's back button and a tap on
 * the backdrop close it, as Escape and an outside click do on the web.
 */
function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const send = useMutation({
    mutationFn: () => submitFeedbackReport(supabase, { kind, message, imageUrls }, supabaseUrl),
  });
  const sent = send.data?.ok === true;
  const error = send.data && !send.data.ok ? send.data.error : send.error?.message;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <Pressable style={styles.backdrop} accessibilityRole="button" onPress={onClose} accessibilityLabel="Close feedback">
          <Pressable
            style={[styles.sheet, { paddingBottom: 32 + insets.bottom }]}
            onPress={() => {}}
            accessibilityViewIsModal
            accessibilityLabel="Feedback and bugs"
          >
            <View style={styles.header}>
              <SlayText variant="h3" weight="900" accessibilityRole="header">
                Feedback &amp; Bugs
              </SlayText>
              <SlayPressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
                <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
                  <Path d="M2 2l12 12M14 2L2 14" stroke={alpha.white40} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </SlayPressable>
            </View>

            {sent ? (
              <View style={styles.thanks}>
                <SlayText variant="h1" accessible={false}>
                  💚
                </SlayText>
                <SlayText variant="bodyStrong" weight="700" accessibilityLiveRegion="polite">
                  Thanks — we got it!
                </SlayText>
                <SlayText variant="small" color={alpha.white60} style={styles.center}>
                  Your report is on its way to the team. We read every one.
                </SlayText>
                <SlayButton variant="green" onPress={onClose} style={styles.wide}>
                  Done
                </SlayButton>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <View style={styles.kinds} accessibilityLabel="Report type">
                  {FEEDBACK_KINDS.map((option) => {
                    const selected = kind === option;
                    return (
                      <SlayPressable
                        key={option}
                        accessibilityRole="button"
                        aria-pressed={selected}
                        onPress={() => setKind(option)}
                        style={[styles.kind, selected ? styles.kindSelected : styles.kindIdle]}
                      >
                        <SlayText variant="small" weight="700" color={selected ? colors.white : alpha.white60}>
                          {feedbackKindLabel(option)}
                        </SlayText>
                      </SlayPressable>
                    );
                  })}
                </View>

                <View style={styles.field}>
                  <SlayText variant="label" color={alpha.white50}>
                    What happened?
                  </SlayText>
                  <TextInput
                    maxFontSizeMultiplier={1.5}
                    value={message}
                    onChangeText={(text) => setMessage(text.slice(0, MAX_MESSAGE_LENGTH))}
                    placeholder={PLACEHOLDER[kind]}
                    placeholderTextColor={alpha.white50}
                    selectionColor={colors.cyan}
                    accessibilityLabel="What happened?"
                    multiline
                    numberOfLines={5}
                    maxLength={MAX_MESSAGE_LENGTH}
                    // Prose a child types fast: let the keyboard help.
                    autoCapitalize="sentences"
                    autoCorrect
                    spellCheck
                    textAlignVertical="top"
                    style={styles.input}
                  />
                  <SlayText variant="label" color={alpha.white50} style={styles.counter}>
                    {`${message.length}/${MAX_MESSAGE_LENGTH}`}
                  </SlayText>
                </View>

                <FeedbackImagePicker
                  value={imageUrls}
                  onChange={setImageUrls}
                  disabled={send.isPending}
                  onUploadingChange={setUploading}
                />

                {error ? (
                  <SlayText variant="small" weight="600" color={colors.neonPink} accessibilityRole="alert">
                    {error}
                  </SlayText>
                ) : null}

                <SlayButton
                  variant="pink"
                  loading={send.isPending}
                  // A screenshot still uploading would be missing from the report.
                  disabled={!message.trim() || uploading}
                  onPress={() => send.mutate()}
                >
                  Send report
                </SlayButton>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.cyan, 0.4),
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  entryPressed: { backgroundColor: withAlpha(colors.cyan, 0.1) },
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
  form: { gap: 16 },
  kinds: { flexDirection: "row", gap: 8 },
  kind: { flex: 1, alignItems: "center", borderRadius: radii.md, paddingHorizontal: 16, paddingVertical: 10 },
  kindSelected: { backgroundColor: colors.neonPink },
  kindIdle: { borderWidth: 1, borderColor: alpha.white20 },
  field: { gap: 6 },
  input: {
    minHeight: 120,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white15,
    backgroundColor: withAlpha(colors.black, 0.4),
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    color: colors.white,
    fontFamily: fontFamilyByWeight["400"],
    fontSize: typeScale.small.max,
  },
  counter: { alignSelf: "flex-end", textTransform: "none", letterSpacing: 0 },
  thanks: { alignItems: "center", gap: 16, paddingVertical: 24 },
  center: { textAlign: "center" },
  wide: { alignSelf: "stretch" },
});
