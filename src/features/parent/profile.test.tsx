import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "~/lib/locale";

import { ParentProfileLoader } from "./ParentProfileLoader";

const data = vi.hoisted(() => ({ loadParentProfile: vi.fn(), changeMyUsername: vi.fn(), signOut: vi.fn() }));
const supabase = vi.hoisted(() => ({}));
const storage = vi.hoisted(() => ({ locale: null as string | null }));

vi.mock("@slay/data", () => data);
vi.mock("~/lib/supabase", () => ({ supabase }));
vi.mock("~/features/auth", () => ({ SignOutButton: () => <button>Log Out</button> }));
vi.mock("~/features/map", () => ({ MAP_QUERY_KEY: "map" }));
// The profile barrel brings in the student screen, which navigates.
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("~/lib/secure-storage", () => ({
  readSecureItem: vi.fn(async () => storage.locale),
  writeSecureItem: vi.fn(async (_key: string, value: string) => {
    storage.locale = value;
  }),
  deleteSecureItem: vi.fn(async () => {
    storage.locale = null;
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
  storage.locale = null;
});

function renderLoader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui: ReactElement = (
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <ParentProfileLoader />
      </LocaleProvider>
    </QueryClientProvider>
  );
  return render(ui);
}

const parent = { username: "mum", email: "mum@home.org", student: { username: "anna", level: "beginner" as const } };

describe("ParentProfileLoader", () => {
  it("shows the parent's account, a Parent badge and the linked student, read-only", async () => {
    data.loadParentProfile.mockResolvedValue(parent);
    renderLoader();
    expect(await screen.findByText("mum@home.org")).toBeTruthy();
    expect(data.loadParentProfile).toHaveBeenCalledWith(supabase);
    expect(screen.getByText("Parent")).toBeTruthy();
    expect(screen.getByText("anna")).toBeTruthy();
    expect(screen.getByText("Beginner")).toBeTruthy();
    expect(screen.getByText("The level your student is studying — they choose it themselves.")).toBeTruthy();
    // A parent has no look and no level of their own to change.
    expect(screen.queryByRole("button", { name: "Change level" })).toBeNull();
    expect(screen.queryByLabelText("Your character")).toBeNull();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeTruthy();
  });

  it("says when no student is linked yet", async () => {
    data.loadParentProfile.mockResolvedValue({ ...parent, student: null });
    renderLoader();
    expect(await screen.findByText("No student linked yet.")).toBeTruthy();
  });

  it("follows the phone until a language is chosen, and can go back to Automatic", async () => {
    data.loadParentProfile.mockResolvedValue(parent);
    renderLoader();
    await screen.findByText("mum@home.org");
    expect(screen.getByRole("button", { name: "Automatic" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Following your browser — currently English.")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Українська" })));
    expect(screen.getByRole("heading", { name: "Профіль" })).toBeTruthy();
    expect(screen.getByText("Батьки")).toBeTruthy();
    // The native-only vibration switch follows the console's language too.
    expect(screen.getByRole("switch", { name: "Вібрація" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Українська" }).getAttribute("aria-pressed")).toBe("true");
    expect(storage.locale).toBe("uk");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Автоматично" })));
    expect(screen.getByRole("heading", { name: "Profile" })).toBeTruthy();
    expect(storage.locale).toBeNull();
  });

  it("renames through the shared card, then reloads the profile", async () => {
    data.loadParentProfile.mockResolvedValue(parent);
    data.changeMyUsername.mockResolvedValue({ ok: true, username: "Mum" });
    renderLoader();
    await screen.findByText("mum@home.org");

    fireEvent.click(screen.getByRole("button", { name: "Change name" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mum" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));

    expect(data.changeMyUsername).toHaveBeenCalledWith(supabase, "Mum");
    expect(await screen.findByText("Name updated!")).toBeTruthy();
    await vi.waitFor(() => expect(data.loadParentProfile).toHaveBeenCalledTimes(2));
  });

  it("offers a retry and still lets the parent log out when loading fails", async () => {
    data.loadParentProfile.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(parent);
    renderLoader();
    expect(await screen.findByText(/Could not load your profile/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("mum@home.org")).toBeTruthy();
  });
});
