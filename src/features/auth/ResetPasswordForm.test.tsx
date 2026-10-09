import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "./ResetPasswordForm";

const actionsMock = vi.hoisted(() => ({
  resetPasswordFormAction: vi.fn(),
}));

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("./actions", () => actionsMock);
vi.mock("expo-router", () => ({ useRouter: () => ({ replace: replaceMock }) }));

describe("ResetPasswordForm", () => {
  it("renders the title and both password fields", () => {
    render(<ResetPasswordForm />);

    expect(screen.getAllByText("New Password").length).toBeGreaterThan(0);
    expect(screen.getByText("Confirm Password")).toBeTruthy();
  });

  it("submits both password fields and routes to the interim role home on success", async () => {
    actionsMock.resetPasswordFormAction.mockResolvedValueOnce({});
    render(<ResetPasswordForm />);

    const [password, confirmPassword] = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(password, { target: { value: "newpassword1" } });
    fireEvent.change(confirmPassword, { target: { value: "newpassword1" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    expect(actionsMock.resetPasswordFormAction).toHaveBeenCalledWith("newpassword1", "newpassword1");
  });

  it("shows the error and does not navigate on failure", async () => {
    actionsMock.resetPasswordFormAction.mockResolvedValueOnce({ error: "Passwords do not match." });
    render(<ResetPasswordForm />);

    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => expect(screen.getByText("Passwords do not match.")).toBeTruthy());
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
