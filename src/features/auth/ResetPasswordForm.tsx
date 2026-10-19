import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { StyleSheet, View, type TextInput } from "react-native";

import { updatePassword } from "@slay/data";

import { SlayButton, SlayInput } from "~/components/ui";
import { supabase } from "~/lib/supabase";

import { AuthStatus, AuthTitle } from "./AuthScreen";
import { newPasswordFieldProps } from "./fieldProps";

/**
 * Port of upstream's `src/features/auth/ResetPasswordForm.tsx`. Only reachable
 * with the recovery session the reset link creates — the route checks that.
 * On success the session is signed out and `onUpdated` takes the user back to
 * log in with the new password.
 */
export function ResetPasswordForm({ onUpdated }: { onUpdated: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const confirmRef = useRef<TextInput>(null);

  const submit = useMutation({
    mutationFn: () => updatePassword(supabase, { password, confirmPassword }),
    onSuccess: (result) => {
      if (result.status === "password-updated") onUpdated();
    },
  });

  const result = submit.data;
  const onSubmit = () => {
    if (!submit.isPending) submit.mutate();
  };

  return (
    <View style={styles.form}>
      <AuthTitle lead="New " accent="Password" />

      <View style={styles.fields}>
        <SlayInput
          label="New Password"
          value={password}
          onChangeText={setPassword}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
          {...newPasswordFieldProps}
        />
        <SlayInput
          ref={confirmRef}
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          returnKeyType="go"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={onSubmit}
          {...newPasswordFieldProps}
        />
      </View>

      <AuthStatus error={result?.status === "error" ? result.error : submit.error?.message} />

      <SlayButton variant="pink" size="lg" loading={submit.isPending} onPress={onSubmit}>
        Update Password
      </SlayButton>
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
});
