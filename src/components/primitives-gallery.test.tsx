import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PrimitivesGalleryScreen from "../../app/dev/primitives";

/**
 * The gallery is a route, so it imports the router only to guard a release
 * build. `vi.mock` is hoisted above the import above, so the stub is in place
 * before the screen is loaded.
 */
vi.mock("expo-router", () => ({ Redirect: () => null }));

/**
 * The dev gallery at `/dev/primitives` is what the side-by-side screenshot
 * comparison against the web app is taken from, so it has to render every
 * variant and state of every WP-1.3 primitive at once. This asserts that it
 * does — one component throwing in one state would otherwise only show up when
 * someone opened the screen on a device.
 */
const SECTIONS = [
  "SlayButton — variant × size",
  "SlayCard — variant · pressable · flush · sections",
  "ProgressBar — variant · height · labels",
  "CoinAmount · XpAmount",
  "StreakBadge — size · count-up · tooltip",
  "Section — py scale · title",
  "Grid — cols 1–4 · gap scale",
  "AppContainer · ScrollScreen",
];

describe("primitives gallery", () => {
  it("renders every section of the design system", () => {
    render(<PrimitivesGalleryScreen />);

    expect(screen.getByText("Primitives")).toBeTruthy();
    for (const title of SECTIONS) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it("renders every progress bar as a progressbar and every streak badge", () => {
    render(<PrimitivesGalleryScreen />);

    expect(screen.getAllByRole("progressbar").length).toBeGreaterThanOrEqual(11);
    expect(screen.getAllByLabelText(/day streak$/).length).toBe(4);
  });

  it("renders the pinned ScrollScreen footer", () => {
    render(<PrimitivesGalleryScreen />);
    expect(screen.getByText("ScrollScreen footer")).toBeTruthy();
  });
});
