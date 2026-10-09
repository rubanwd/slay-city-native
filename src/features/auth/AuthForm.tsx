import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayInput, SlayPressable, SlayText } from "~/components/ui";

import { loginFormAction, registerFormAction, type SignupRole } from "./actions";

export interface AuthFormProps {
  mode: "login" | "register";
}

const COPY = {
  login: {
    titleLead: "Log ",
    titleAccent: "In",
    submit: "Log In",
    switchText: "New to Slay City?",
    switchHref: "/register" as const,
    switchCta: "Create an account",
  },
  register: {
    titleLead: "Sign ",
    titleAccent: "Up",
    submit: "Create Account",
    switchText: "Already have an account?",
    switchHref: "/login" as const,
    switchCta: "Log in",
  },
} as const;

const ROLE_OPTIONS: { value: SignupRole; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
];

/**
 * Shared login/register screen body (`src/features/auth/AuthForm.tsx` upstream).
 * Mode and copy names match it 1:1 for side-by-side review; `@react-dom`'s
 * `useFormStatus`/`useActionState` become plain `useState`, and the Google
 * button + "or" divider are left out — WP-2.5 adds the OAuth buttons where the
 * comment below marks the slot.
 */
export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<SignupRole>("student");
  const [studentEmail, setStudentEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();

  const handleSubmit = async () => {
    setPending(true);
    setError(undefined);
    setMessage(undefined);

    const result = isRegister
      ? await registerFormAction(email, password, confirmPassword, role, studentEmail)
      : await loginFormAction(email, password);

    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.message) {
      setMessage(result.message);
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
          <SlayText variant="h1" style={styles.title}>
            {copy.titleLead}
            <Text style={{ color: colors.neonPink }}>{copy.titleAccent}</Text>
          </SlayText>

          <View style={styles.fields}>
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

            <View style={styles.fieldGroup}>
              <View style={styles.passwordLabelRow}>
                <SlayText variant="label" color={alpha.white50}>
                  Password
                </SlayText>
                {!isRegister ? (
                  <Link href="/forgot-password">
                    <SlayText variant="small" weight="600" color={colors.cyan}>
                      Forgot password?
                    </SlayText>
                  </Link>
                ) : null}
              </View>
              <SlayInput
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={isRegister ? "new-password" : "current-password"}
                textContentType={isRegister ? "newPassword" : "password"}
                editable={!pending}
              />
            </View>

            {isRegister ? (
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
            ) : null}

            {isRegister ? (
              <View style={styles.fieldGroup}>
                <SlayText variant="label" color={alpha.white50}>
                  I am a
                </SlayText>
                <View style={styles.roleRow}>
                  {ROLE_OPTIONS.map((option) => {
                    const selected = role === option.value;
                    return (
                      <SlayPressable
                        key={option.value}
                        onPress={() => setRole(option.value)}
                        disabled={pending}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, disabled: pending }}
                        style={[
                          styles.roleOption,
                          {
                            borderColor: selected ? colors.neonPink : alpha.white20,
                            backgroundColor: selected ? withAlpha(colors.neonPink, 0.1) : "transparent",
                          },
                        ]}
                      >
                        <SlayText variant="small" weight="600" color={selected ? colors.white : alpha.white60}>
                          {option.label}
                        </SlayText>
                      </SlayPressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {isRegister && role === "parent" ? (
              <SlayInput
                label="Student's Email"
                hint="We'll link your student's account so you can follow their progress."
                placeholder="student@example.com"
                value={studentEmail}
                onChangeText={setStudentEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                keyboardType="email-address"
                editable={!pending}
              />
            ) : null}
          </View>

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
            {copy.submit}
          </SlayButton>

          {/* WP-2.5 adds the Google/Apple sign-in buttons here. */}

          <View style={styles.switchRow}>
            <SlayText variant="small" color={alpha.white50}>
              {copy.switchText}{" "}
            </SlayText>
            <Link href={copy.switchHref}>
              <SlayText variant="small" weight="600" color={colors.cyan}>
                {copy.switchCta}
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
  title: {
    textAlign: "center",
  },
  fields: {
    gap: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  passwordLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roleRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
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
