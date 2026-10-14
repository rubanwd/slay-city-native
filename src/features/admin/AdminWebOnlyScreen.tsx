import { useState } from "react";

import { alpha, colors } from "@slay/tokens";

import { AppContainer, ScrollScreen, Section } from "~/components/layout";
import { SlayButton, SlayText } from "~/components/ui";
import { signOut } from "~/features/auth/actions";

/**
 * Lands here when a signed-in `admin` profile opens the native app (WP-2.6) —
 * there is no admin route group; the console stays web-only (AGENTS.md,
 * `docs/ROADMAP.md`). Signing out is the only action, so an admin who picked
 * up the wrong device can get back to a role the app actually supports.
 */
export default function AdminWebOnlyScreen() {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  }

  return (
    <ScrollScreen>
      <AppContainer edges={["top"]}>
        <Section py="lg">
          <SlayText variant="label" color={colors.neonPink}>
            Admin
          </SlayText>
          <SlayText variant="display">Use the web console</SlayText>
          <SlayText variant="body" color={alpha.white60}>
            The admin console isn&apos;t part of this app. Sign in at the SLAY
            CITY web app to manage levels, users and content.
          </SlayText>
        </Section>

        <Section py="sm">
          <SlayButton variant="ghost" onPress={handleSignOut} loading={signingOut}>
            Sign out
          </SlayButton>
        </Section>
      </AppContainer>
    </ScrollScreen>
  );
}
