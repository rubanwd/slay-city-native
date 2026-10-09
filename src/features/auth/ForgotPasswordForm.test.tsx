import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "./ForgotPasswordForm";

const actionsMock = vi.hoisted(() => ({
  forgotPasswordFormAction: vi.fn(),
}));

vi.mock("./actions", () => actionsMock);

vi.mock("expo-router", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={String(href)}>{children}</a>,
}));

describe("ForgotPasswordForm", () => {
  it("renders the title, the email field and a link back to login", () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByText("Password").closest("div")?.textContent).toBe("Reset Password");
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
    expect(screen.getByText("Log in").closest("a")?.getAttribute("href")).toBe("/login");
  });

  it("sends the typed email and shows the resulting message", async () => {
    actionsMock.forgotPasswordFormAction.mockResolvedValueOnce({
      message: "If an account exists for that email, a reset link has been sent.",
    });
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await waitFor(() =>
      expect(screen.getByText("If an account exists for that email, a reset link has been sent.")).toBeTruthy(),
    );
    expect(actionsMock.forgotPasswordFormAction).toHaveBeenCalledWith("a@b.com");
  });

  it("shows an error instead of a message on failure", async () => {
    actionsMock.forgotPasswordFormAction.mockResolvedValueOnce({ error: "Enter your email." });
    render(<ForgotPasswordForm />);

    fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await waitFor(() => expect(screen.getByText("Enter your email.")).toBeTruthy());
  });
});
