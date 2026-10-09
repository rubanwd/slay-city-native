import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayInput, SlayText } from "~/components/ui";

import { forgotPasswordFormAction } from "./actions";

/**
 * `src/features/auth/ForgotPasswordForm.tsx` upstream, ported. Same copy and
 * validation (WP-2.2 AC2); `useFormStatus`/`useActionState` become `useState`.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();

  const handleSubmit = async () => {
    setPending(true);
    setError(undefined);
    setMessage(undefined);

    const result = await forgotPasswordFormAction(email);

    setPending(false);
    if (result.error) {
      setError(result.error);
    } else {
      setMessage(result.message);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <AppContainer>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <SlayText variant="h1" style={styles.center}>
            Reset <Text style={{ color: colors.neonPink }}>Password</Text>
          </SlayText>

          <SlayText variant="body" color={alpha.white50} style={styles.center}>
            Enter the email on your account and we&apos;ll send you a link to reset your password.
          </SlayText>

          <SlayInput
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            editable={!pending}
          />

          {error ? (
            <SlayText
              variant="small"
              weight="600"
              color={colors.neonPink}
              accessibilityRole="alert"
              style={styles.center}
            >
              {error}
            </SlayText>
          ) : message ? (
            <SlayText variant="small" weight="600" color={colors.limeGreen} style={styles.center}>
              {message}
            </SlayText>
          ) : null}

          <SlayButton variant="pink" size="lg" loading={pending} onPress={handleSubmit}>
            Send Reset Link
          </SlayButton>

          <View style={styles.switchRow}>
            <SlayText variant="small" color={alpha.white50}>
              Remembered it?{" "}
            </SlayText>
            <Link href="/login">
              <SlayText variant="small" weight="600" color={colors.cyan}>
                Log in
              </SlayText>
            </Link>
          </View>
        </ScrollView>
      </AppContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 20,
    paddingVertical: 24,
  },
  center: {
    textAlign: "center",
  },
  switchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
});
