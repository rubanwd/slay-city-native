import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { StyleSheet, View, type TextInput } from "react-native";

import { MAX_AGE, MIN_AGE, resolveSelectableLevel, USERNAME_MAX_LENGTH } from "@slay/core";
import type { KnowledgeLevel } from "@slay/core/types";
import { createProfile, signOut } from "@slay/data";
import { alpha, radii } from "@slay/tokens";

import { SlayButton, SlayInput, SlayPressable, SlayText } from "~/components/ui";
import { ACCOUNT_QUERY_KEY, AuthStatus, AuthTitle } from "~/features/auth";
import { LevelPicker, LockedLevelsNote } from "~/features/levels";
import { supabase } from "~/lib/supabase";

export interface OnboardingFormProps {
  /** Levels that already have content — the only ones a student may start on. */
  levels: readonly KnowledgeLevel[];
}

/**
 * Port of upstream's `onboarding/OnboardingForm.tsx`: a new student's name,
 * optional age and starting level. `createProfile` runs upstream's checks and
 * `create_my_profile`; on success the account refetches and the route guard
 * moves the student on to `roleHome()` — and, now that they have a profile,
 * never lets them back here.
 */
export function OnboardingForm({ levels }: OnboardingFormProps) {
  const queryClient = useQueryClient();
  const ageField = useRef<TextInput>(null);
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  // Pre-selects the first available level so the student can just go, while still being able to change it.
  const [level, setLevel] = useState<KnowledgeLevel | null>(() => resolveSelectableLevel(levels, null));

  const create = useMutation({
    mutationFn: () => createProfile(supabase, { username, age, level }),
    onSuccess: async (result) => {
      if (!result.ok) return;
      // Keep the button busy until the guard has the new account and redirects.
      await queryClient.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] });
    },
  });
  const leave = useMutation({ mutationFn: () => signOut(supabase) });
  const error = create.data && !create.data.ok ? create.data.error : create.error?.message;

  const submit = () => {
    if (!create.isPending) create.mutate();
  };

  return (
    <View style={styles.form}>
      <AuthTitle lead="Create Your " accent="Profile" />

      <SlayInput
        label="Username"
        placeholder="Enter your name"
        value={username}
        onChangeText={setUsername}
        maxLength={USERNAME_MAX_LENGTH}
        // Players type their real first name: capitalise it, but never "correct" it.
        autoCapitalize="words"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => ageField.current?.focus()}
      />

      <SlayInput
        ref={ageField}
        label="Age (optional)"
        placeholder={`${MIN_AGE}-${MAX_AGE}`}
        value={age}
        onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        maxLength={2}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
      />

      <View style={styles.levels}>
        <SlayText variant="label" color={alpha.white50}>
          Level
        </SlayText>
        {levels.length === 0 ? (
          <View style={styles.none}>
            <SlayText variant="small" color={alpha.white50}>
              No levels are open yet — you&apos;ll be able to pick one as soon as the city has content.
            </SlayText>
          </View>
        ) : (
          <>
            <LevelPicker levels={levels} value={level} onChange={setLevel} disabled={create.isPending} />
            <LockedLevelsNote available={levels} />
          </>
        )}
      </View>

      <AuthStatus error={error} />

      <SlayButton variant="green" size="lg" loading={create.isPending} onPress={submit}>
        Enter the City →
      </SlayButton>

      {/* A profile-less user is pinned here by the route guard, so this is the only way back to login. */}
      <SlayPressable
        accessibilityRole="button"
        disabled={leave.isPending}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        onPress={() => leave.mutate()}
        style={styles.leave}
      >
        <SlayText variant="small" color={alpha.white40} style={styles.underline}>
          {leave.isPending ? "Signing out…" : "Not you? Log out"}
        </SlayText>
      </SlayPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: "100%", gap: 24 },
  levels: { gap: 8 },
  none: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha.white15,
    backgroundColor: alpha.white5,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leave: { alignSelf: "center" },
  underline: { textDecorationLine: "underline" },
});
