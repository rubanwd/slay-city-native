import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator } from "react-native";

import { getAvailableLevels } from "@slay/data";
import { colors } from "@slay/tokens";

import { AuthScreen } from "~/features/auth";
import { supabase } from "~/lib/supabase";

import { OnboardingForm } from "./OnboardingForm";

/**
 * `/onboarding`, where the route guard pins a signed-in user with no profile.
 * Loads the levels that have content (`available_knowledge_levels`), then the
 * form, in the same keyboard-aware frame as the auth screens.
 */
export function OnboardingScreen() {
  const levels = useQuery({ queryKey: ["levels", "available"], queryFn: () => getAvailableLevels(supabase) });

  return (
    <AuthScreen>
      {levels.isPending ? (
        <ActivityIndicator size="large" color={colors.limeGreen} accessibilityLabel="Loading levels…" />
      ) : (
        <OnboardingForm levels={levels.data ?? []} />
      )}
    </AuthScreen>
  );
}
