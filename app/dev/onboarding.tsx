import { Redirect } from "expo-router";

import { AuthScreen } from "~/features/auth";
import { OnboardingForm } from "~/features/onboarding";

/**
 * The onboarding form with two open levels and no backend — submitting shows
 * the form's error state. Dev-only.
 */
export default function OnboardingPreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <AuthScreen>
      <OnboardingForm levels={["beginner", "elementary"]} />
    </AuthScreen>
  );
}
