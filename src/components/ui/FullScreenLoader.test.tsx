import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { playSfx } from "~/lib/sfx";

import { FullScreenLoader } from "./FullScreenLoader";

vi.mock("~/lib/sfx", () => ({ playSfx: vi.fn() }));
vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));

describe("FullScreenLoader", () => {
  it("tells a screen reader what is loading, and captions it", () => {
    render(<FullScreenLoader label="Loading map…" />);
    expect(screen.getByRole("progressbar", { name: "Loading map…" })).toBeTruthy();
    expect(screen.getByText("Loading map…")).toBeTruthy();
  });

  it("brands a bare loader with the mascot and 'Slay City'", () => {
    render(<FullScreenLoader />);
    expect(screen.getByRole("progressbar", { name: "Loading…" })).toBeTruthy();
    expect(screen.getByText("Slay City")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Make Slay hiss" })).toBeTruthy();
  });

  it("hisses when the snake is tapped", () => {
    render(<FullScreenLoader mascotImageUrl="/wardrobe/hat-crown.webp" />);
    fireEvent.click(screen.getByRole("button", { name: "Make Slay hiss" }));
    expect(playSfx).toHaveBeenCalledWith("snakeHiss");
  });

  it("leaves the mascot out of the consoles", () => {
    render(<FullScreenLoader mascot={false} label="Loading dashboard…" />);
    expect(screen.queryByRole("button", { name: "Make Slay hiss" })).toBeNull();
    expect(screen.getByText("Loading dashboard…")).toBeTruthy();
  });

  it("shows no caption on a console loader without a label", () => {
    render(<FullScreenLoader mascot={false} />);
    expect(screen.queryByText("Slay City")).toBeNull();
  });
});
