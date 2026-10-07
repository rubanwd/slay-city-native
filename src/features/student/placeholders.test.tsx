import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomeworkPlaceholder from "./HomeworkPlaceholder";
import MapPlaceholder from "./MapPlaceholder";
import ProfilePlaceholder from "./ProfilePlaceholder";
import WardrobePlaceholder from "./WardrobePlaceholder";

/**
 * Each placeholder is a route, so it renders a `Link`. `vi.mock` is hoisted
 * above these imports, so the stub is in place before any screen loads — same
 * pattern as `src/components/primitives-gallery.test.tsx`.
 */
vi.mock("expo-router", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)}>{children}</a>
  ),
}));

function hrefOf(label: string): string | null {
  return screen.getByText(label).closest("a")?.getAttribute("href") ?? null;
}

describe("student placeholders", () => {
  it("Map links to every other student placeholder", () => {
    render(<MapPlaceholder />);
    expect(screen.getByText("Map")).toBeTruthy();
    expect(hrefOf("Wardrobe")).toBe("/wardrobe");
    expect(hrefOf("Homework")).toBe("/homework");
    expect(hrefOf("Profile")).toBe("/profile");
  });

  it("Wardrobe links to every other student placeholder", () => {
    render(<WardrobePlaceholder />);
    expect(screen.getByText("Wardrobe")).toBeTruthy();
    expect(hrefOf("Map")).toBe("/map");
    expect(hrefOf("Homework")).toBe("/homework");
    expect(hrefOf("Profile")).toBe("/profile");
  });

  it("Homework links to every other student placeholder", () => {
    render(<HomeworkPlaceholder />);
    expect(screen.getByText("Homework")).toBeTruthy();
    expect(hrefOf("Map")).toBe("/map");
    expect(hrefOf("Wardrobe")).toBe("/wardrobe");
    expect(hrefOf("Profile")).toBe("/profile");
  });

  it("Profile links to every other student placeholder", () => {
    render(<ProfilePlaceholder />);
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(hrefOf("Map")).toBe("/map");
    expect(hrefOf("Wardrobe")).toBe("/wardrobe");
    expect(hrefOf("Homework")).toBe("/homework");
  });
});
