import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";

import { getMessages, KNOWLEDGE_LEVEL_LABELS, LOCALE_LABELS, type Locale } from "@slay/core";
import type { ParentProfileData } from "@slay/data";
import { alpha, colors, radii } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayText } from "~/components/ui";
import { LocalePicker } from "~/features/i18n";
import { HapticsCard, LogoutButton, ProfileUsernameCard } from "~/features/profile";

export interface ParentProfileScreenProps extends ParentProfileData {
  /** The console's language, and where it came from. */
  locale: Locale;
  manualLocale: boolean;
  detectedLocale: Locale;
  onChooseLocale: (value: Locale | null) => Promise<void> | void;
}

/**
 * Port of upstream's `parent/ParentProfileScreen.tsx`: the parent's own
 * account. Smaller than the student's — no look to wear, no level of their
 * own (the student's, shown read-only). What a parent sets is their name and
 * the console's language, with "Automatic" following the phone.
 */
export function ParentProfileScreen({ username, email, student, locale, manualLocale, detectedLocale, onChooseLocale }: ParentProfileScreenProps) {
  const messages = getMessages(locale);

  return (
    <AppContainer edges={["top"]} flush>
      <View style={styles.header}>
        <SlayText variant="h3" weight="700" accessibilityRole="header">
          {messages.profile.title}
        </SlayText>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.identity}>
            {username ? (
              <SlayText variant="h3" weight="900" style={styles.center}>
                {username}
              </SlayText>
            ) : null}
            <SlayText variant="small" color={alpha.white50} style={styles.center}>
              {email ?? messages.profile.signedIn}
            </SlayText>
            <View style={styles.role}>
              <SlayText variant="label" weight="700" color={alpha.white60}>
                {messages.profile.roleLabel}
              </SlayText>
            </View>
          </View>

          <ProfileUsernameCard username={username} messages={messages.profile} />

          <LocalePicker
            locale={locale}
            title={messages.profile.languageTitle}
            hint={messages.profile.languageHint}
            onChoose={onChooseLocale}
            auto={{
              label: messages.profile.languageAuto,
              selected: !manualLocale,
              hint: messages.profile.languageAutoHint(LOCALE_LABELS[detectedLocale]),
            }}
          />

          <HapticsCard locale={locale} />

          <View style={styles.card} accessibilityLabel={messages.profile.studentTitle}>
            <SlayText variant="label" color={alpha.white50} accessibilityRole="header">
              {messages.profile.studentTitle}
            </SlayText>
            {student ? (
              <>
                <SlayText variant="bodyStrong">{student.username ?? messages.dashboard.yourStudent}</SlayText>
                <SlayText variant="small" color={alpha.white60}>
                  {messages.dashboard.englishLevel}:{" "}
                  <SlayText variant="small" weight="700" color={alpha.white80}>
                    {KNOWLEDGE_LEVEL_LABELS[student.level]}
                  </SlayText>
                </SlayText>
                <SlayText variant="small" color={alpha.white50}>
                  {messages.profile.studentLevelHint}
                </SlayText>
              </>
            ) : (
              <SlayText variant="small" color={alpha.white50}>
                {messages.profile.studentNone}
              </SlayText>
            )}
          </View>

          <View style={styles.footer}>
            <LogoutButton label={messages.common.logOut} pendingLabel={messages.common.loggingOut} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: alpha.white10 },
  page: { flexGrow: 1, gap: 24, paddingHorizontal: 24, paddingVertical: 32 },
  identity: { alignItems: "center", gap: 4 },
  center: { textAlign: "center" },
  role: { marginTop: 4, borderRadius: 999, borderWidth: 1, borderColor: alpha.white15, paddingHorizontal: 12, paddingVertical: 4 },
  card: { gap: 4, borderRadius: radii.lg, borderWidth: 1, borderColor: alpha.white10, backgroundColor: colors.surface, padding: 16 },
  footer: { marginTop: "auto" },
});
