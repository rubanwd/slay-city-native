import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";

import { getAuthRedirectUrl, parseAuthCallbackUrl } from "~/lib/authRedirect";
import { supabase } from "~/lib/supabase";

import type { AuthState } from "./actions";

/**
 * Client-side counterparts to the web's `signInWithGoogle` server action
 * (`src/features/auth/actions.ts` upstream). Neither call sets any role —
 * matching upstream's comment that "Google users carry no role flag" — so a
 * new OAuth account lands in the same no-role, student-by-default state as a
 * web Google signup. There is no `teacher` (or `admin`) option anywhere in
 * this flow, same as the password form's `SignupRole`.
 *
 * `AuthState`'s empty `{}` means "succeeded, nothing to show" everywhere else
 * in this feature — but an OAuth flow also has a third, silent outcome the
 * password form never does: the user backed out of the provider's screen.
 * `cancelled` keeps that distinct from success so a caller never navigates
 * away on a cancel (AC2).
 */
export type OAuthState = AuthState & { cancelled?: boolean };

/**
 * Google sign-in via Supabase's hosted OAuth flow, not
 * `expo-auth-session/providers/google` + a native `signInWithIdToken`. The
 * native-SDK route needs a separate Google Cloud OAuth client (and client ID)
 * per platform shipped in this app; the hosted-flow route needs none of that —
 * the Google provider is already configured once, server-side, on the same
 * Supabase project the web app's `signInWithGoogle` uses. `WebBrowser.
 * openAuthSessionAsync` opens the provider's consent screen and resolves with
 * the final `slaycity://auth/callback` redirect directly, so the exchange
 * happens right here — no detour through `app/(auth)/callback.tsx`, which
 * stays dedicated to links opened from outside the app (email).
 *
 * The shared client (`src/lib/supabase.ts`) sets no `flowType`, so auth-js
 * defaults to **implicit**: the redirect carries `access_token`/
 * `refresh_token` in the URL fragment (`kind: "tokens"`), not a PKCE `?code=`
 * — the same shape `app/(auth)/callback.tsx` already handles with
 * `setSession` for email links. A `code` can still turn up if the project's
 * flow is ever switched to PKCE, so it is handled too rather than assumed
 * away.
 */
export async function signInWithGoogle(): Promise<OAuthState> {
  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return { error: error?.message ?? "Could not start Google sign-in." };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "cancel" || result.type === "dismiss") {
    return { cancelled: true };
  }
  if (result.type !== "success" || !result.url) {
    return { error: "Could not complete Google sign-in." };
  }

  const link = parseAuthCallbackUrl(result.url);
  switch (link.kind) {
    case "error":
      return { error: link.errorDescription ?? link.error };
    case "tokens": {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
      });
      return sessionError ? { error: sessionError.message } : {};
    }
    case "code": {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(link.code);
      return exchangeError ? { error: exchangeError.message } : {};
    }
    default:
      return { error: "Could not complete Google sign-in." };
  }
}

/** Raw bytes, hex-encoded — passed to Supabase unhashed; Apple only ever sees its SHA-256. */
async function generateNonce(crypto: typeof import("expo-crypto"), byteLength = 32): Promise<string> {
  const bytes = await crypto.getRandomBytesAsync(byteLength);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isUserCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ERR_REQUEST_CANCELED"
  );
}

/**
 * Apple sign-in (WP-2.5, OD-2 — iOS only, behind `APPLE_SIGN_IN_ENABLED`).
 * Apple requires the nonce it signs to be the SHA-256 hex digest of a raw
 * value; Supabase's `signInWithIdToken` is then given that same raw value so
 * it can redo the hash and confirm it matches the one inside Apple's token.
 *
 * `expo-crypto` is imported lazily, only once this actually runs: its AES
 * submodule's web build pulls in the root `expo` package as a side effect,
 * which blows up under jsdom (component render tests, `expo start --web`) —
 * a path a real iOS build never takes, since Metro resolves the native
 * implementation there instead. Deferring the import means that only
 * matters if a test calls this function directly, not every time this
 * module — or a component that renders its button — is merely imported.
 */
export async function signInWithApple(): Promise<OAuthState> {
  try {
    const Crypto = await import("expo-crypto");
    const rawNonce = await generateNonce(Crypto);
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { error: "Apple did not return an identity token." };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
    });

    return error ? { error: error.message } : {};
  } catch (error) {
    if (isUserCancelled(error)) {
      return { cancelled: true };
    }
    return { error: "Could not complete Apple sign-in." };
  }
}
