import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Index from "./index";

vi.mock("expo-router", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)}>{children}</a>
  ),
}));

function hrefOf(label: string): string | null {
  return screen.getByText(label, { exact: false }).closest("a")?.getAttribute("href") ?? null;
}

/**
 * WP-1.5's dev-only route switcher — the only way to reach a role's route
 * tree until the auth milestone (WP-2.6) adds a real redirect. Asserts it
 * jumps into every role group's home route.
 */
describe("dev route switcher", () => {
  it("links into every role group's home route", () => {
    render(<Index />);

    expect(screen.getByText("SLAY CITY")).toBeTruthy();
    expect(hrefOf("Enter as Student")).toBe("/map");
    expect(hrefOf("Enter as Teacher")).toBe("/groups");
    expect(hrefOf("Enter as Parent")).toBe("/progress");
  });
});
