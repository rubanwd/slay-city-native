import * as Haptics from "expo-haptics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { haptic, HAPTICS_STORAGE_KEY, loadHapticsPreference, setHapticsEnabled } from "./haptics";
import { readSecureItem, writeSecureItem } from "./secure-storage";

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(() => Promise.resolve()),
  notificationAsync: vi.fn(() => Promise.resolve()),
  selectionAsync: vi.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
vi.mock("./secure-storage", () => ({ readSecureItem: vi.fn(async () => null), writeSecureItem: vi.fn(async () => {}) }));

/** Every call to the device, in order: "impact:heavy", "notification:success", "selection". */
function played(): string[] {
  const calls: [number, string][] = [
    ...vi.mocked(Haptics.impactAsync).mock.calls.map((c, i) => [vi.mocked(Haptics.impactAsync).mock.invocationCallOrder[i], `impact:${c[0]}`] as [number, string]),
    ...vi.mocked(Haptics.notificationAsync).mock.calls.map((c, i) => [vi.mocked(Haptics.notificationAsync).mock.invocationCallOrder[i], `notification:${c[0]}`] as [number, string]),
    ...vi.mocked(Haptics.selectionAsync).mock.invocationCallOrder.map((order) => [order, "selection"] as [number, string]),
  ];
  return calls.sort((a, b) => a[0] - b[0]).map(([, name]) => name);
}

beforeEach(async () => {
  vi.useFakeTimers();
  await setHapticsEnabled(true);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("haptic", () => {
  it("gives each moment its own feel", () => {
    haptic("tap");
    haptic("tick");
    haptic("correct");
    haptic("wrong");
    expect(played()).toEqual(["impact:light", "selection", "notification:success", "notification:warning"]);
  });

  it("plays the multi-beat patterns over time", () => {
    haptic("levelUnlock");
    expect(played()).toEqual(["impact:heavy"]);
    vi.advanceTimersByTime(400);
    expect(played()).toEqual(["impact:heavy", "impact:heavy", "notification:success"]);

    vi.clearAllMocks();
    haptic("missionComplete");
    vi.advanceTimersByTime(400);
    expect(played()).toEqual(["impact:medium", "impact:heavy"]);

    vi.clearAllMocks();
    haptic("reward");
    vi.advanceTimersByTime(400);
    expect(played()).toEqual(["notification:success", "impact:light", "impact:light"]);
  });

  it("never throws when the device can't vibrate", () => {
    vi.mocked(Haptics.notificationAsync).mockRejectedValueOnce(new Error("unavailable"));
    expect(() => haptic("correct")).not.toThrow();
  });
});

describe("the off switch", () => {
  it("silences everything and remembers it", async () => {
    await setHapticsEnabled(false);
    expect(writeSecureItem).toHaveBeenCalledWith(HAPTICS_STORAGE_KEY, "off");
    haptic("tap");
    haptic("levelUnlock");
    vi.advanceTimersByTime(1000);
    expect(played()).toEqual([]);
  });

  it("stops a pattern already under way", async () => {
    haptic("levelUnlock");
    await setHapticsEnabled(false);
    vi.advanceTimersByTime(1000);
    expect(played()).toEqual(["impact:heavy"]);
  });

  it("starts from the stored choice", async () => {
    vi.mocked(readSecureItem).mockResolvedValueOnce("off");
    await loadHapticsPreference();
    haptic("tap");
    expect(played()).toEqual([]);

    vi.mocked(readSecureItem).mockResolvedValueOnce(null);
    await loadHapticsPreference();
    haptic("tap");
    expect(played()).toEqual(["impact:light"]);
  });
});
