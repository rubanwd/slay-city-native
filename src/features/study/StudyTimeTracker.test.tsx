import { act, render } from "@testing-library/react";
import { AppState, type AppStateStatus } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StudyTimeTracker } from "./StudyTimeTracker";

const data = vi.hoisted(() => ({ recordStudyTime: vi.fn(), STUDY_HEARTBEAT_SECONDS: 30 }));
const focus = vi.hoisted(() => ({ focused: true }));
const supabase = vi.hoisted(() => ({}));

vi.mock("@slay/data", () => data);
vi.mock("~/lib/supabase", () => ({ supabase }));
vi.mock("expo-router", () => ({ useIsFocused: () => focus.focused }));

let listeners: ((state: AppStateStatus) => void)[] = [];
const moveTo = (state: AppStateStatus) => act(() => listeners.forEach((listener) => listener(state)));
const wait = (seconds: number) => act(() => vi.advanceTimersByTime(seconds * 1000));

beforeEach(() => {
  vi.useFakeTimers();
  focus.focused = true;
  listeners = [];
  data.recordStudyTime.mockResolvedValue(undefined);
  vi.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    listeners.push(listener as (state: AppStateStatus) => void);
    return { remove: () => (listeners = listeners.filter((l) => l !== listener)) };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("StudyTimeTracker", () => {
  it("reports one 30-second heartbeat per 30 seconds on screen", () => {
    render(<StudyTimeTracker />);
    wait(29);
    expect(data.recordStudyTime).not.toHaveBeenCalled();
    wait(1);
    expect(data.recordStudyTime).toHaveBeenCalledWith(supabase, 30);
    wait(60);
    expect(data.recordStudyTime).toHaveBeenCalledTimes(3);
  });

  it("records nothing while the app is in the background, and restarts the count on return", () => {
    render(<StudyTimeTracker />);
    wait(20);
    moveTo("background");
    wait(600);
    expect(data.recordStudyTime).not.toHaveBeenCalled();

    moveTo("active");
    // The 20 seconds before backgrounding are not carried over.
    wait(10);
    expect(data.recordStudyTime).not.toHaveBeenCalled();
    wait(20);
    expect(data.recordStudyTime).toHaveBeenCalledTimes(1);
  });

  it("stops while its screen is not the one on show", () => {
    const { rerender } = render(<StudyTimeTracker />);
    focus.focused = false;
    rerender(<StudyTimeTracker />);
    wait(300);
    expect(data.recordStudyTime).not.toHaveBeenCalled();

    focus.focused = true;
    rerender(<StudyTimeTracker />);
    wait(30);
    expect(data.recordStudyTime).toHaveBeenCalledTimes(1);
  });

  it("stops on unmount", () => {
    const { unmount } = render(<StudyTimeTracker />);
    unmount();
    wait(300);
    expect(data.recordStudyTime).not.toHaveBeenCalled();
  });

  it("swallows a failed heartbeat", async () => {
    data.recordStudyTime.mockRejectedValue(new Error("offline"));
    render(<StudyTimeTracker />);
    wait(30);
    await act(async () => {});
    expect(data.recordStudyTime).toHaveBeenCalledTimes(1);
  });
});
