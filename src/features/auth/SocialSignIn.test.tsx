import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signInWithAppleSheet, signInWithGoogle, SocialSignIn } from "./SocialSignIn";

const auth = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  setSession: vi.fn(),
  signInWithIdToken: vi.fn(),
}));
const browser = vi.hoisted(() => ({ openAuthSessionAsync: vi.fn() }));
const apple = vi.hoisted(() => ({ signInAsync: vi.fn(), isAvailableAsync: vi.fn() }));

vi.mock("~/lib/supabase", () => ({ supabase: { auth } }));
vi.mock("~/lib/authRedirect", async () => {
  // The real parser, without expo-linking's native module behind it.
  const parse = (url: string) => {
    const hash = new URLSearchParams(url.split("#")[1] ?? "");
    const access = hash.get("access_token");
    const refresh = hash.get("refresh_token");
    return access && refresh
      ? { kind: "tokens", accessToken: access, refreshToken: refresh, otpType: "" }
      : { kind: "invalid" };
  };
  return { getAuthRedirectUrl: () => "slaycity:///auth/callback", parseAuthCallbackUrl: parse };
});
vi.mock("expo-web-browser", () => browser);
vi.mock("expo-crypto", () => ({
  randomUUID: () => "raw-nonce",
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_: string, value: string) => `sha256(${value})`,
}));
vi.mock("expo-apple-authentication", () => ({
  ...apple,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButtonType: { SIGN_IN: 0, SIGN_UP: 2 },
  AppleAuthenticationButtonStyle: { WHITE: 0 },
  AppleAuthenticationButton: () => null,
}));

beforeEach(() => {
  [...Object.values(auth), ...Object.values(browser), ...Object.values(apple)].forEach((fn) => fn.mockReset());
  auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://supabase.example/authorize?provider=google" }, error: null });
});

describe("signInWithGoogle", () => {
  it("opens Google in a browser sheet and keeps the session it redirects back with (AC1)", async () => {
    browser.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "slaycity:///auth/callback#access_token=at&refresh_token=rt",
    });
    auth.setSession.mockResolvedValue({ error: null });

    expect(await signInWithGoogle()).toEqual({ status: "signed-in" });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "slaycity:///auth/callback", skipBrowserRedirect: true },
    });
    expect(browser.openAuthSessionAsync).toHaveBeenCalledWith(
      "https://supabase.example/authorize?provider=google",
      "slaycity:///auth/callback",
    );
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "at", refresh_token: "rt" });
  });

  it("treats a closed sheet as a cancel, not an error, and creates no session (AC2)", async () => {
    browser.openAuthSessionAsync.mockResolvedValue({ type: "cancel" });

    expect(await signInWithGoogle()).toEqual({ status: "cancelled" });
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it("reports a provider that could not be started, in the web's words", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });

    expect(await signInWithGoogle()).toEqual({ status: "error", error: "Could not start Google sign-in." });
    expect(browser.openAuthSessionAsync).not.toHaveBeenCalled();
  });
});

describe("signInWithAppleSheet", () => {
  it("hands Apple the hashed nonce and Supabase the raw one (AC3)", async () => {
    apple.signInAsync.mockResolvedValue({ identityToken: "apple-jwt" });
    auth.signInWithIdToken.mockResolvedValue({ error: null });

    expect(await signInWithAppleSheet()).toEqual({ status: "signed-in" });
    expect(apple.signInAsync).toHaveBeenCalledWith({ requestedScopes: [0, 1], nonce: "sha256(raw-nonce)" });
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: "apple", token: "apple-jwt", nonce: "raw-nonce" });
  });

  it("treats a cancelled Apple sheet as a cancel (AC2)", async () => {
    apple.signInAsync.mockRejectedValue(Object.assign(new Error("canceled"), { code: "ERR_REQUEST_CANCELED" }));

    expect(await signInWithAppleSheet()).toEqual({ status: "cancelled" });
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("passes any other Apple failure up", async () => {
    apple.signInAsync.mockRejectedValue(Object.assign(new Error("not handled"), { code: "ERR_REQUEST_NOT_HANDLED" }));

    await expect(signInWithAppleSheet()).rejects.toThrow("not handled");
  });
});

describe("SocialSignIn", () => {
  function renderButtons(mode: "login" | "register") {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <SocialSignIn mode={mode} />
      </QueryClientProvider>,
    );
  }

  it("uses the web's Google labels", () => {
    renderButtons("login");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
  });

  it("shows nothing after a cancel and the error after a failure", async () => {
    browser.openAuthSessionAsync.mockResolvedValueOnce({ type: "dismiss" });
    renderButtons("register");

    fireEvent.click(screen.getByRole("button", { name: "Sign up with Google" }));
    await waitFor(() => expect(browser.openAuthSessionAsync).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();

    auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "Unsupported provider" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign up with Google" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Unsupported provider");
  });
});
