import { describe, expect, it, vi } from "vitest";

import { signInWithApple, signInWithGoogle } from "./oauth";

const supabaseAuthMock = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
  signInWithIdToken: vi.fn(),
}));

const openAuthSessionAsyncMock = vi.hoisted(() => vi.fn());
const appleSignInAsyncMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/supabase", () => ({ supabase: { auth: supabaseAuthMock } }));

vi.mock("~/lib/authRedirect", async () => {
  const actual = await vi.importActual<typeof import("~/lib/authRedirect")>("~/lib/authRedirect");
  return { ...actual, getAuthRedirectUrl: () => "slaycity://auth/callback" };
});

vi.mock("expo-web-browser", () => ({ openAuthSessionAsync: openAuthSessionAsyncMock }));

vi.mock("expo-apple-authentication", () => ({
  signInAsync: appleSignInAsyncMock,
  AppleAuthenticationScope: { FULL_NAME: "full_name", EMAIL: "email" },
}));

vi.mock("expo-crypto", () => ({
  getRandomBytesAsync: vi.fn(async (byteLength: number) => new Uint8Array(byteLength)),
  digestStringAsync: vi.fn(async () => "hashed-nonce"),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));

describe("signInWithGoogle", () => {
  it("surfaces the error when Supabase cannot start the OAuth flow", async () => {
    supabaseAuthMock.signInWithOAuth.mockResolvedValueOnce({ data: { url: null }, error: { message: "Provider not enabled" } });

    const result = await signInWithGoogle();

    expect(result).toEqual({ error: "Provider not enabled" });
    expect(openAuthSessionAsyncMock).not.toHaveBeenCalled();
  });

  it("is silent when the user cancels the browser session (AC2)", async () => {
    supabaseAuthMock.signInWithOAuth.mockResolvedValueOnce({
      data: { url: "https://accounts.google.com/authorize" },
      error: null,
    });
    openAuthSessionAsyncMock.mockResolvedValueOnce({ type: "cancel" });

    const result = await signInWithGoogle();

    expect(result).toEqual({ cancelled: true });
    expect(supabaseAuthMock.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("sets the session from the redirect's fragment tokens on success (the shared client's implicit flow)", async () => {
    supabaseAuthMock.signInWithOAuth.mockResolvedValueOnce({
      data: { url: "https://accounts.google.com/authorize" },
      error: null,
    });
    openAuthSessionAsyncMock.mockResolvedValueOnce({
      type: "success",
      url: "slaycity://auth/callback#access_token=at123&refresh_token=rt456&type=",
    });
    supabaseAuthMock.setSession.mockResolvedValueOnce({ error: null });

    const result = await signInWithGoogle();

    expect(supabaseAuthMock.setSession).toHaveBeenCalledWith({
      access_token: "at123",
      refresh_token: "rt456",
    });
    expect(supabaseAuthMock.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it("still exchanges a PKCE code for a session if the redirect ever carries one", async () => {
    supabaseAuthMock.signInWithOAuth.mockResolvedValueOnce({
      data: { url: "https://accounts.google.com/authorize" },
      error: null,
    });
    openAuthSessionAsyncMock.mockResolvedValueOnce({
      type: "success",
      url: "slaycity://auth/callback?code=abc123",
    });
    supabaseAuthMock.exchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const result = await signInWithGoogle();

    expect(supabaseAuthMock.exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(result).toEqual({});
  });

  it("surfaces the provider's error from the redirect", async () => {
    supabaseAuthMock.signInWithOAuth.mockResolvedValueOnce({
      data: { url: "https://accounts.google.com/authorize" },
      error: null,
    });
    openAuthSessionAsyncMock.mockResolvedValueOnce({
      type: "success",
      url: "slaycity://auth/callback?error=access_denied&error_description=The+user+denied+access",
    });

    const result = await signInWithGoogle();

    expect(result).toEqual({ error: "The user denied access" });
  });
});

describe("signInWithApple", () => {
  it("is silent when the user cancels the system sheet (AC2)", async () => {
    appleSignInAsyncMock.mockRejectedValueOnce({ code: "ERR_REQUEST_CANCELED" });

    const result = await signInWithApple();

    expect(result).toEqual({ cancelled: true });
    expect(supabaseAuthMock.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("surfaces a generic error for any other failure", async () => {
    appleSignInAsyncMock.mockRejectedValueOnce(new Error("boom"));

    const result = await signInWithApple();

    expect(result).toEqual({ error: "Could not complete Apple sign-in." });
  });

  it("passes the raw nonce (not its hash) and the identity token to signInWithIdToken", async () => {
    appleSignInAsyncMock.mockResolvedValueOnce({ identityToken: "apple-id-token" });
    supabaseAuthMock.signInWithIdToken.mockResolvedValueOnce({ error: null });

    const result = await signInWithApple();

    // The mocked `getRandomBytesAsync` returns a zero-filled buffer, so the raw
    // nonce is deterministic — Apple gets its SHA-256 (mocked as "hashed-nonce"),
    // Supabase gets the pre-hash value back, never the same string.
    const rawNonce = "0".repeat(64);
    expect(appleSignInAsyncMock).toHaveBeenCalledWith(expect.objectContaining({ nonce: "hashed-nonce" }));
    expect(supabaseAuthMock.signInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-id-token",
      nonce: rawNonce,
    });
    expect(result).toEqual({});
  });

  it("errors when Apple returns no identity token", async () => {
    appleSignInAsyncMock.mockResolvedValueOnce({ identityToken: null });

    const result = await signInWithApple();

    expect(result).toEqual({ error: "Apple did not return an identity token." });
    expect(supabaseAuthMock.signInWithIdToken).not.toHaveBeenCalled();
  });
});
