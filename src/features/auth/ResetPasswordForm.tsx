import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";

import { colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayInput, SlayText } from "~/components/ui";

import { resetPasswordFormAction } from "./actions";

/**
 * `src/features/auth/ResetPasswordForm.tsx` upstream, ported. Same copy and
 * validation (WP-2.2 AC2). Unlike upstream this does not sign the user out and
 * redirect to `/auth/login` on success — the caller
 * (app/(auth)/reset-password.tsx) already holds the recovery session the
 * callback produced, so it routes straight to the role home instead.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async () => {
    setPending(true);
    setError(undefined);

    const result = await resetPasswordFormAction(password, confirmPassword);

    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    // Interim target until WP-2.6's role-based route guard lands — see
    // app/(auth)/callback.tsx and app/index.tsx, which use the same stand-in.
    router.replace("/");
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <AppContainer>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <SlayText variant="h1" style={styles.center}>
            New <Text style={{ color: colors.neonPink }}>Password</Text>
          </SlayText>

          <SlayInput
            label="New Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!pending}
          />

          <SlayInput
            label="Confirm Password"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
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
          ) : null}

          <SlayButton variant="pink" size="lg" loading={pending} onPress={handleSubmit}>
            Update Password
          </SlayButton>
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
});
