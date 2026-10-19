import { StyleSheet } from "react-native";

import { alpha, colors } from "@slay/tokens";

import { AppContainer, Section } from "~/components/layout";
import { SlayText } from "~/components/ui";

import { SignOutButton } from "./SignOutButton";

/**
 * Where `roleHome("admin")` lands. The admin console is web-only (CLAUDE.md),
 * so an admin who signs in on the phone is told where to go instead.
 */
export function AdminNotice() {
  return (
    <AppContainer style={styles.center}>
      <Section py="sm">
        <SlayText variant="label" color={colors.neonPink}>
          Admin
        </SlayText>
        <SlayText variant="h1">The admin console is on the web</SlayText>
        <SlayText variant="body" color={alpha.white60}>
          Content, users and settings are managed in the browser. Log in there with this account.
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
