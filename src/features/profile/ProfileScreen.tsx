import { Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { DEFAULT_LOCALE, getMessages, type Locale } from "@slay/core";
import type { ProfileData } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

import { LogoutButton } from "./LogoutButton";
import { ProfileLevelCard } from "./ProfileLevelCard";
import { ProfileUsernameCard } from "./ProfileUsernameCard";

export interface ProfileScreenProps extends ProfileData {
  /** Language for this screen's own chrome; the picker itself arrives with WP-4.7. */
  locale?: Locale;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/**
 * Port of upstream's `profile/ProfileScreen.tsx` as the student page renders
 * it: the player's dressed snake as the avatar, their name and email, the
 * rename and level cards, and Log Out.
 *
 * Not here yet, each with its own package: the language picker (WP-4.7), the
 * Feedback button (WP-4.6), and the placement test card (the placement test is
 * not ported).
 */
export function ProfileScreen({
  username,
  email,
  mascotImageUrl,
  level,
  availableLevels,
  locale = DEFAULT_LOCALE,
  refreshing = false,
  onRefresh,
}: ProfileScreenProps) {
  const messages = getMessages(locale).student.profile;
  const mascot = imageSource(mascotImageUrl);

  return (
    <AppContainer edges={["top"]} flush>
      <View style={styles.header}>
        <SlayText variant="h3" weight="700" accessibilityRole="header">
          {messages.title}
        </SlayText>
      </View>
      {/* The rename field sits mid-screen; on iOS the page shrinks above the keyboard. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.limeGreen} /> : undefined
          }
        >
          <View style={styles.identity}>
            <View style={styles.avatar}>
              {mascot ? (
                <Image source={mascot} style={styles.mascot} resizeMode="contain" accessibilityLabel={messages.characterLabel} />
              ) : null}
            </View>
            <View style={styles.names}>
              {username ? (
                <SlayText variant="h3" weight="900" style={styles.center}>
                  {username}
                </SlayText>
              ) : null}
              <SlayText variant="small" color={alpha.white50} style={styles.center}>
                {email ?? messages.signedIn}
              </SlayText>
            </View>
          </View>

          <ProfileUsernameCard username={username} messages={messages} />
          {/* Keyed by the stored level, so a level changed elsewhere and refetched resets the card. */}
          <ProfileLevelCard key={level} current={level} available={availableLevels} locale={locale} />

          <View style={styles.footer}>
            <LogoutButton label={messages.logOut} pendingLabel={messages.loggingOut} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: alpha.white10,
  },
  page: { flexGrow: 1, gap: 32, paddingHorizontal: 24, paddingVertical: 32 },
  identity: { alignItems: "center", gap: 12 },
  avatar: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.limeGreen,
    backgroundColor: alpha.white5,
    padding: 8,
  },
  mascot: { width: "100%", height: "100%" },
  names: { alignItems: "center", gap: 4 },
  center: { textAlign: "center" },
  footer: { marginTop: "auto", gap: 12 },
});
