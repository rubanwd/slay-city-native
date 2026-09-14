import { describe, expect, it } from "vitest";

import { clampTaskFraction, missionRewardFraction, taskRewardFraction } from "./missionReward";

describe("clampTaskFraction", () => {
  it("passes through a share already in range", () => {
    expect(clampTaskFraction(0)).toBe(0);
    expect(clampTaskFraction(0.4)).toBe(0.4);
    expect(clampTaskFraction(1)).toBe(1);
  });

  it("clamps out-of-range shares so a task can never inflate the reward", () => {
    expect(clampTaskFraction(1.5)).toBe(1);
    expect(clampTaskFraction(-2)).toBe(0);
  });

  it("treats a non-finite share as nothing earned", () => {
    expect(clampTaskFraction(NaN)).toBe(0);
    expect(clampTaskFraction(Infinity)).toBe(0);
    expect(clampTaskFraction(-Infinity)).toBe(0);
  });
});

describe("taskRewardFraction", () => {
  it("keeps a real share reported by a task that ended early", () => {
    expect(taskRewardFraction(0.5)).toBe(0.5);
    expect(taskRewardFraction(0)).toBe(0);
    expect(taskRewardFraction(1.5)).toBe(1);
  });

  it("counts a task that reported nothing as fully completed", () => {
    expect(taskRewardFraction(undefined)).toBe(1);
  });

  // The regression this guards: most tasks wire `onComplete` straight to a
  // button, so React calls it with a click event. Read as a share, that zeroed
  // out the whole mission's XP and coins.
  it("counts a click event as fully completed, not as nothing earned", () => {
    expect(taskRewardFraction({ type: "click", nativeEvent: {} })).toBe(1);
    expect(taskRewardFraction("1")).toBe(1);
  });
});

describe("missionRewardFraction", () => {
  it("pays the full mission when every task was played through", () => {
    expect(missionRewardFraction({ playedFraction: 1, skipped: 0, total: 5 })).toBe(1);
  });

  it("forfeits only the skipped task's share of the mission", () => {
    expect(missionRewardFraction({ playedFraction: 1, skipped: 1, total: 5 })).toBe(0.8);
    expect(missionRewardFraction({ playedFraction: 1, skipped: 2, total: 5 })).toBe(0.6);
  });

  it("pays nothing when every task was skipped", () => {
    expect(missionRewardFraction({ playedFraction: 1, skipped: 4, total: 4 })).toBe(0);
  });

  it("keeps a partially finished task's share on top of the skip penalty", () => {
    // Word search left half-done, plus one skipped task out of five.
    expect(missionRewardFraction({ playedFraction: 0.5, skipped: 1, total: 5 })).toBe(0.4);
  });

  it("leaves a run with no skips exactly as it was before skipping existed", () => {
    expect(missionRewardFraction({ playedFraction: 0.5, skipped: 0, total: 3 })).toBe(0.5);
  });

  it("never returns a negative share when more skips are reported than tasks", () => {
    expect(missionRewardFraction({ playedFraction: 1, skipped: 9, total: 4 })).toBe(0);
    expect(missionRewardFraction({ playedFraction: 1, skipped: -3, total: 4 })).toBe(1);
  });

  it("pays in full for a mission with no tasks rather than dividing by zero", () => {
    expect(missionRewardFraction({ playedFraction: 1, skipped: 0, total: 0 })).toBe(1);
  });
});
