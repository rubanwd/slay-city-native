import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MapLocationViewModel } from "@slay/core";
import type { MapScreenData } from "@slay/data";

import { playSfx } from "~/lib/sfx";

import { CityMap, type CityMapProps } from "./CityMap";
import { MapLocationNode } from "./MapLocationNode";

vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));
vi.mock("~/lib/sfx", () => ({ playSfx: vi.fn() }));

/** react-native-web reports layout through a ResizeObserver, which jsdom lacks — call the handlers directly. */
function measure(width: number, height: number) {
  const nodes = [...document.querySelectorAll("div")].filter(
    (node) => typeof (node as unknown as Record<string, unknown>).__reactLayoutHandler === "function",
  ) as unknown as { __reactLayoutHandler: (event: object) => void }[];
  act(() => nodes.forEach((node) => node.__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 0, width, height } } })));
}

function stop(overrides: Partial<MapLocationViewModel>): MapLocationViewModel {
  return {
    id: "l1",
    name: "Bakery",
    description: null,
    mapX: 30,
    mapY: 40,
    iconUrl: null,
    state: "unlocked",
    missionId: "m1",
    totalXp: 30,
    totalCoins: 15,
    missionsCompleted: 0,
    totalMissions: 3,
    ...overrides,
  } as MapLocationViewModel;
}

function data(locations: MapLocationViewModel[], levelCompleted = false): MapScreenData {
  return {
    district: { id: "d1", name: "Downtown", backgroundUrl: null, locations } as MapScreenData["district"],
    hud: { xp: 120, coins: 40, level: 3, currentStreak: 2 },
    mascotImageUrl: "/wardrobe/slay-base.webp",
    showHomework: false,
    levelStatus: { completed: levelCompleted, levelName: "Starter", nextLevelName: "Elementary" },
  };
}

function renderMap(props: Partial<CityMapProps> & Pick<CityMapProps, "district" | "levelStatus" | "hud">) {
  const handlers = { onStartMission: vi.fn(), onRestartLocation: vi.fn(), onReplayLevel: vi.fn() };
  render(<CityMap mascotImageUrl="" showHomework={false} {...handlers} {...props} />);
  return handlers;
}

describe("CityMap", () => {
  it("shows the HUD and the district", () => {
    renderMap(data([stop({})]));

    expect(screen.getByText("Lvl 3 · 120 XP")).toBeTruthy();
    expect(screen.getByLabelText("40 coins")).toBeTruthy();
    expect(screen.getByText("Downtown")).toBeTruthy();
  });

  it("selects the first stop with a mission and starts it", () => {
    const { onStartMission } = renderMap(
      data([stop({ id: "l0", name: "Park", missionId: null, state: "completed", missionsCompleted: 2, totalMissions: 2 }), stop({})]),
    );

    expect(screen.getByText("Bakery")).toBeTruthy();
    expect(screen.getByText("0/3 missions")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "▶ Start" }));
    expect(onStartMission).toHaveBeenCalledWith("m1");
  });

  it("offers a restart on a finished stop, with what it earned", () => {
    const { onRestartLocation } = renderMap(
      data([stop({ missionId: null, state: "completed", missionsCompleted: 3, totalMissions: 3 })]),
    );

    expect(screen.getByText("✓ Completed")).toBeTruthy();
    expect(screen.getByText("earned")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restart location" }));
    expect(onRestartLocation).toHaveBeenCalledWith("l1", "Bakery");
  });

  it("offers a replay once the whole level is cleared", () => {
    const { onReplayLevel } = renderMap(
      data([stop({ missionId: null, state: "completed", missionsCompleted: 3, totalMissions: 3 })], true),
    );

    expect(screen.getByText(/Starter cleared!/)).toBeTruthy();
    expect(screen.getByText(/Elementary is coming soon/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "↻ Play this level again" }));
    expect(onReplayLevel).toHaveBeenCalledWith("Starter");
  });

  it("walks the mascot to the location the reward screen sent us back to, and says why", () => {
    renderMap({
      ...data([stop({}), stop({ id: "l2", name: "Library", missionId: "m9" })]),
      arrival: { focus: "l2", milestone: "location", name: "Bakery" },
    });

    expect(screen.getByText("✓ Bakery complete!")).toBeTruthy();
    expect(screen.getByText("Library")).toBeTruthy();
  });

  it("whooshes only when the mascot walks somewhere new, and rolls the drum on Start", () => {
    vi.mocked(playSfx).mockClear();
    renderMap(data([stop({}), stop({ id: "l2", name: "Library", missionId: "m9" })]));
    measure(390, 546);

    // Bakery is already selected: tapping it again goes nowhere.
    fireEvent.click(screen.getByRole("button", { name: "Bakery" }));
    expect(playSfx).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    expect(playSfx).toHaveBeenCalledWith("mapTravel");

    fireEvent.click(screen.getByRole("button", { name: "▶ Start" }));
    expect(playSfx).toHaveBeenLastCalledWith("missionStart");
  });

  it("makes Slay hiss when tapped", () => {
    vi.mocked(playSfx).mockClear();
    renderMap({ ...data([stop({})]), mascotImageUrl: "/wardrobe/slay-base.webp" });
    measure(390, 546);

    fireEvent.click(screen.getByRole("button", { name: "Make Slay hiss" }));
    expect(playSfx).toHaveBeenCalledWith("snakeHiss");
  });
});

describe("MapLocationNode", () => {
  it("names a finished stop as completed and reports taps", () => {
    const onSelect = vi.fn();
    render(
      <MapLocationNode name="Park" x={10} y={10} mapX={10} mapY={10} state="completed" selected={false} onSelect={onSelect} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Park — completed" }));
    expect(screen.getByText("✓ Park")).toBeTruthy();
    expect(onSelect).toHaveBeenCalled();
  });
});
