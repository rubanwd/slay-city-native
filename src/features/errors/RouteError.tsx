import { Image } from "expo-image";
import { useRouter, type ErrorBoundaryProps } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { Locale } from "@slay/core";
import { alpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayText } from "~/components/ui";
import { reportError } from "~/lib/errorReporting";

/**
 * The words. Native-only — the web has no error screen of its own, so
 * `@slay/core`'s messages have none — translated here in the same three
 * languages as the rest of the chrome.
 */
const STRINGS: Record<Locale, { title: string; body: string; retry: string; home: string }> = {
  en: {
    title: "Something went wrong",
    body: "This screen hit a snag. Try again, or go home and come back to it.",
    retry: "Try again",
    home: "Go home",
  },
  uk: {
    title: "Щось пішло не так",
    body: "Цей екран дав збій. Спробуйте ще раз або поверніться на головну.",
    retry: "Спробувати ще",
    home: "На головну",
  },
  ru: {
    title: "Что-то пошло не так",
    body: "Этот экран дал сбой. Попробуйте ещё раз или вернитесь на главную.",
    retry: "Попробовать ещё",
    home: "На главную",
  },
};

export interface RouteErrorProps extends ErrorBoundaryProps {
  /** Which route group caught it — sent with the report. */
  where: string;
  locale?: Locale;
}

/**
 * What a route group shows instead of a crashed screen (WP-6.7): the snake,
 * a plain apology, Try again (re-renders the route) and Go home. The error is
 * reported once, when the screen appears.
 */
export function RouteError({ error, retry, where, locale = "en" }: RouteErrorProps) {
  const router = useRouter();
  const strings = STRINGS[locale];
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    reportError(error, { where });
  }, [error, where]);

  return (
    <AppContainer style={styles.center}>
      <View style={styles.body} accessibilityRole="alert">
        <Image source={require("../../../assets/mascot/slay-base.webp")} style={styles.mascot} contentFit="contain" />
        <SlayText variant="h2" weight="900" accessibilityRole="header" style={styles.text}>
          {strings.title}
        </SlayText>
        <SlayText variant="body" color={alpha.white70} style={styles.text}>
          {strings.body}
        </SlayText>
      </View>
      <View style={styles.actions}>
        <SlayButton
          variant="green"
          size="lg"
          loading={retrying}
          onPress={() => {
            setRetrying(true);
            void retry().finally(() => setRetrying(false));
          }}
        >
          {strings.retry}
        </SlayButton>
        <SlayButton variant="ghost" onPress={() => router.replace("/")}>
          {strings.home}
        </SlayButton>
      </View>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: "center", gap: 32 },
  body: { alignItems: "center", gap: 12 },
  mascot: { width: 96, height: 96, opacity: 0.8 },
  text: { textAlign: "center" },
  actions: { gap: 12 },
});
