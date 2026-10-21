import { StyleSheet } from "react-native";

import { alpha, colors } from "@slay/tokens";

import { AppContainer, Section } from "~/components/layout";
import { SlayText } from "~/components/ui";
import { SignOutButton } from "~/features/auth";

/**
 * Where a signed-in user without a profile lands, as upstream's middleware
 * sends them to `/onboarding`. WP-4.4 ports the real form (username, age,
 * level); once it creates the profile it invalidates the account query and the
 * route guard moves the student on to the map.
 */
export function OnboardingPlaceholder() {
  return (
    <AppContainer style={styles.center}>
      <Section py="sm">
        <SlayText variant="label" color={colors.neonPink}>
          Onboarding · placeholder
        </SlayText>
        <SlayText variant="h1">Finish setting up</SlayText>
        <SlayText variant="body" color={alpha.white60}>
          WP-4.4 adds the username, age and level form here.
        </SlayText>
        <SignOutButton />
      </Section>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    justifyContent: "center",
  },
});
