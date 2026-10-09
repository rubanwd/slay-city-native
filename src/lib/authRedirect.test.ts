import { describe, expect, it, vi } from "vitest";

import { getAuthRedirectUrl, isRecoveryLink, parseAuthCallbackUrl } from "./authRedirect";

/**
 * `expo-linking` transitively imports `react-native`, which is Flow-typed and
 * cannot be parsed outside the `components` (jsdom) vitest project — see
 * vitest.config.mts. This lib test runs under the `packages` (node) project,
 * so `expo-linking` is mocked with a faithful re-implementation of
 * `parse`/`createURL` using the same `URL`/`URLSearchParams` globals the real
 * one uses internally (see node_modules/expo-linking/build/createURL.js).
 */
vi.mock("expo-linking", () => ({
  createURL: (path: string) => `slaycity:///${path}`,
  parse: (url: string) => {
    if (typeof url !== "string" || !url) {
      throw new Error("Invalid URL: cannot be empty");
    }
    const queryParams: Record<string, string> = {};
    try {
      const parsed = new URL(url);
      parsed.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });
      return { scheme: parsed.protocol.replace(/:$/, ""), hostname: parsed.hostname || null, path: parsed.pathname, queryParams };
    } catch {
      return { scheme: null, hostname: null, path: url, queryParams };
    }
  },
}));

describe("getAuthRedirectUrl", () => {
  it("builds the slaycity:// auth callback URL", () => {
    expect(getAuthRedirectUrl()).toBe("slaycity:///auth/callback");
  });
});

describe("parseAuthCallbackUrl", () => {
  it("parses a PKCE code", () => {
    const link = parseAuthCallbackUrl("slaycity://auth/callback?code=34e770dd-9ff9-416c-87fa-43b31d7ef225");

    expect(link).toEqual({ kind: "code", code: "34e770dd-9ff9-416c-87fa-43b31d7ef225", otpType: "" });
    expect(isRecoveryLink(link)).toBe(false);
  });

  it("parses a recovery code (type=recovery alongside the PKCE code)", () => {
    const link = parseAuthCallbackUrl("slaycity://auth/callback?code=abc123&type=recovery");

    expect(link).toEqual({ kind: "code", code: "abc123", otpType: "recovery" });
    expect(isRecoveryLink(link)).toBe(true);
  });

  it("parses a recovery token_hash", () => {
    const link = parseAuthCallbackUrl("slaycity://auth/callback?token_hash=pkce_abc123&type=recovery");

    expect(link).toEqual({ kind: "otp", tokenHash: "pkce_abc123", otpType: "recovery" });
    expect(isRecoveryLink(link)).toBe(true);
  });

  it("parses a non-recovery token_hash (e.g. signup confirmation) as not a recovery link", () => {
    const link = parseAuthCallbackUrl("slaycity://auth/callback?token_hash=pkce_abc123&type=signup");

    expect(link).toEqual({ kind: "otp", tokenHash: "pkce_abc123", otpType: "signup" });
    expect(isRecoveryLink(link)).toBe(false);
  });

  it("parses implicit-grant access/refresh tokens from the URL fragment", () => {
    const link = parseAuthCallbackUrl(
      "slaycity://auth/callback#access_token=at_123&refresh_token=rt_456&type=recovery&expires_in=3600",
    );

    expect(link).toEqual({ kind: "tokens", accessToken: "at_123", refreshToken: "rt_456", otpType: "recovery" });
    expect(isRecoveryLink(link)).toBe(true);
  });

  it("parses an error parameter", () => {
    const link = parseAuthCallbackUrl(
      "slaycity://auth/callback?error=access_denied&error_description=Email+link+is+invalid+or+has+expired",
    );

    expect(link).toEqual({
      kind: "error",
      error: "access_denied",
      errorDescription: "Email link is invalid or has expired",
    });
    expect(isRecoveryLink(link)).toBe(false);
  });

  it("parses an error parameter carried in the URL fragment", () => {
    const link = parseAuthCallbackUrl(
      "slaycity://auth/callback#error=access_denied&error_description=Email+link+is+invalid+or+has+expired",
    );

    expect(link).toEqual({
      kind: "error",
      error: "access_denied",
      errorDescription: "Email link is invalid or has expired",
    });
  });

  it("treats garbage input as invalid", () => {
    expect(parseAuthCallbackUrl("not a url at all")).toEqual({ kind: "invalid" });
  });

  it("treats an empty string as invalid", () => {
    expect(parseAuthCallbackUrl("")).toEqual({ kind: "invalid" });
  });

  it("treats a bare scheme with no recognised parameters as invalid", () => {
    expect(parseAuthCallbackUrl("slaycity://auth/callback")).toEqual({ kind: "invalid" });
  });
});
