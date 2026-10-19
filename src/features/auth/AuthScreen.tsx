import { type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";

import { colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayText } from "~/components/ui";

/**
 * The frame every auth screen sits in — upstream's `AppContainer` +
 * `justify-center` around a form.
 *
 * A phone adds what the browser never had to handle: the software keyboard
 * (WP-2.2 AC3). `KeyboardAvoidingView` shrinks the frame by the keyboard's
 * height on iOS; Android's default `adjustResize` window mode already does
 * that. Inside it the form scrolls, so on a short screen the focused field and
 * the submit button can always be brought above the keyboard, and
 * `keyboardShouldPersistTaps` lets the first tap on a button press it rather
 * than only dismiss the keyboard.
 */
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <AppContainer>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppContainer>
  );
}

/** Upstream's two-tone form heading: "Log <pink>In</pink>". */
export function AuthTitle({ lead, accent }: { lead: string; accent: string }) {
  return (
    <SlayText variant="h1" weight="900" accessibilityRole="header" style={styles.center}>
      {lead}
      <SlayText variant="h1" weight="900" color={colors.neonPink}>
        {accent}
      </SlayText>
    </SlayText>
  );
}

/** The form-level error or success line under the fields, as upstream renders it. */
export function AuthStatus({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <SlayText variant="small" weight="600" color={colors.neonPink} accessibilityRole="alert" style={styles.center}>
        {error}
      </SlayText>
    );
  }
  if (message) {
    return (
      <SlayText
        variant="small"
        weight="600"
        color={colors.limeGreen}
        accessibilityLiveRegion="polite"
        style={styles.center}
      >
        {message}
      </SlayText>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 24,
    gap: 20,
  },
  center: {
    textAlign: "center",
  },
});
