import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "./AuthForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { ResetPasswordForm } from "./ResetPasswordForm";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("~/lib/supabase", () => ({ supabase: { auth } }));
vi.mock("~/lib/authRedirect", () => ({ getAuthRedirectUrl: () => "slaycity:///auth/callback" }));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const press = (label: string) => fireEvent.click(screen.getByRole("button", { name: label }));

beforeEach(() => {
  Object.values(auth).forEach((fn) => fn.mockReset());
});

describe("credential fields (AC4)", () => {
  it("masks passwords and turns off every keyboard assist on credential fields", () => {
    renderWithQuery(<AuthForm mode="register" onSignedIn={vi.fn()} />);

    for (const label of ["Password", "Confirm Password"]) {
      expect(field(label).type).toBe("password");
    }
    for (const label of ["Email", "Password", "Confirm Password"]) {
      expect(field(label).getAttribute("autocorrect")).toBe("off");
      expect(field(label).getAttribute("autocapitalize")).toBe("none");
      expect(field(label).getAttribute("spellcheck")).toBe("false");
    }
  });
});

describe("AuthForm — login", () => {
  it("asks for both fields without calling Supabase", async () => {
    renderWithQuery(<AuthForm mode="login" onSignedIn={vi.fn()} />);

    press("Log In");

    expect((await screen.findByRole("alert")).textContent).toBe("Enter your email and password.");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in and hands over to the route", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    const onSignedIn = vi.fn();
    renderWithQuery(<AuthForm mode="login" onSignedIn={onSignedIn} />);

    type("Email", " kid@b.co ");
    type("Password", "secret1");
    press("Log In");

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "kid@b.co", password: "secret1" });
  });

  it("shows Supabase's error and stays put", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const onSignedIn = vi.fn();
    renderWithQuery(<AuthForm mode="login" onSignedIn={onSignedIn} />);

    type("Email", "kid@b.co");
    type("Password", "wrong!");
    press("Log In");

    expect((await screen.findByRole("alert")).textContent).toBe("Invalid login credentials");
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("shows a status carried in from another screen until the next submit", async () => {
    renderWithQuery(<AuthForm mode="login" onSignedIn={vi.fn()} initialMessage="Password updated. Log in with your new password." />);

    expect(screen.getByText("Password updated. Log in with your new password.")).toBeTruthy();

    press("Log In");

    expect((await screen.findByRole("alert")).textContent).toBe("Enter your email and password.");
    expect(screen.queryByText("Password updated. Log in with your new password.")).toBeNull();
  });

  it("links to forgot-password and register", () => {
    renderWithQuery(<AuthForm mode="login" onSignedIn={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Forgot password?" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create an account" })).toBeTruthy();
  });
});

describe("AuthForm — register", () => {
  it("asks a parent for their student's email, and only a parent", () => {
    renderWithQuery(<AuthForm mode="register" onSignedIn={vi.fn()} />);

    expect(screen.queryByLabelText("Student's Email")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Parent" }));
    expect(screen.getByLabelText("Student's Email")).toBeTruthy();
  });

  it("rejects mismatched passwords with the web's copy", async () => {
    renderWithQuery(<AuthForm mode="register" onSignedIn={vi.fn()} />);

    type("Email", "kid@b.co");
    type("Password", "secret1");
    type("Confirm Password", "secret2");
    press("Create Account");

    expect((await screen.findByRole("alert")).textContent).toBe("Passwords do not match.");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("registers a parent with the app's callback and shows the confirm-your-email message", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const onSignedIn = vi.fn();
    renderWithQuery(<AuthForm mode="register" onSignedIn={onSignedIn} />);

    type("Email", "mum@b.co");
    type("Password", "secret1");
    type("Confirm Password", "secret1");
    fireEvent.click(screen.getByRole("radio", { name: "Parent" }));
    type("Student's Email", "kid@b.co");
    press("Create Account");

    expect(await screen.findByText("Account created! Check your email to confirm, then log in.")).toBeTruthy();
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "mum@b.co",
      password: "secret1",
      options: {
        emailRedirectTo: "slaycity:///auth/callback",
        data: { role: "parent", student_email: "kid@b.co" },
      },
    });
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});

describe("ForgotPasswordForm", () => {
  it("sends the reset link to the app's callback", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    renderWithQuery(<ForgotPasswordForm />);

    type("Email", "kid@b.co");
    press("Send Reset Link");

    expect(await screen.findByText("If an account exists for that email, a reset link has been sent.")).toBeTruthy();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("kid@b.co", { redirectTo: "slaycity:///auth/callback" });
  });

  it("reports a request that never reached Supabase", async () => {
    auth.resetPasswordForEmail.mockRejectedValue(new Error("Network request failed"));
    renderWithQuery(<ForgotPasswordForm />);

    type("Email", "kid@b.co");
    press("Send Reset Link");

    expect((await screen.findByRole("alert")).textContent).toBe("Network request failed");
  });
});

describe("ResetPasswordForm", () => {
  it("updates the password, signs out and hands over to the route", async () => {
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    const onUpdated = vi.fn();
    renderWithQuery(<ResetPasswordForm onUpdated={onUpdated} />);

    type("New Password", "secret1");
    type("Confirm Password", "secret1");
    press("Update Password");

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "secret1" });
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("rejects a short password with the web's copy", async () => {
    renderWithQuery(<ResetPasswordForm onUpdated={vi.fn()} />);

    type("New Password", "123");
    type("Confirm Password", "123");
    press("Update Password");

    expect((await screen.findByRole("alert")).textContent).toBe("Password must be at least 6 characters.");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
