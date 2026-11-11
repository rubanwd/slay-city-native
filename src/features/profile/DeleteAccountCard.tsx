import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import type { Messages } from "@slay/core";
import { deleteMyAccount } from "@slay/data";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

export interface DeleteAccountCardProps {
  messages: Messages["common"]["deleteAccount"];
}

/**
 * Port of upstream's `profile/DeleteAccountCard.tsx`: "Delete account" at the
 * foot of every profile — student, teacher and parent. Both stores require
 * in-app account deletion (Apple 5.1.1(v), Google Play's deletion policy).
 *
 * Two taps: the quiet link opens a confirmation that says what is lost, and
 * only "Delete forever" calls `delete_my_account`. On success the session is
 * dropped and the route guard takes the user to login, so there is no success
 * state here. The confirm button's label is dark on pink — white on
 * `neonPink` falls short of AA.
 */
export function DeleteAccountCard({ messages }: DeleteAccountCardProps) {
  const [confirming, setConfirming] = useState(false);
  const submit = useMutation({ mutationFn: () => deleteMyAccount(supabase) });
  const pending = submit.isPending;
  const problem = submit.data && !submit.data.ok ? submit.data.problem : submit.isError ? "unknown" : null;

  if (!confirming) {
    return (
      <SlayPressable
        accessibilityRole="button"
        accessibilityLabel={messages.button}
        onPress={() => {
          submit.reset();
          setConfirming(true);
        }}
        style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
      >
        <SlayText variant="small" weight="600" color={alpha.white50}>
          {messages.button}
        </SlayText>
      </SlayPressable>
    );
  }

  return (
    <View style={styles.card} accessibilityLabel={messages.confirmTitle}>
      <SlayText variant="bodyStrong" weight="700" accessibilityRole="header">
        {messages.confirmTitle}
      </SlayText>
      <SlayText variant="small" color={alpha.white70}>
        {messages.confirmBody}
      </SlayText>

      {problem ? (
        <SlayText variant="small" weight="600" color={colors.neonPink} accessibilityRole="alert">
          {messages.problems[problem]}
        </SlayText>
      ) : null}

      <View style={styles.actions}>
        <SlayPressable
          accessibilityRole="button"
          accessibilityLabel={messages.cancel}
          disabled={pending}
          onPress={() => setConfirming(false)}
          style={({ pressed }) => [styles.action, styles.cancel, pressed && styles.cancelPressed, pending && styles.disabled]}
        >
          <SlayText variant="small" weight="600" color={alpha.white70}>
            {messages.cancel}
          </SlayText>
        </SlayPressable>
        <SlayPressable
          accessibilityRole="button"
          accessibilityLabel={pending ? messages.deleting : messages.confirm}
          aria-busy={pending}
          disabled={pending}
          onPress={() => submit.mutate()}
          style={({ pressed }) => [styles.action, styles.confirm, pressed && styles.confirmPressed, pending && styles.disabled]}
        >
          {pending ? <ActivityIndicator size="small" color={colors.black} /> : null}
          <SlayText variant="small" weight="700" color={colors.black}>
            {pending ? messages.deleting : messages.confirm}
          </SlayText>
        </SlayPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { alignItems: "center", justifyContent: "center", minHeight: 44, borderRadius: radii.lg, paddingHorizontal: 16 },
  linkPressed: { backgroundColor: alpha.white5 },
  card: {
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.neonPink, 0.4),
    backgroundColor: withAlpha(colors.neonPink, 0.05),
    padding: 16,
  },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 12 },
  cancel: { borderWidth: 1, borderColor: alpha.white20 },
  cancelPressed: { backgroundColor: alpha.white10 },
  confirm: { backgroundColor: colors.neonPink },
  confirmPressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
