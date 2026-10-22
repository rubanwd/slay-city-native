import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { normalizeUsername, USERNAME_MAX_LENGTH, type UsernameCardMessages, type UsernameProblem } from "@slay/core";
import { changeMyUsername } from "@slay/data";
import { colors } from "@slay/tokens";

import { SlayButton, SlayInput, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

import { cardStyle, ProfileCardHeader } from "./ProfileCardHeader";
import { PROFILE_QUERY_KEY } from "./queryKeys";

export interface ProfileUsernameCardProps {
  /** The name on the profile row right now. */
  username: string | null;
  /** The screen's own message namespace, so the card speaks its language. */
  messages: UsernameCardMessages;
}

/**
 * Port of upstream's `profile/ProfileUsernameCard.tsx`: lets a signed-in user
 * rename themselves. The name is chosen in a hurry at signup, so typos and
 * outgrown nicknames are common; this is the only way to fix one without a new
 * account. Validation is core's `checkUsername`, run again by
 * `changeMyUsername` before the write and by the database's unique index.
 *
 * Collapsed by default: the card shows the current name and a Change button,
 * so the profile keeps a single obvious primary action.
 */
export function ProfileUsernameCard({ username, messages }: ProfileUsernameCardProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(username ?? "");
  const [problem, setProblem] = useState<UsernameProblem | null>(null);
  const [saved, setSaved] = useState(false);
  // The server-confirmed name, so the card never flashes the old one while the profile refetches.
  const [current, setCurrent] = useState(username ?? "");

  const save = useMutation({
    mutationFn: (next: string) => changeMyUsername(supabase, next),
    onSuccess: (result) => {
      if (!result.ok) {
        setProblem(result.problem);
        return;
      }
      setCurrent(result.username);
      setValue(result.username);
      setProblem(null);
      setSaved(true);
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY] });
    },
    onError: () => setProblem("unknown"),
  });
  const pending = save.isPending;
  const unchanged = normalizeUsername(value) === current;

  const openEditor = () => {
    setValue(current);
    setProblem(null);
    setSaved(false);
    setOpen(true);
  };

  const submit = () => {
    if (pending || unchanged) return;
    save.mutate(value);
  };

  return (
    <View style={cardStyle}>
      <ProfileCardHeader
        title={messages.usernameTitle}
        value={current}
        toggle={{
          label: open ? messages.usernameCancel : messages.usernameChange,
          onPress: () => (open ? setOpen(false) : openEditor()),
          disabled: pending,
          expanded: open,
        }}
      />

      {open ? (
        <View style={styles.form}>
          <SlayInput
            value={value}
            onChangeText={(text) => {
              setValue(text);
              setProblem(null);
            }}
            accessibilityLabel={messages.usernameTitle}
            hint={messages.usernameHint}
            editable={!pending}
            autoFocus
            // A name, not prose: nothing should "fix" it, and capitals are the player's call.
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            maxLength={USERNAME_MAX_LENGTH}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <SlayButton variant="green" size="sm" loading={pending} disabled={unchanged} onPress={submit}>
            {pending ? messages.usernameSaving : messages.usernameSave}
          </SlayButton>
        </View>
      ) : null}

      {saved && !open ? (
        <SlayText variant="small" weight="600" color={colors.limeGreen} accessibilityLiveRegion="polite">
          {messages.usernameSaved}
        </SlayText>
      ) : null}
      {problem ? (
        <SlayText variant="small" weight="600" color={colors.neonPink} accessibilityRole="alert">
          {messages.usernameErrors[problem]}
        </SlayText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8 },
});

