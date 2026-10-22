import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MapDistrictViewModel } from "@slay/core";

import { CityMapPreview } from "~/features/map/CityMapPreview";

import { ReviewLocationScreen } from "./ReviewScreens";

const nav = vi.hoisted(() => ({ push: vi.fn(), navigate: vi.fn() }));
vi.mock("expo-router", () => ({ useRouter: () => nav, Redirect: () => null }));
vi.mock("~/lib/supabase", () => ({ supabase: {} }));
vi.mock("~/lib/imageSource", () => ({
  imageSource: (url: string | null) => (url ? { uri: url } : null),
}));
vi.mock("@slay/data", () => ({ signOut: vi.fn() }));
vi.mock("~/features/mission", () => ({ MissionScreen: () => null }));

afterEach(() => {
  vi.clearAllMocks();
});

const location = (id: string, name: string, extra = {}) => ({
  id,
  name,
  description: null,
  mapX: 20,
  mapY: 30,
  iconUrl: null,
  state: "available" as const,
  missionId: null,
  missionsCompleted: 0,
  totalMissions: 2,
  totalXp: 30,
  totalCoins: 10,
  ...extra,
});

const districts = [
  {
    id: "d1",
    name: "Old Town",
    backgroundUrl: null,
    locations: [location("l1", "Bakery", { description: "Fresh bread" }), location("l2", "Park")],
  },
  { id: "d2", name: "Harbour", backgroundUrl: null, locations: [] },
] as unknown as MapDistrictViewModel[];

describe("CityMapPreview", () => {
  it("steps through districts by hand and describes the picked stop", () => {
    render(
      <CityMapPreview
        districts={districts}
        levelName="Elementary"
        subtitle="Every district and mission"
      />
    );
    expect(screen.getByText("Old Town")).toBeTruthy();
    expect(screen.getByText("District 1 of 2")).toBeTruthy();
    // The first stop stands in until one is tapped; with nobody followed, a count, not "0/2".
    expect(screen.getAllByText("Bakery").length).toBeGreaterThan(0);
    expect(screen.getByText("2 missions")).toBeTruthy();
    expect(screen.getByText("Fresh bread")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "▶ Open missions" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next district" }));
    expect(screen.getByText("Harbour")).toBeTruthy();
    expect(screen.getByText("This district has no published locations yet.")).toBeTruthy();
  });

  it("opens the stop's missions on the teacher console", () => {
    render(
      <CityMapPreview
        districts={districts}
        levelName="Elementary"
        subtitle="Every district and mission"
        locationHref={(locationId) => ({
          pathname: "/teacher/location/[locationId]",
          params: { locationId },
        })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "▶ Open missions" }));
    expect(nav.push).toHaveBeenCalledWith({
      pathname: "/teacher/location/[locationId]",
      params: { locationId: "l1" },
    });
  });

  it("shows whose progress it reflects", () => {
    render(
      <CityMapPreview
        districts={districts}
        levelName="Elementary"
        subtitle="x"
        progressLabel="Anna"
      />
    );
    expect(screen.getByText("✓ completed by Anna")).toBeTruthy();
    expect(screen.getByText("0/2 missions")).toBeTruthy();
  });

  it("says when the level has nothing yet", () => {
    render(<CityMapPreview districts={[]} levelName="Intermediate" subtitle="x" />);
    expect(screen.getByText("Nothing to show yet")).toBeTruthy();
  });
});

describe("ReviewLocationScreen", () => {
  it("lists every mission, each opening in review", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ReviewLocationScreen
          location={{ id: "l1", name: "Bakery", description: "Bread", districtName: "Old Town" }}
          missions={[
            { id: "m1", title: "Buy bread", description: null },
            { id: "m2", title: "Count rolls", description: "Numbers" },
          ]}
        />
      </QueryClientProvider>
    );
    expect(
      screen.getByText("Missions run in review: as a student plays them, with nothing recorded.")
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Review mission 2: Count rolls" }));
    expect(nav.push).toHaveBeenCalledWith({
      pathname: "/teacher/mission/[missionId]",
      params: { missionId: "m2" },
    });
  });
});
