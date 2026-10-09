import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "./AuthForm";

const actionsMock = vi.hoisted(() => ({
  loginFormAction: vi.fn(),
  registerFormAction: vi.fn(),
}));

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("./actions", () => actionsMock);

vi.mock("expo-router", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={String(href)}>{children}</a>,
  useRouter: () => ({ replace: replaceMock }),
}));

describe("AuthForm · login", () => {
  it("renders the login copy with no register-only fields", () => {
    render(<AuthForm mode="login" />);

    expect(screen.getByText("In").closest("div")?.textContent).toBe("Log In");
    expect(screen.getByRole("button", { name: "Log In" })).toBeTruthy();
    expect(screen.queryByText("Confirm Password")).toBeNull();
    expect(screen.queryByText("I am a")).toBeNull();

    const forgotLink = screen.getByText("Forgot password?").closest("a");
    expect(forgotLink?.getAttribute("href")).toBe("/forgot-password");

    const switchLink = screen.getByText("Create an account").closest("a");
    expect(switchLink?.getAttribute("href")).toBe("/register");
  });

  it("shows the error returned by loginFormAction and does not navigate", async () => {
    actionsMock.loginFormAction.mockResolvedValueOnce({ error: "Invalid login credentials" });
    render(<AuthForm mode="login" />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => expect(screen.getByText("Invalid login credentials")).toBeTruthy());
    expect(actionsMock.loginFormAction).toHaveBeenCalledWith("a@b.com", "wrong-password");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("navigates to the interim role home on success", async () => {
    actionsMock.loginFormAction.mockResolvedValueOnce({});
    render(<AuthForm mode="login" />);

    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
  });
});

describe("AuthForm · register", () => {
  it("renders the register copy with the confirm-password and role fields, but no forgot-password link", () => {
    render(<AuthForm mode="register" />);

    expect(screen.getByText("Up").closest("div")?.textContent).toBe("Sign Up");
    expect(screen.getByRole("button", { name: "Create Account" })).toBeTruthy();
    expect(screen.getByText("Confirm Password")).toBeTruthy();
    expect(screen.getByText("I am a")).toBeTruthy();
    expect(screen.queryByText("Forgot password?")).toBeNull();
    expect(screen.queryByText("Student's Email")).toBeNull();

    const switchLink = screen.getByText("Log in").closest("a");
    expect(switchLink?.getAttribute("href")).toBe("/login");
  });

  it("reveals the student's email field only once the parent role is selected", () => {
    render(<AuthForm mode="register" />);

    expect(screen.queryByText("Student's Email")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Parent" }));

    expect(screen.getByText("Student's Email")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Student" }));

    expect(screen.queryByText("Student's Email")).toBeNull();
  });

  it("passes the selected role and student email through to registerFormAction", async () => {
    actionsMock.registerFormAction.mockResolvedValueOnce({});
    render(<AuthForm mode="register" />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "parent@example.com" } });
    fireEvent.change(screen.getAllByPlaceholderText("••••••••")[0], { target: { value: "password1" } });
    fireEvent.change(screen.getAllByPlaceholderText("••••••••")[1], { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("radio", { name: "Parent" }));
    fireEvent.change(screen.getByPlaceholderText("student@example.com"), { target: { value: "kid@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    expect(actionsMock.registerFormAction).toHaveBeenCalledWith(
      "parent@example.com",
      "password1",
      "password1",
      "parent",
      "kid@example.com",
    );
  });

  it("shows a confirm-email message without navigating when signup needs email confirmation", async () => {
    actionsMock.registerFormAction.mockResolvedValueOnce({
      message: "Account created! Check your email to confirm, then log in.",
    });
    render(<AuthForm mode="register" />);

    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() =>
      expect(screen.getByText("Account created! Check your email to confirm, then log in.")).toBeTruthy(),
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
