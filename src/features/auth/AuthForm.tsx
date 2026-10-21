import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { StyleSheet, View, type TextInput } from "react-native";

import { signIn, signUp, type AuthResult, type SignupRole } from "@slay/data";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayInput, SlayPressable, SlayText } from "~/components/ui";
import { getAuthRedirectUrl } from "~/lib/authRedirect";
import { supabase } from "~/lib/supabase";

import { AuthStatus, AuthTitle } from "./AuthScreen";
import { currentPasswordFieldProps, emailFieldProps, newPasswordFieldProps } from "./fieldProps";
import { TextLink } from "./TextLink";

export interface AuthFormProps {
  mode: "login" | "register";
  /**
   * Called once a session exists. Where to go next is the route guard's
   * call (`next`, or the role's home), so routes normally leave this out.
   */
  onSignedIn?: () => void;
  /** Pre-filled status message, e.g. after a password reset. */
  initialMessage?: string;
  /** Pre-filled error, e.g. after an expired reset link. */
  initialError?: string;
}

const COPY = {
  login: {
    lead: "Log ",
    accent: "In",
    submit: "Log In",
    switchText: "New to Slay City?",
    switchHref: "/auth/register",
    switchCta: "Create an account",
  },
  register: {
    lead: "Sign ",
    accent: "Up",
    submit: "Create Account",
    switchText: "Already have an account?",
    switchHref: "/auth/login",
    switchCta: "Log in",
  },
} as const;

const ROLE_OPTIONS: { value: SignupRole; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
];

/**
 * Port of upstream's `src/features/auth/AuthForm.tsx` — the login and
 * register forms, one component, same copy. The checks and the Supabase calls
 * live in `@slay/data` (`signIn`, `signUp`); this only collects the fields.
 *
 * Not ported yet: the "or — Continue with Google" button. It arrives with
 * Sign in with Apple in WP-2.5, because OD-2 requires the two side by side.
 */
export function AuthForm({ mode, onSignedIn, initialMessage, initialError }: AuthFormProps) {
  const isRegister = mode === "register";
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<SignupRole>("student");
  const [studentEmail, setStudentEmail] = useState("");

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const studentEmailRef = useRef<TextInput>(null);

  const submit = useMutation({
    mutationFn: (): Promise<AuthResult> =>
      isRegister
        ? signUp(supabase, { email, password, confirmPassword, role, studentEmail }, getAuthRedirectUrl())
        : signIn(supabase, { email, password }),
    onSuccess: (result) => {
      if (result.status === "signed-in") onSignedIn?.();
    },
  });

  const result = submit.data;
  const error =
    result?.status === "error" ? result.error : (submit.error?.message ?? (submit.isIdle ? initialError : undefined));
  const message = result?.status === "message" ? result.message : submit.isIdle ? initialMessage : undefined;

  const onSubmit = () => {
    if (!submit.isPending) submit.mutate();
  };

  const lastField = isRegister ? (role === "parent" ? "studentEmail" : "confirm") : "password";

  return (
    <View style={styles.form}>
      <AuthTitle lead={copy.lead} accent={copy.accent} />

      <View style={styles.fields}>
        <SlayInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          {...emailFieldProps}
        />

        <View>
          {!isRegister ? (
            <View style={styles.passwordLink}>
              <TextLink href="/auth/forgot-password">Forgot password?</TextLink>
            </View>
          ) : null}
          <SlayInput
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            returnKeyType={lastField === "password" ? "go" : "next"}
            submitBehavior={lastField === "password" ? "blurAndSubmit" : "submit"}
            onSubmitEditing={lastField === "password" ? onSubmit : () => confirmRef.current?.focus()}
            {...(isRegister ? newPasswordFieldProps : currentPasswordFieldProps)}
          />
        </View>

        {isRegister ? (
          <SlayInput
            ref={confirmRef}
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            returnKeyType={lastField === "confirm" ? "go" : "next"}
            submitBehavior={lastField === "confirm" ? "blurAndSubmit" : "submit"}
            onSubmitEditing={lastField === "confirm" ? onSubmit : () => studentEmailRef.current?.focus()}
            {...newPasswordFieldProps}
          />
        ) : null}

        {isRegister ? <RolePicker value={role} onChange={setRole} /> : null}

        {isRegister && role === "parent" ? (
          <SlayInput
            ref={studentEmailRef}
            label="Student's Email"
            value={studentEmail}
            onChangeText={setStudentEmail}
            hint="We'll link your student's account so you can follow their progress."
            returnKeyType="go"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={onSubmit}
            {...emailFieldProps}
            autoComplete="off"
            textContentType="none"
            placeholder="student@example.com"
          />
        ) : null}
      </View>

      <AuthStatus error={error} message={message} />

      <SlayButton variant="pink" size="lg" loading={submit.isPending} onPress={onSubmit}>
        {copy.submit}
      </SlayButton>

      <View style={styles.switchRow}>
        <SlayText variant="small" color={alpha.white50}>
          {copy.switchText}
        </SlayText>
        <TextLink href={copy.switchHref}>{copy.switchCta}</TextLink>
      </View>
    </View>
  );
}

function RolePicker({ value, onChange }: { value: SignupRole; onChange: (role: SignupRole) => void }) {
  return (
    <View>
      <SlayText variant="label" color={alpha.white50} style={styles.legend}>
        I am a
      </SlayText>
      <View accessibilityRole="radiogroup" style={styles.roleRow}>
        {ROLE_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <SlayPressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={[styles.roleOption, selected && styles.roleOptionSelected]}
            >
              <SlayText variant="small" weight="600" color={selected ? colors.white : alpha.white60} style={styles.roleLabel}>
                {option.label}
              </SlayText>
            </SlayPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    width: "100%",
    gap: 20,
  },
  fields: {
    gap: 12,
  },
  passwordLink: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 1,
  },
  legend: {
    marginBottom: 6,
  },
  roleRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleOption: {
    flex: 1,
    minHeight: 47,
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha.white20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  roleOptionSelected: {
    borderColor: colors.neonPink,
    backgroundColor: withAlpha(colors.neonPink, 0.1),
  },
  roleLabel: {
    textAlign: "center",
  },
  switchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
});
