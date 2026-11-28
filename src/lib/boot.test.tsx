import { act, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BOOT_SETTLE_MS, BOOT_SPLASH_MAX_MS, BootProvider, useBootHold } from "./boot";

const splash = vi.hoisted(() => ({ hideAsync: vi.fn(() => Promise.resolve()) }));
vi.mock("expo-splash-screen", () => splash);
vi.mock("~/components/ui", () => ({ FullScreenLoader: () => null }));

const control = { setLoading: (_value: boolean) => {} };
function Screen({ initial }: { initial: boolean }) {
  const [loading, setLoading] = useState(initial);
  useEffect(() => {
    control.setLoading = setLoading;
  }, []);
  useBootHold(loading);
  return null;
}

describe("BootProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    splash.hideAsync.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("keeps the splash and the cover up while a screen holds the boot", () => {
    render(<BootProvider><Screen initial /></BootProvider>);
    act(() => vi.advanceTimersByTime(BOOT_SETTLE_MS * 4));

    expect(screen.queryByTestId("boot-cover")).not.toBeNull();
    expect(splash.hideAsync).not.toHaveBeenCalled();
  });

  it("drops both once every hold is released", () => {
    render(<BootProvider><Screen initial /></BootProvider>);
    act(() => control.setLoading(false));
    act(() => vi.advanceTimersByTime(BOOT_SETTLE_MS));

    expect(screen.queryByTestId("boot-cover")).toBeNull();
    expect(splash.hideAsync).toHaveBeenCalled();
  });

  it("ignores holds once booted, so later loads use the screen's own loader", () => {
    render(<BootProvider><Screen initial={false} /></BootProvider>);
    act(() => vi.advanceTimersByTime(BOOT_SETTLE_MS));
    act(() => control.setLoading(true));

    expect(screen.queryByTestId("boot-cover")).toBeNull();
  });

  it("hides the static splash after the cap but keeps the animated cover", () => {
    render(<BootProvider><Screen initial /></BootProvider>);
    act(() => vi.advanceTimersByTime(BOOT_SPLASH_MAX_MS));

    expect(splash.hideAsync).toHaveBeenCalled();
    expect(screen.queryByTestId("boot-cover")).not.toBeNull();
  });
});
