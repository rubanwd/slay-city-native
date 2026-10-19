import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { requestPasswordReset } from "@slay/data";
import { alpha } from "@slay/tokens";

import { SlayButton, SlayInput, SlayText } from "~/components/ui";
import { getAuthRedirectUrl } from "~/lib/authRedirect";
import { supabase } from "~/lib/supabase";

import { AuthStatus, AuthTitle } from "./AuthScreen";
import { emailFieldProps } from "./fieldProps";
import { TextLink } from "./TextLink";

/**
 * Port of upstream's `src/features/auth/ForgotPasswordForm.tsx`. The emailed
 * link opens `slaycity://auth/callback`, which recognises the recovery session
 * and moves on to the reset screen.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");

  const submit = useMutation({
    mutationFn: () => requestPasswordReset(supabase, email, getAuthRedirectUrl()),
  });

  const result = submit.data;
  const onSubmit = () => {
    if (!submit.isPending) submit.mutate();
  };

  return (
    <View style={styles.form}>
      <AuthTitle lead="Reset " accent="Password" />

      <SlayText variant="small" color={alpha.white50} style={styles.center}>
        Enter the email on your account and we&apos;ll send you a link to reset your password.
      </SlayText>

      <SlayInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        returnKeyType="send"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={onSubmit}
        {...emailFieldProps}
      />

      <AuthStatus
        error={result?.status === "error" ? result.error : submit.error?.message}
        message={result?.status === "message" ? result.message : undefined}
      />

      <SlayButton variant="pink" size="lg" loading={submit.isPending} onPress={onSubmit}>
        Send Reset Link
      </SlayButton>

      <View style={styles.switchRow}>
        <SlayText variant="small" color={alpha.white50}>
          Remembered it?
        </SlayText>
        <TextLink href="/auth/login">Log in</TextLink>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    width: "100%",
    gap: 20,
  },
  center: {
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
