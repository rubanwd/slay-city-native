import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import { completeAuthLink } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { AppContainer, Section } from "~/components/layout";
import { SlayButton, SlayText } from "~/components/ui";
import { isRecoveryLink, parseAuthCallbackUrl } from "~/lib/authRedirect";
import { supabase } from "~/lib/supabase";

/**
 * Resolves `slaycity://auth/callback` (built by `getAuthRedirectUrl` in
 * src/lib/authRedirect.ts) — the one redirect target every password-reset
 * email and OAuth flow is pointed at. The Supabase client has
 * `detectSessionInUrl: false` (src/lib/supabase.ts), so nothing else exchanges
 * the URL for a session; this screen is the only place that happens.
 *
 * Handles both a cold start and a warm start (AC4). `Linking.getLinkingURL()`
 * (not `getInitialURL()`) is read synchronously on mount: by the time this
 * screen mounts on a warm start, expo-router's own linking integration has
 * already navigated here and the `url` event that caused it has already
 * fired — a listener registered in this screen's effect would miss it.
 * `getLinkingURL()` has no such gap: it is a synchronous native-side cache of
 * the most recently received URL, covering the launch URL on a cold start too.
 * The `url` event is still subscribed to for a second link arriving while this
 * screen stays mounted.
 *
 * After any other link it goes to `/`, and the route guard takes the user on
 * to their role's home — or onboarding, for a first sign-in.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handledUrls = useRef(new Set<string>());

  const handleUrl = useCallback(
    async (url: string | null) => {
      if (!url || handledUrls.current.has(url)) {
        return;
      }
      handledUrls.current.add(url);

      const link = parseAuthCallbackUrl(url);
      const recovery = isRecoveryLink(link);

      const result = await completeAuthLink(supabase, link);
      if (result.status === "error") {
        setErrorMessage(result.error);
        return;
      }

      router.replace(recovery ? "/auth/reset-password" : "/");
    },
    [router],
  );

  useEffect(() => {
    Promise.resolve(Linking.getLinkingURL()).then(handleUrl);
    const subscription = Linking.addEventListener("url", (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, [handleUrl]);

  if (errorMessage) {
    return (
      <AppContainer style={styles.center}>
        <Section py="sm" style={styles.column}>
          <SlayText variant="h2" style={styles.centerText}>
            Link expired
          </SlayText>
          <SlayText variant="body" color={alpha.white60} style={styles.centerText}>
            {errorMessage}
          </SlayText>
          <SlayButton onPress={() => router.replace("/auth/login")}>Back to login</SlayButton>
        </Section>
      </AppContainer>
    );
  }

  return (
    <AppContainer style={styles.center}>
      <ActivityIndicator size="large" color={colors.white} />
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  column: {
    alignItems: "center",
  },
  centerText: {
    textAlign: "center",
  },
});
