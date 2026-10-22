import { Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { getMessages, type Locale } from "@slay/core";
import type { ProfileData } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayText } from "~/components/ui";
import { FeedbackButton } from "~/features/feedback";
import { LocalePicker } from "~/features/i18n";
import { PlacementTestCard } from "~/features/placement";
import { imageSource } from "~/lib/imageSource";
import { useLocalePreference, useStudentLocale } from "~/lib/locale";

import { LogoutButton } from "./LogoutButton";
import { ProfileLevelCard } from "./ProfileLevelCard";
import { ProfileUsernameCard } from "./ProfileUsernameCard";

export interface ProfileScreenProps extends ProfileData {
  /** Language for this screen's own chrome; defaults to the student's own choice. */
  locale?: Locale;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/**
 * Port of upstream's `profile/ProfileScreen.tsx` as the student page renders
 * it: the player's dressed snake as the avatar, their name and email, the
 * rename and level cards, the level test card, the language picker,
 * Feedback & Bugs, and Log Out.
 */
export function ProfileScreen({
  username,
  email,
  mascotImageUrl,
  level,
  availableLevels,
  latestPlacement,
  locale: localeOverride,
  refreshing = false,
  onRefresh,
}: ProfileScreenProps) {
  const studentLocale = useStudentLocale();
  const { choose } = useLocalePreference();
  const locale = localeOverride ?? studentLocale;
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

          <PlacementTestCard latest={latestPlacement} messages={messages} />

          <LocalePicker locale={locale} title={messages.languageTitle} hint={messages.languageHint} onChoose={choose} />

          <View style={styles.footer}>
            {/* Reporting a bug or sending an idea — reaches the admin console's inbox. */}
            <FeedbackButton />
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
