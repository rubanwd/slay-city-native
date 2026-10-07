import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { colors } from "@slay/tokens";

import { ProgressBar, type ProgressBarVariant } from "./ProgressBar";

const VARIANTS: { variant: ProgressBarVariant; color: string }[] = [
  { variant: "green", color: colors.limeGreen },
  { variant: "pink", color: colors.neonPink },
  { variant: "cyan", color: colors.cyan },
];

/** `rgb(157, 255, 0)` — the form a hex takes once it reaches the DOM. */
function rgb(hex: string): string {
  const int = Number.parseInt(hex.replace("#", ""), 16);
  return `rgb(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255})`;
}

function fillStyle(): string {
  return screen.getByTestId("progress-bar-fill").getAttribute("style") ?? "";
}

describe("ProgressBar", () => {
  it.each(VARIANTS)("fills the track in $variant", ({ variant, color }) => {
    render(<ProgressBar variant={variant} value={60} animate={false} />);

    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(fillStyle()).toContain(`background-color: ${rgb(color)}`);
  });

  it("scales the fill to the value from the left, rather than animating width", () => {
    render(<ProgressBar value={60} animate={false} />);
    expect(fillStyle()).toContain("transform: scaleX(0.6)");
  });

  it("clamps values outside 0–100", () => {
    const { unmount } = render(<ProgressBar value={140} animate={false} />);
    expect(fillStyle()).toContain("transform: scaleX(1)");
    unmount();

    render(<ProgressBar value={-20} animate={false} />);
    expect(fillStyle()).toContain("transform: scaleX(0)");
  });

  it("glows only while there is progress to show", () => {
    const { unmount } = render(<ProgressBar value={1} animate={false} />);
    expect(fillStyle()).toContain("box-shadow");
    unmount();

    render(<ProgressBar value={0} animate={false} />);
    expect(fillStyle()).not.toContain("box-shadow");
  });

  it("renders both labels", () => {
    render(<ProgressBar value={60} label="Progress" labelRight="3/5" />);
    expect(screen.getByText("Progress")).toBeTruthy();
    expect(screen.getByText("3/5")).toBeTruthy();
  });

  it("renders no label row when neither label is given", () => {
    const { container } = render(<ProgressBar value={30} />);
    expect(container.textContent).toBe("");
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("renders at the 8pt track height used by score lists", () => {
    render(<ProgressBar value={85} height={8} animate={false} />);
    expect(screen.getByRole("progressbar").getAttribute("style")).toContain("height: 8px");
  });
});
