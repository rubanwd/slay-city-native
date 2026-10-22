import { act, renderHook } from "@testing-library/react";
import { AppState, type AppStateStatus } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAppActive, useAppStateAwareInterval } from "./useAppStateAwareInterval";

let listeners: ((state: AppStateStatus) => void)[] = [];
const moveTo = (state: AppStateStatus) => act(() => listeners.forEach((listener) => listener(state)));

beforeEach(() => {
  vi.useFakeTimers();
  listeners = [];
  vi.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    listeners.push(listener as (state: AppStateStatus) => void);
    return { remove: () => (listeners = listeners.filter((l) => l !== listener)) };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useAppActive", () => {
  it("follows the app into the background and back", () => {
    const { result } = renderHook(() => useAppActive());
    expect(result.current).toBe(true);

    moveTo("background");
    expect(result.current).toBe(false);
    moveTo("active");
    expect(result.current).toBe(true);
  });

  it("treats iOS's inactive state as away", () => {
    const { result } = renderHook(() => useAppActive());
    moveTo("inactive");
    expect(result.current).toBe(false);
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useAppActive());
    unmount();
    expect(listeners).toHaveLength(0);
  });
});

describe("useAppStateAwareInterval", () => {
  it("ticks while in the foreground", () => {
    const tick = vi.fn();
    renderHook(() => useAppStateAwareInterval(tick, 1000));
    act(() => vi.advanceTimersByTime(3000));
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it("stops in the background and never catches up on return", () => {
    const tick = vi.fn();
    renderHook(() => useAppStateAwareInterval(tick, 1000));
    act(() => vi.advanceTimersByTime(1000));

    moveTo("background");
    act(() => vi.advanceTimersByTime(60_000));
    expect(tick).toHaveBeenCalledTimes(1);

    moveTo("active");
    expect(tick).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("stops when the delay is null", () => {
    const tick = vi.fn();
    const { rerender } = renderHook(({ delay }) => useAppStateAwareInterval(tick, delay), {
      initialProps: { delay: 1000 as number | null },
    });
    rerender({ delay: null });
    act(() => vi.advanceTimersByTime(5000));
    expect(tick).not.toHaveBeenCalled();
  });

  it("runs the latest callback without restarting the interval", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ callback }) => useAppStateAwareInterval(callback, 1000), {
      initialProps: { callback: first },
    });
    act(() => vi.advanceTimersByTime(600));
    rerender({ callback: second });
    act(() => vi.advanceTimersByTime(400));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
