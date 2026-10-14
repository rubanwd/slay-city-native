import { describe, expect, it, vi } from "vitest";

import {
  forgotPasswordFormAction,
  loginFormAction,
  registerFormAction,
  resetPasswordFormAction,
  signOut,
  signUp,
} from "./actions";

const supabaseAuthMock = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("~/lib/supabase", () => ({ supabase: { auth: supabaseAuthMock } }));
vi.mock("~/lib/authRedirect", () => ({ getAuthRedirectUrl: () => "slaycity:///auth/callback" }));

describe("loginFormAction", () => {
  it("rejects an empty email or password without calling supabase", async () => {
    const result = await loginFormAction("", "");

    expect(result).toEqual({ error: "Enter your email and password." });
    expect(supabaseAuthMock.signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in and surfaces supabase's error message on failure", async () => {
    supabaseAuthMock.signInWithPassword.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } });

    const result = await loginFormAction("student@example.com", "wrong-password");

    expect(supabaseAuthMock.signInWithPassword).toHaveBeenCalledWith({
      email: "student@example.com",
      password: "wrong-password",
    });
    expect(result).toEqual({ error: "Invalid login credentials" });
  });

  it("returns an empty state on success", async () => {
    supabaseAuthMock.signInWithPassword.mockResolvedValueOnce({ error: null });

    const result = await loginFormAction("student@example.com", "correct-password");

    expect(result).toEqual({});
  });
});

describe("registerFormAction", () => {
  it("rejects a short password before calling supabase", async () => {
    const result = await registerFormAction("student@example.com", "abc", "abc", "student", "");

    expect(result).toEqual({ error: "Password must be at least 6 characters." });
    expect(supabaseAuthMock.signUp).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", async () => {
    const result = await registerFormAction("student@example.com", "password1", "password2", "student", "");

    expect(result).toEqual({ error: "Passwords do not match." });
  });

  it("requires a student email for the parent role", async () => {
    const result = await registerFormAction("parent@example.com", "password1", "password1", "parent", "");

    expect(result).toEqual({ error: "Enter your student's email to link their account." });
  });

  it("rejects a malformed student email", async () => {
    const result = await registerFormAction("parent@example.com", "password1", "password1", "parent", "not-an-email");

    expect(result).toEqual({ error: "Enter a valid student email address." });
  });

  it("rejects a student email identical to the parent's own", async () => {
    const result = await registerFormAction(
      "parent@example.com",
      "password1",
      "password1",
      "parent",
      "Parent@example.com",
    );

    expect(result).toEqual({ error: "The student email must be different from your own." });
  });

  it("signs up a student with no student_email metadata", async () => {
    supabaseAuthMock.signUp.mockResolvedValueOnce({ data: { session: { access_token: "t" } }, error: null });

    const result = await registerFormAction("student@example.com", "password1", "password1", "student", "");

    expect(supabaseAuthMock.signUp).toHaveBeenCalledWith({
      email: "student@example.com",
      password: "password1",
      options: {
        emailRedirectTo: "slaycity:///auth/callback",
        data: { role: "student" },
      },
    });
    expect(result).toEqual({});
  });

  it("signs up a parent with the student_email metadata", async () => {
    supabaseAuthMock.signUp.mockResolvedValueOnce({ data: { session: { access_token: "t" } }, error: null });

    await registerFormAction("parent@example.com", "password1", "password1", "parent", "student@example.com");

    expect(supabaseAuthMock.signUp).toHaveBeenCalledWith({
      email: "parent@example.com",
      password: "password1",
      options: {
        emailRedirectTo: "slaycity:///auth/callback",
        data: { role: "parent", student_email: "student@example.com" },
      },
    });
  });

  it("returns a confirm-email message when signUp succeeds without a session", async () => {
    supabaseAuthMock.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });

    const result = await signUp("student@example.com", "password1", "student");

    expect(result).toEqual({ message: "Account created! Check your email to confirm, then log in." });
  });
});

describe("forgotPasswordFormAction", () => {
  it("rejects an empty email", async () => {
    const result = await forgotPasswordFormAction("");

    expect(result).toEqual({ error: "Enter your email." });
    expect(supabaseAuthMock.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("requests a reset email with the auth redirect URL", async () => {
    supabaseAuthMock.resetPasswordForEmail.mockResolvedValueOnce({ error: null });

    const result = await forgotPasswordFormAction("student@example.com");

    expect(supabaseAuthMock.resetPasswordForEmail).toHaveBeenCalledWith("student@example.com", {
      redirectTo: "slaycity:///auth/callback",
    });
    expect(result).toEqual({ message: "If an account exists for that email, a reset link has been sent." });
  });

  it("gives the same message whether or not supabase errors, except on a real failure", async () => {
    supabaseAuthMock.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: "Rate limited" } });

    const result = await forgotPasswordFormAction("student@example.com");

    expect(result).toEqual({ error: "Rate limited" });
  });
});

describe("resetPasswordFormAction", () => {
  it("rejects an empty password", async () => {
    const result = await resetPasswordFormAction("", "");

    expect(result).toEqual({ error: "Enter a new password." });
    expect(supabaseAuthMock.updateUser).not.toHaveBeenCalled();
  });

  it("rejects a short password", async () => {
    const result = await resetPasswordFormAction("abc", "abc");

    expect(result).toEqual({ error: "Password must be at least 6 characters." });
  });

  it("rejects mismatched passwords", async () => {
    const result = await resetPasswordFormAction("password1", "password2");

    expect(result).toEqual({ error: "Passwords do not match." });
  });

  it("updates the password and does not sign the user out", async () => {
    supabaseAuthMock.updateUser.mockResolvedValueOnce({ error: null });

    const result = await resetPasswordFormAction("password1", "password1");

    expect(supabaseAuthMock.updateUser).toHaveBeenCalledWith({ password: "password1" });
    expect(result).toEqual({});
  });
});

describe("signOut", () => {
  it("calls supabase.auth.signOut", async () => {
    supabaseAuthMock.signOut.mockResolvedValueOnce({ error: null });

    await signOut();

    expect(supabaseAuthMock.signOut).toHaveBeenCalled();
  });
});
