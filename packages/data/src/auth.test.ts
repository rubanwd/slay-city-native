import { describe, expect, it, vi } from "vitest";

import {
  completeAuthLink,
  requestPasswordReset,
  signIn,
  signInWithApple,
  signOut,
  signUp,
  startGoogleSignIn,
  updatePassword,
} from "./auth";

const REDIRECT = "slaycity:///auth/callback";

function client(auth: Record<string, unknown>) {
  return { auth } as never;
}

describe("signIn", () => {
  it("asks for both fields without calling Supabase", async () => {
    const signInWithPassword = vi.fn();
    const db = client({ signInWithPassword });

    expect(await signIn(db, { email: "  ", password: "secret1" })).toEqual({
      status: "error",
      error: "Enter your email and password.",
    });
    expect(await signIn(db, { email: "a@b.co", password: "" })).toEqual({
      status: "error",
      error: "Enter your email and password.",
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("trims the email and reports a signed-in session", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });

    expect(await signIn(client({ signInWithPassword }), { email: " a@b.co ", password: "secret1" })).toEqual({
      status: "signed-in",
    });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "a@b.co", password: "secret1" });
  });

  it("passes Supabase's error message through unchanged", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: { message: "Invalid login credentials" } });

    expect(await signIn(client({ signInWithPassword }), { email: "a@b.co", password: "wrong!" })).toEqual({
      status: "error",
      error: "Invalid login credentials",
    });
  });
});

describe("signUp", () => {
  const student = { email: "kid@b.co", password: "secret1", confirmPassword: "secret1", role: "student" as const };
  const parent = { ...student, email: "mum@b.co", role: "parent" as const, studentEmail: "kid@b.co" };

  it.each([
    [{ ...student, email: "" }, "Enter your email and password."],
    [{ ...student, password: "" }, "Enter your email and password."],
    [{ ...student, password: "12345", confirmPassword: "12345" }, "Password must be at least 6 characters."],
    [{ ...student, confirmPassword: "secret2" }, "Passwords do not match."],
    [{ ...parent, studentEmail: " " }, "Enter your student's email to link their account."],
    [{ ...parent, studentEmail: "not-an-email" }, "Enter a valid student email address."],
    [{ ...parent, studentEmail: "MUM@b.co" }, "The student email must be different from your own."],
  ])("rejects %o with the web's copy", async (input, error) => {
    const signUpFn = vi.fn();

    expect(await signUp(client({ signUp: signUpFn }), input, REDIRECT)).toEqual({ status: "error", error });
    expect(signUpFn).not.toHaveBeenCalled();
  });

  it("registers a student with the role in user metadata and the app's callback as the redirect", async () => {
    const signUpFn = vi.fn().mockResolvedValue({ data: { session: null }, error: null });

    expect(await signUp(client({ signUp: signUpFn }), student, REDIRECT)).toEqual({
      status: "message",
      message: "Account created! Check your email to confirm, then log in.",
    });
    expect(signUpFn).toHaveBeenCalledWith({
      email: "kid@b.co",
      password: "secret1",
      options: { emailRedirectTo: REDIRECT, data: { role: "student" } },
    });
  });

  it("stores a parent's student email and drops it for a student", async () => {
    const signUpFn = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    const db = client({ signUp: signUpFn });

    await signUp(db, { ...parent, studentEmail: " kid@b.co " }, REDIRECT);
    expect(signUpFn.mock.calls[0][0].options.data).toEqual({ role: "parent", student_email: "kid@b.co" });

    await signUp(db, { ...student, studentEmail: "ignored@b.co" }, REDIRECT);
    expect(signUpFn.mock.calls[1][0].options.data).toEqual({ role: "student" });
  });

  it("reports signed-in when the project does not require email confirmation", async () => {
    const signUpFn = vi.fn().mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });

    expect(await signUp(client({ signUp: signUpFn }), student, REDIRECT)).toEqual({ status: "signed-in" });
  });

  it("passes Supabase's error message through unchanged", async () => {
    const signUpFn = vi.fn().mockResolvedValue({ data: { session: null }, error: { message: "User already registered" } });

    expect(await signUp(client({ signUp: signUpFn }), student, REDIRECT)).toEqual({
      status: "error",
      error: "User already registered",
    });
  });
});

describe("requestPasswordReset", () => {
  it("asks for an email without calling Supabase", async () => {
    const resetPasswordForEmail = vi.fn();

    expect(await requestPasswordReset(client({ resetPasswordForEmail }), "  ", REDIRECT)).toEqual({
      status: "error",
      error: "Enter your email.",
    });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("sends the link to the app's callback and never says whether the account exists", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });

    expect(await requestPasswordReset(client({ resetPasswordForEmail }), " a@b.co ", REDIRECT)).toEqual({
      status: "message",
      message: "If an account exists for that email, a reset link has been sent.",
    });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("a@b.co", { redirectTo: REDIRECT });
  });

  it("passes Supabase's error message through unchanged", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: { message: "Email rate limit exceeded" } });

    expect(await requestPasswordReset(client({ resetPasswordForEmail }), "a@b.co", REDIRECT)).toEqual({
      status: "error",
      error: "Email rate limit exceeded",
    });
  });
});

describe("updatePassword", () => {
  it.each([
    [{ password: "", confirmPassword: "" }, "Enter a new password."],
    [{ password: "12345", confirmPassword: "12345" }, "Password must be at least 6 characters."],
    [{ password: "secret1", confirmPassword: "secret2" }, "Passwords do not match."],
  ])("rejects %o with the web's copy", async (input, error) => {
    const updateUser = vi.fn();

    expect(await updatePassword(client({ updateUser }), input)).toEqual({ status: "error", error });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates the password, then signs the recovery session out", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });

    expect(await updatePassword(client({ updateUser, signOut }), { password: "secret1", confirmPassword: "secret1" })).toEqual({
      status: "password-updated",
    });
    expect(updateUser).toHaveBeenCalledWith({ password: "secret1" });
    expect(signOut).toHaveBeenCalled();
  });

  it("keeps the session when Supabase rejects the new password", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: { message: "New password should be different from the old password." } });
    const signOut = vi.fn();

    expect(await updatePassword(client({ updateUser, signOut }), { password: "secret1", confirmPassword: "secret1" })).toEqual({
      status: "error",
      error: "New password should be different from the old password.",
    });
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("signs out, and throws if Supabase refuses", async () => {
    const ok = vi.fn().mockResolvedValue({ error: null });
    await signOut(client({ signOut: ok }));
    expect(ok).toHaveBeenCalled();

    const refused = vi.fn().mockResolvedValue({ error: new Error("network") });
    await expect(signOut(client({ signOut: refused }))).rejects.toThrow("network");
  });
});

describe("completeAuthLink", () => {
  it("exchanges each link shape for a session", async () => {
    const db = client({
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ error: null }),
      setSession: vi.fn().mockResolvedValue({ error: null }),
    });

    expect(await completeAuthLink(db, { kind: "code", code: "c1", otpType: "" })).toEqual({ status: "signed-in" });
    expect(await completeAuthLink(db, { kind: "otp", tokenHash: "h1", otpType: "recovery" })).toEqual({
      status: "signed-in",
    });
    expect(
      await completeAuthLink(db, { kind: "tokens", accessToken: "at", refreshToken: "rt", otpType: "" }),
    ).toEqual({ status: "signed-in" });
  });

  it("reports a rejected link, an OTP without a type and an unreadable URL", async () => {
    const db = client({ exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: "Code expired" } }) });

    expect(await completeAuthLink(db, { kind: "code", code: "c1", otpType: "" })).toEqual({
      status: "error",
      error: "Code expired",
    });
    expect(await completeAuthLink(db, { kind: "otp", tokenHash: "h1", otpType: "" })).toEqual({
      status: "error",
      error: "This link is invalid or has expired.",
    });
    expect(await completeAuthLink(db, { kind: "invalid" })).toEqual({
      status: "error",
      error: "This link is invalid or has expired.",
    });
    expect(
      await completeAuthLink(db, { kind: "error", error: "access_denied", errorDescription: "Email link is invalid" }),
    ).toEqual({ status: "error", error: "Email link is invalid" });
  });
});

describe("startGoogleSignIn", () => {
  it("asks Supabase for the consent URL without redirecting", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: { url: "https://consent" }, error: null });

    expect(await startGoogleSignIn(client({ signInWithOAuth }), REDIRECT)).toEqual({ url: "https://consent" });
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
    });
  });
});

describe("signInWithApple", () => {
  it("exchanges the identity token with the raw nonce", async () => {
    const signInWithIdToken = vi.fn().mockResolvedValue({ error: null });

    expect(await signInWithApple(client({ signInWithIdToken }), "jwt", "nonce")).toEqual({ status: "signed-in" });
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: "apple", token: "jwt", nonce: "nonce" });
  });

  it("passes Supabase's error through", async () => {
    const signInWithIdToken = vi.fn().mockResolvedValue({ error: { message: "Provider apple is not enabled" } });

    expect(await signInWithApple(client({ signInWithIdToken }), "jwt", "nonce")).toEqual({
      status: "error",
      error: "Provider apple is not enabled",
    });
  });
});
