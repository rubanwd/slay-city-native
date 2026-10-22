import { act, fireEvent, render, screen } from "@testing-library/react";
import * as Haptics from "expo-haptics";
import { afterEach, describe, expect, it, vi } from "vitest";

import { playSfx } from "~/lib/sfx";

import { RewardScreen, type RewardScreenProps } from "./RewardScreen";

vi.mock("expo-haptics", () => ({
  notificationAsync: vi.fn(() => Promise.resolve()),
  impactAsync: vi.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));
vi.mock("~/lib/sfx", () => ({ playSfx: vi.fn() }));
vi.mock("./assets", () => ({ HERO_IMAGE: { uri: "hero.webp" } }));

afterEach(() => {
  vi.clearAllMocks();
});

async function renderReward(props: Partial<RewardScreenProps> = {}) {
  const onContinue = vi.fn();
  await act(async () => {
    render(
      <RewardScreen coins={10} xp={30} missionTitle="Order a coffee" taskNames={["Quiz", "Word Search"]} onContinue={onContinue} {...props} />,
    );
  });
  return onContinue;
}

describe("RewardScreen", () => {
  it("shows exactly what complete_mission granted, and the mission recap (AC3)", async () => {
    const onContinue = await renderReward({ coins: 7, xp: 21 });

    expect(screen.getByLabelText("7 coins")).toBeTruthy();
    expect(screen.getByLabelText("21 XP")).toBeTruthy();
    expect(screen.getByText("Order a coffee")).toBeTruthy();
    expect(screen.getByText("Quiz · Word Search")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Claim Reward" }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("celebrates once with applause and a success haptic (AC2)", async () => {
    await renderReward();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(playSfx).toHaveBeenCalledTimes(1);
    expect(playSfx).toHaveBeenCalledWith("rewardApplause");
  });

  it("says a replay earns nothing instead of showing rewards (AC4)", async () => {
    await renderReward({ coins: 0, xp: 0, alreadyCompleted: true });

    expect(screen.getByText("Already completed")).toBeTruthy();
    expect(screen.queryByLabelText("0 coins")).toBeNull();
    expect(screen.getByRole("button", { name: "Back to Map" })).toBeTruthy();
  });

  it("counts missions left at the location", async () => {
    await renderReward({ locationName: "Café", missionsCompletedAtLocation: 1, totalMissionsAtLocation: 3 });
    expect(screen.getByText(/1\/3 missions done at/)).toBeTruthy();
  });

  it("announces a finished location", async () => {
    await renderReward({ milestone: "location", locationName: "Café" });
    expect(screen.getByText("✓ Café complete!")).toBeTruthy();
  });

  it("explains a cleared level, with or without a move up", async () => {
    await renderReward({ milestone: "level", clearedLevelName: "Beginner", nextLevelName: "Elementary", advancedToLevelName: "Elementary" });
    expect(screen.getByText("🏆 Beginner cleared!")).toBeTruthy();
    expect(screen.getByText(/You're moving up to Elementary/)).toBeTruthy();
  });

  it("says when the next level is still coming", async () => {
    await renderReward({ milestone: "level", clearedLevelName: "Beginner", nextLevelName: "Elementary", advancedToLevelName: null });
    expect(screen.getByText(/Elementary is coming soon/)).toBeTruthy();
  });

  it("announces a cleared district", async () => {
    await renderReward({ milestone: "district" });
    expect(screen.getByText("🏙️ District cleared!")).toBeTruthy();
  });
});
