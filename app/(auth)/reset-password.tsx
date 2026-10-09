import { Redirect } from "expo-router";

import { alpha, colors } from "@slay/tokens";

import { AppContainer, Section } from "~/components/layout";
import { SlayText } from "~/components/ui";
import { useSession } from "~/hooks/useSession";

/**
 * Landing screen for a recovery deep link (app/(auth)/callback.tsx), once
 * `verifyOtp`/`setSession` has produced a valid session for the user named in
 * the reset email.
 *
 * WP-2.2 replaces this placeholder body with the real "choose a new
 * password" form — that work package has not landed yet, so this screen only
 * proves the handoff from the callback lands here with a session attached.
 * Without a session (e.g. this route opened directly, not via the callback)
 * there is nothing to reset, so it bounces to `/`.
 */
export default function ResetPasswordScreen() {
  const { session, isLoading } = useSession();

  if (!isLoading && !session) {
    return <Redirect href="/" />;
  }

  return (
    <AppContainer edges={["top"]} style={{ justifyContent: "center" }}>
      <Section py="sm">
        <SlayText variant="label" color={colors.neonPink}>
          Password reset
        </SlayText>
        <SlayText variant="h1">Choose a new password</SlayText>
        <SlayText variant="body" color={alpha.white60}>
          WP-2.2 adds the real form here. Your reset link is valid — this placeholder just confirms it.
        </SlayText>
      </Section>
    </AppContainer>
  );
}
