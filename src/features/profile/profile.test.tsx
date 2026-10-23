import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProfileData } from "@slay/data";

import { LocaleProvider } from "~/lib/locale";

import { ProfileLoader } from "./ProfileLoader";
import { ProfileScreen } from "./ProfileScreen";

const data = vi.hoisted(() => ({
  loadProfile: vi.fn(),
  changeMyUsername: vi.fn(),
  changeMyLevel: vi.fn(),
  signOut: vi.fn(),
}));
const supabase = vi.hoisted(() => ({}));
const nav = vi.hoisted(() => ({ push: vi.fn(), navigate: vi.fn() }));

vi.mock("~/lib/supabase", () => ({ supabase }));
vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));
vi.mock("~/features/map", () => ({ MAP_QUERY_KEY: "map" }));
vi.mock("~/features/auth", () => ({ SignOutButton: () => <button>Log Out</button> }));
vi.mock("@slay/data", () => data);
vi.mock("expo-router", () => ({ useRouter: () => nav }));
vi.mock("~/lib/secure-storage", () => ({
  readSecureItem: vi.fn(async () => null),
  writeSecureItem: vi.fn(async () => {}),
  deleteSecureItem: vi.fn(async () => {}),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function withQueries(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  return { ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>), invalidate };
}

const profile: ProfileData = {
  username: "sam",
  email: "sam@example.com",
  mascotImageUrl: "/wardrobe/slay-crown.webp",
  level: "elementary",
  availableLevels: ["beginner", "elementary"],
  latestPlacement: null,
};

describe("ProfileScreen", () => {
  it("shows the dressed mascot, the name and the email", () => {
    withQueries(<ProfileScreen {...profile} />);
    expect(screen.getByRole("heading", { name: "Profile" })).toBeTruthy();
    expect(screen.getByLabelText("Your character")).toBeTruthy();
    expect(screen.getAllByText("sam").length).toBeGreaterThan(0);
    expect(screen.getByText("sam@example.com")).toBeTruthy();
  });

  it("says 'Signed in' when the account has no email", () => {
    withQueries(<ProfileScreen {...profile} email={null} />);
    expect(screen.getByText("Signed in")).toBeTruthy();
  });

  it("logs out", async () => {
    data.signOut.mockResolvedValue({ ok: true });
    withQueries(<ProfileScreen {...profile} />);
    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
    await waitFor(() => expect(data.signOut).toHaveBeenCalledWith(supabase));
  });
});

describe("ProfileUsernameCard", () => {
  const openEditor = () => fireEvent.click(screen.getByRole("button", { name: "Change name" }));

  it("renames, confirms, and refetches the profile", async () => {
    data.changeMyUsername.mockResolvedValue({ ok: true, username: "Sam K" });
    const { invalidate } = withQueries(<ProfileScreen {...profile} />);

    openEditor();
    const field = screen.getByLabelText("Name") as HTMLInputElement;
    expect(field.value).toBe("sam");
    expect(screen.getByText(/Up to 32 characters/)).toBeTruthy();
    // Nothing to save until the name actually changes.
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("aria-disabled")).toBe("true");

    fireEvent.change(field, { target: { value: "  Sam   K " } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));

    expect(data.changeMyUsername).toHaveBeenCalledWith(supabase, "  Sam   K ");
    expect(await screen.findByText("Name updated!")).toBeTruthy();
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.getByText("Sam K")).toBeTruthy();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["profile"] });
  });

  it("explains why a name was refused, and clears it on the next keystroke", async () => {
    data.changeMyUsername.mockResolvedValue({ ok: false, problem: "taken" });
    withQueries(<ProfileScreen {...profile} />);

    openEditor();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "anna" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));

    expect(screen.getByRole("alert").textContent).toBe("Someone already has that name. Try another one.");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "anna2" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the keyboard from 'fixing' the name", () => {
    withQueries(<ProfileScreen {...profile} />);
    openEditor();
    const field = screen.getByLabelText("Name");
    expect(field.getAttribute("autocorrect")).toBe("off");
    expect(field.getAttribute("autocapitalize")).toBe("none");
    expect(field.getAttribute("spellcheck")).toBe("false");
    expect(field.getAttribute("maxlength")).toBe("32");
  });
});

describe("ProfileLevelCard", () => {
  const openPicker = () => fireEvent.click(screen.getByRole("button", { name: "Change level" }));

  it("switches level, then refetches the profile and the map", async () => {
    data.changeMyLevel.mockResolvedValue({ ok: true });
    const { invalidate } = withQueries(<ProfileScreen {...profile} />);

    expect(screen.getByText("Elementary")).toBeTruthy();
    openPicker();
    expect(screen.getByRole("radio", { name: "Elementary" }).getAttribute("aria-checked")).toBe("true");
    // The rest of the ladder explains itself.
    expect(screen.getByText("Coming soon: Pre-Intermediate, Intermediate, Upper Intermediate.")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole("radio", { name: "Beginner" })));

    expect(data.changeMyLevel).toHaveBeenCalledWith(supabase, "beginner");
    await waitFor(() => expect(screen.queryByRole("radiogroup")).toBeNull());
    expect(screen.getByText("Beginner")).toBeTruthy();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["profile"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["map"] });
  });

  it("goes back to the old level when the switch fails", async () => {
    data.changeMyLevel.mockResolvedValue({ ok: false, error: "Couldn't switch to Beginner. offline" });
    withQueries(<ProfileScreen {...profile} />);

    openPicker();
    await act(async () => fireEvent.click(screen.getByRole("radio", { name: "Beginner" })));

    expect(screen.getByRole("alert").textContent).toBe("Couldn't switch to Beginner. offline");
    expect(screen.getByRole("radio", { name: "Elementary" }).getAttribute("aria-checked")).toBe("true");
  });

  it("closes without a write when the current level is picked", () => {
    withQueries(<ProfileScreen {...profile} />);
    openPicker();
    fireEvent.click(screen.getByRole("radio", { name: "Elementary" }));
    expect(data.changeMyLevel).not.toHaveBeenCalled();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("offers no change when there is only the current level", () => {
    withQueries(<ProfileScreen {...profile} availableLevels={["elementary"]} />);
    expect(screen.queryByRole("button", { name: "Change level" })).toBeNull();
    expect(screen.getByText("More levels unlock as new districts are added to the city.")).toBeTruthy();
  });
});

describe("PlacementTestCard", () => {
  it("invites a student who never took the level test", () => {
    withQueries(<ProfileScreen {...profile} />);
    expect(screen.getByText("Not sure which level fits you? Take a quick test and find out.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Take the test" }));
    expect(nav.push).toHaveBeenCalledWith("/placement-test");
  });

  it("shows the last result and offers a retake", () => {
    withQueries(
      <ProfileScreen
        {...profile}
        latestPlacement={{ totalCorrect: 23, totalQuestions: 40, recommendedLevel: "elementary", levelScores: [], takenAt: "2026-10-20T10:00:00Z" }}
      />,
    );
    expect(screen.getByText("Last result: Elementary (23/40)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Take it again" })).toBeTruthy();
  });
});

describe("language", () => {
  it("switches the profile to Ukrainian and Russian, leaving the level names as authored", async () => {
    withQueries(
      <LocaleProvider>
        <ProfileScreen {...profile} />
      </LocaleProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Profile" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Українська" })));
    expect(screen.getByRole("heading", { name: "Профіль" })).toBeTruthy();
    expect(screen.getByText("Вийти")).toBeTruthy();
    expect(screen.getByText("Elementary")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Русский" })));
    expect(screen.getByRole("heading", { name: "Профиль" })).toBeTruthy();
  });
});

describe("HapticsCard", () => {
  it("switches vibration off for the whole app, and stores it", async () => {
    const { writeSecureItem } = await import("~/lib/secure-storage");
    withQueries(<ProfileScreen {...profile} />);
    const toggle = screen.getByRole("switch", { name: "Vibration" }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    await act(async () => fireEvent.click(toggle));
    expect(writeSecureItem).toHaveBeenCalledWith("slay_haptics", "off");
    expect((screen.getByRole("switch", { name: "Vibration" }) as HTMLInputElement).checked).toBe(false);

    await act(async () => fireEvent.click(screen.getByRole("switch", { name: "Vibration" })));
    expect(writeSecureItem).toHaveBeenCalledWith("slay_haptics", "on");
  });
});

describe("ProfileLoader", () => {
  it("loads the profile", async () => {
    data.loadProfile.mockResolvedValue(profile);
    withQueries(<ProfileLoader />);
    expect(await screen.findByText("sam@example.com")).toBeTruthy();
    expect(data.loadProfile).toHaveBeenCalledWith(supabase);
  });

  it("offers a retry and still lets the student log out when loading fails", async () => {
    data.loadProfile.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(profile);
    withQueries(<ProfileLoader />);

    expect(await screen.findByText(/Could not load your profile/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("sam@example.com")).toBeTruthy();
  });
});
