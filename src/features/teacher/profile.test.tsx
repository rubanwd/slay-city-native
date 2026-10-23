import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TeacherProfileLoader } from "./TeacherProfileLoader";

const data = vi.hoisted(() => ({ loadTeacherProfile: vi.fn(), changeMyLevel: vi.fn(), changeMyUsername: vi.fn(), signOut: vi.fn() }));
const supabase = vi.hoisted(() => ({}));

vi.mock("@slay/data", () => data);
vi.mock("~/lib/supabase", () => ({ supabase }));
vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));
vi.mock("~/features/auth", () => ({ SignOutButton: () => <button>Log Out</button> }));
vi.mock("~/features/map", () => ({ MAP_QUERY_KEY: "map" }));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  vi.clearAllMocks();
});

function renderLoader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <TeacherProfileLoader />
    </QueryClientProvider>,
  );
  return { invalidate };
}

const teacher = {
  username: "ms_kate",
  email: "kate@school.org",
  mascotImageUrl: "/wardrobe/slay-base.webp",
  level: "elementary" as const,
  availableLevels: ["beginner" as const, "elementary" as const],
};

describe("TeacherProfileLoader", () => {
  it("shows the account with a Teacher badge, and nothing only a player has", async () => {
    data.loadTeacherProfile.mockResolvedValue(teacher);
    renderLoader();
    expect(await screen.findByText("kate@school.org")).toBeTruthy();
    expect(data.loadTeacherProfile).toHaveBeenCalledWith(supabase);
    expect(screen.getByText("Teacher")).toBeTruthy();
    expect(screen.getByText("Sets which level your city map shows.")).toBeTruthy();
    // English throughout, and no level test to take.
    expect(screen.queryByRole("button", { name: "Українська" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Take the test" })).toBeNull();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeTruthy();
  });

  it("switches the level the map previews, and refreshes the teacher's map", async () => {
    data.loadTeacherProfile.mockResolvedValue(teacher);
    data.changeMyLevel.mockResolvedValue({ ok: true });
    const { invalidate } = renderLoader();
    await screen.findByText("kate@school.org");

    fireEvent.click(screen.getByRole("button", { name: "Change level" }));
    await act(async () => fireEvent.click(screen.getByRole("radio", { name: "Beginner" })));

    expect(data.changeMyLevel).toHaveBeenCalledWith(supabase, "beginner");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["profile"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["teacher-map"] });
  });

  it("offers a retry and still lets the teacher log out when loading fails", async () => {
    data.loadTeacherProfile.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(teacher);
    renderLoader();
    expect(await screen.findByText(/Could not load your profile/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("kate@school.org")).toBeTruthy();
  });
});
