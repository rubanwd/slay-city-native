import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StreakBadge, type StreakBadgeSize } from "./StreakBadge";

const SIZES: StreakBadgeSize[] = ["sm", "md", "lg"];

describe("StreakBadge", () => {
  it.each(SIZES)("renders at size %s", (size) => {
    render(<StreakBadge count={7} size={size} />);
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByLabelText("7 day streak")).toBeTruthy();
  });

  it("renders the flame glyph", () => {
    render(<StreakBadge count={7} />);
    expect(screen.getByText("🔥")).toBeTruthy();
  });

  it("shows no tooltip until it is tapped", () => {
    render(<StreakBadge count={7} tooltip="Seven days strong." />);
    expect(screen.queryByText("Seven days strong.")).toBeNull();
  });

  describe("tooltip", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("toggles on tap and hides itself after 3s", () => {
      render(<StreakBadge count={7} tooltip="Seven days strong." />);

      fireEvent.click(screen.getByLabelText("7 day streak"));
      expect(screen.getByText("Seven days strong.")).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.queryByText("Seven days strong.")).toBeNull();
    });
  });
});
