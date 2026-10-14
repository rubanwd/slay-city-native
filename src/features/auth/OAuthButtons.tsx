import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { alpha, radii } from "@slay/tokens";

import { GoogleIcon, SlayButton, SlayText } from "~/components/ui";
import { APPLE_SIGN_IN_ENABLED } from "~/lib/featureFlags";

import { signInWithApple, signInWithGoogle, type OAuthState } from "./oauth";

export interface OAuthButtonsProps {
  /** "Continue with Google" vs. "Sign up with Google" — matches upstream's per-mode copy. */
  googleLabel: string;
  disabled: boolean;
  onStart: () => void;
  onResult: (result: OAuthState) => void;
}

/**
 * The WP-2.5 OAuth slot in `AuthForm.tsx`: an "or" divider plus the Google and
 * (OD-2) Apple buttons, both wired through `src/features/auth/oauth.ts`.
 * Apple only renders on iOS with `APPLE_SIGN_IN_ENABLED` on — Guideline 4.8
 * requires it wherever Google appears, so it is never shown alone.
 */
export function OAuthButtons({ googleLabel, disabled, onStart, onResult }: OAuthButtonsProps) {
  const [pending, setPending] = useState<"google" | "apple" | null>(null);

  const run = async (provider: "google" | "apple", action: () => Promise<OAuthState>) => {
    onStart();
    setPending(provider);
    const result = await action();
    setPending(null);
    onResult(result);
  };

  const isDisabled = disabled || pending !== null;

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow} accessibilityElementsHidden importantForAccessibility="no">
        <View style={styles.dividerLine} />
        <SlayText variant="label" color={alpha.white40}>
          or
        </SlayText>
        <View style={styles.dividerLine} />
      </View>

      <SlayButton
        variant="ghost"
        size="lg"
        loading={pending === "google"}
        disabled={isDisabled}
        iconLeft={<GoogleIcon />}
        onPress={() => run("google", signInWithGoogle)}
      >
        {googleLabel}
      </SlayButton>

      {Platform.OS === "ios" && APPLE_SIGN_IN_ENABLED ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={radii.lg}
          style={styles.appleButton}
          onPress={() => run("apple", signInWithApple)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Matches the 20px gap between every other sibling in the form
    // (`AuthForm.tsx`'s `scrollContent`, upstream's `gap-5`) — only the
    // divider's own line/label/line row below uses a tighter gap.
    gap: 20,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: alpha.white15,
  },
  appleButton: {
    height: 64,
    width: "100%",
  },
});
