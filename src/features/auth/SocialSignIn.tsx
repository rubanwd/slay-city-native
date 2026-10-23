import { useMutation, useQuery } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Platform, StyleSheet, View } from "react-native";

import { completeAuthLink, signInWithApple, startGoogleSignIn, type AuthResult } from "@slay/data";
import { alpha, radii } from "@slay/tokens";

import { GoogleIcon, SlayButton, SlayText } from "~/components/ui";
import { getAuthRedirectUrl, parseAuthCallbackUrl } from "~/lib/authRedirect";
import { supabase } from "~/lib/supabase";

import { AuthStatus } from "./AuthScreen";

/**
 * Opens Google's consent page in a browser sheet and finishes with the URL it
 * redirects back to. On Android that redirect also reaches the app as a deep
 * link, so app/auth/callback.tsx may receive the same tokens — `setSession`
 * with them twice is harmless, and either way the route guard moves on.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  const redirectTo = getAuthRedirectUrl();
  const start = await startGoogleSignIn(supabase, redirectTo);
  if ("error" in start) {
    return { status: "error", error: start.error };
  }

  const result = await WebBrowser.openAuthSessionAsync(start.url, redirectTo);
  if (result.type !== "success") {
    return { status: "cancelled" };
  }
  return completeAuthLink(supabase, parseAuthCallbackUrl(result.url));
}

/**
 * The native Sign in with Apple sheet. Apple gets the SHA-256 of a one-time
 * nonce and puts it in the identity token; Supabase gets the raw nonce and
 * checks the two match.
 */
export async function signInWithAppleSheet(): Promise<AuthResult> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") {
      return { status: "cancelled" };
    }
    throw error;
  }

  if (!credential.identityToken) {
    return { status: "error", error: "Sign in with Apple did not return an identity token." };
  }
  return signInWithApple(supabase, credential.identityToken, rawNonce);
}

/**
 * The "or" divider and the social buttons under the login and register forms
 * (WP-2.5). Google everywhere, as on the web; Sign in with Apple as well on
 * iOS, first and at the same size, as OD-2 and App Store Guideline 4.8
 * require. Android needs no Apple button.
 *
 * Backing out of either sheet leaves the form exactly as it was (AC2). A
 * successful sign-in needs no callback: the session changes and the route
 * guard takes the user on.
 */
export function SocialSignIn({ mode }: { mode: "login" | "register" }) {
  const appleAvailable = useQuery({
    queryKey: ["apple-authentication-available"],
    queryFn: () => AppleAuthentication.isAvailableAsync(),
    enabled: Platform.OS === "ios",
    staleTime: Infinity,
  });

  const google = useMutation({ mutationFn: signInWithGoogle });
  const apple = useMutation({ mutationFn: signInWithAppleSheet });
  const busy = google.isPending || apple.isPending;

  const last = apple.submittedAt > google.submittedAt ? apple : google;
  const error = last.data?.status === "error" ? last.data.error : last.error?.message;

  return (
    <View style={styles.wrap}>
      <View style={styles.divider} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={styles.rule} />
        <SlayText variant="label" color={alpha.white50}>
          or
        </SlayText>
        <View style={styles.rule} />
      </View>

      {appleAvailable.data ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            mode === "register"
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          }
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={radii.lg}
          style={styles.appleButton}
          onPress={() => {
            if (!busy) apple.mutate();
          }}
        />
      ) : null}

      <SlayButton
        variant="ghost"
        size="lg"
        iconLeft={<GoogleIcon />}
        loading={google.isPending}
        disabled={apple.isPending}
        onPress={() => google.mutate()}
      >
        {mode === "register" ? "Sign up with Google" : "Continue with Google"}
      </SlayButton>

      <AuthStatus error={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: alpha.white15,
  },
  appleButton: {
    width: "100%",
    // The same height as the `lg` Google button beside it — no less prominent (OD-2).
    height: 64,
  },
});
