import * as Linking from "expo-linking";

/**
 * Every auth email and OAuth redirect should point here — the one shape
 * Supabase's redirect allow-list (SCN-62) was given: `slaycity://auth/callback`.
 * Centralised so `resetPasswordForEmail`/`signInWithOAuth` call sites never
 * hand-build the scheme and silently drift from the allow-list.
 */
export function getAuthRedirectUrl(): string {
  return Linking.createURL("auth/callback");
}

export type AuthCallbackLink =
  | { kind: "code"; code: string; otpType: string }
  | { kind: "otp"; tokenHash: string; otpType: string }
  | { kind: "tokens"; accessToken: string; refreshToken: string; otpType: string }
  | { kind: "error"; error: string; errorDescription: string | null }
  | { kind: "invalid" };

/**
 * True for a link whose `type` (query string or fragment) is `recovery`,
 * whichever of the three shapes below carried it.
 */
export function isRecoveryLink(link: AuthCallbackLink): boolean {
  return link.kind !== "error" && link.kind !== "invalid" && link.otpType === "recovery";
}

/**
 * Supabase puts the PKCE `code` and the `token_hash`/`type` pair in the query
 * string, but the older implicit-grant `access_token`/`refresh_token` in the
 * URL fragment. `Linking.parse` only reads the query string, so the fragment
 * is parsed separately here — it is never silently dropped.
 */
export function parseAuthCallbackUrl(url: string): AuthCallbackLink {
  let queryParams: Linking.ParsedURL["queryParams"] = null;
  try {
    queryParams = Linking.parse(url).queryParams;
  } catch {
    return { kind: "invalid" };
  }

  const param = (key: string): string | undefined => {
    const value = queryParams?.[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const otpType = param("type") ?? "";

  const error = param("error");
  if (error) {
    return { kind: "error", error, errorDescription: param("error_description") ?? null };
  }

  const code = param("code");
  if (code) {
    return { kind: "code", code, otpType };
  }

  const tokenHash = param("token_hash");
  if (tokenHash) {
    return { kind: "otp", tokenHash, otpType };
  }

  const fragment = parseFragmentParams(url);
  if (fragment.error) {
    return { kind: "error", error: fragment.error, errorDescription: fragment.error_description ?? null };
  }
  if (fragment.access_token && fragment.refresh_token) {
    return {
      kind: "tokens",
      accessToken: fragment.access_token,
      refreshToken: fragment.refresh_token,
      otpType: fragment.type ?? "",
    };
  }

  return { kind: "invalid" };
}

function parseFragmentParams(url: string): Record<string, string> {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) {
    return {};
  }
  return Object.fromEntries(new URLSearchParams(url.slice(hashIndex + 1)).entries());
}
