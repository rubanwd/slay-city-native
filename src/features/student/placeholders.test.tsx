import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProfilePlaceholder from "./ProfilePlaceholder";

/**
 * Each placeholder is a route, so it renders a `Link`. `vi.mock` is hoisted
 * above these imports, so the stub is in place before any screen loads — same
 * pattern as `src/components/primitives-gallery.test.tsx`.
 */
vi.mock("~/features/auth", () => ({ SignOutButton: () => <button>Log Out</button> }));
vi.mock("expo-router", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)}>{children}</a>
  ),
}));

function hrefOf(label: string): string | null {
  return screen.getByText(label).closest("a")?.getAttribute("href") ?? null;
}

describe("student placeholders", () => {
  it("Profile links to every other student placeholder", () => {
    render(<ProfilePlaceholder />);
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(hrefOf("Map")).toBe("/map");
    expect(hrefOf("Wardrobe")).toBe("/wardrobe");
    expect(hrefOf("Homework")).toBe("/homework");
  });
});
