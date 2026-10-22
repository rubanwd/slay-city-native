import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingForm } from "./OnboardingForm";
import { OnboardingScreen } from "./OnboardingScreen";

const data = vi.hoisted(() => ({ createProfile: vi.fn(), signOut: vi.fn(), getAvailableLevels: vi.fn() }));
const supabase = vi.hoisted(() => ({}));

vi.mock("~/lib/supabase", () => ({ supabase }));
vi.mock("@slay/data", () => data);
// The auth barrel pulls in the social sign-in stack; these are the parts the form uses.
vi.mock("~/features/auth", async () => ({ ...(await import("~/features/auth/AuthScreen")), ACCOUNT_QUERY_KEY: "account" }));

afterEach(() => {
  vi.clearAllMocks();
});

function withQueries(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  return { ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>), invalidate };
}

describe("OnboardingForm", () => {
  it("pre-selects the first open level and lists the rest as coming soon", () => {
    withQueries(<OnboardingForm levels={["elementary"]} />);
    expect(screen.getByRole("radio", { name: "Elementary" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/^Coming soon: Beginner, Pre-Intermediate/)).toBeTruthy();
  });

  it("creates the profile, then refetches the account so the guard moves on", async () => {
    data.createProfile.mockResolvedValue({ ok: true });
    const { invalidate } = withQueries(<OnboardingForm levels={["beginner", "elementary"]} />);

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Anna" } });
    // Only digits reach the age field.
    fireEvent.change(screen.getByLabelText("Age (optional)"), { target: { value: "9y" } });
    fireEvent.click(screen.getByRole("radio", { name: "Elementary" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Enter the City →" })));

    expect(data.createProfile).toHaveBeenCalledWith(supabase, { username: "Anna", age: "9", level: "elementary" });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["account"] }));
  });

  it("shows why the profile was refused, without leaving", async () => {
    data.createProfile.mockResolvedValue({ ok: false, error: "That username is already taken." });
    const { invalidate } = withQueries(<OnboardingForm levels={["elementary"]} />);

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Anna" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Enter the City →" })));

    expect((await screen.findByRole("alert")).textContent).toBe("That username is already taken.");
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("keeps the keyboard from 'fixing' a name, and offers digits for the age", () => {
    withQueries(<OnboardingForm levels={["elementary"]} />);
    const name = screen.getByLabelText("Username");
    expect(name.getAttribute("autocorrect")).toBe("off");
    expect(name.getAttribute("spellcheck")).toBe("false");
    expect(name.getAttribute("maxlength")).toBe("32");
    expect(screen.getByLabelText("Age (optional)").getAttribute("inputmode")).toBe("numeric");
  });

  it("explains when no level is open yet", () => {
    withQueries(<OnboardingForm levels={[]} />);
    expect(screen.getByText(/No levels are open yet/)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("lets a profile-less user log out", async () => {
    data.signOut.mockResolvedValue({ ok: true });
    withQueries(<OnboardingForm levels={["elementary"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Not you? Log out" }));
    await waitFor(() => expect(data.signOut).toHaveBeenCalledWith(supabase));
  });
});

describe("OnboardingScreen", () => {
  it("offers the levels that have content", async () => {
    data.getAvailableLevels.mockResolvedValue(["beginner", "elementary"]);
    withQueries(<OnboardingScreen />);
    expect(await screen.findByRole("radio", { name: "Beginner" })).toBeTruthy();
    expect(data.getAvailableLevels).toHaveBeenCalledWith(supabase);
  });
});
