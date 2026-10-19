import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResetPasswordScreen from "../../app/auth/reset-password";

const session = vi.hoisted(() => ({ current: { session: null as object | null, isLoading: false } }));

vi.mock("~/hooks/useSession", () => ({ useSession: () => session.current }));
vi.mock("expo-router", () => ({
  Redirect: ({ href }: { href: { pathname: string; params: Record<string, string> } }) => (
    <span>
      redirect {href.pathname} {JSON.stringify(href.params)}
    </span>
  ),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("~/features/auth", () => ({
  AuthScreen: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ResetPasswordForm: () => <span>reset form</span>,
}));

beforeEach(() => {
  session.current = { session: null, isLoading: false };
});

describe("reset-password route", () => {
  it("sends a visitor without a recovery session back to login with the web's error", () => {
    render(<ResetPasswordScreen />);

    expect(screen.getByText(/redirect \/auth\/login/).textContent).toContain(
      "That reset link has expired. Request a new one.",
    );
  });

  it("waits for the session to load before deciding", () => {
    session.current = { session: null, isLoading: true };
    const { rerender } = render(<ResetPasswordScreen />);
    expect(screen.queryByText(/redirect/)).toBeNull();

    session.current = { session: { user: {} }, isLoading: false };
    rerender(<ResetPasswordScreen />);
    expect(screen.getByText("reset form")).toBeTruthy();
  });

  it("does not call the link expired when the update itself signs the session out", () => {
    session.current = { session: { user: {} }, isLoading: false };
    const { rerender } = render(<ResetPasswordScreen />);
    expect(screen.getByText("reset form")).toBeTruthy();

    session.current = { session: null, isLoading: false };
    rerender(<ResetPasswordScreen />);
    expect(screen.queryByText(/redirect/)).toBeNull();
  });
});
