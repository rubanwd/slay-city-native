import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import GroupsPlaceholder from "./GroupsPlaceholder";
import MapPlaceholder from "./MapPlaceholder";
import ProfilePlaceholder from "./ProfilePlaceholder";

vi.mock("expo-router", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)}>{children}</a>
  ),
}));

function hrefOf(label: string): string | null {
  return screen.getByText(label).closest("a")?.getAttribute("href") ?? null;
}

describe("teacher placeholders", () => {
  it("Groups links to the other teacher placeholders", () => {
    render(<GroupsPlaceholder />);
    expect(screen.getByText("Groups")).toBeTruthy();
    expect(hrefOf("Map")).toBe("/teacher-map");
    expect(hrefOf("Profile")).toBe("/teacher-profile");
  });

  it("Map links to the other teacher placeholders", () => {
    render(<MapPlaceholder />);
    expect(screen.getByText("Map")).toBeTruthy();
    expect(hrefOf("Groups")).toBe("/groups");
    expect(hrefOf("Profile")).toBe("/teacher-profile");
  });

  it("Profile links to the other teacher placeholders", () => {
    render(<ProfilePlaceholder />);
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(hrefOf("Groups")).toBe("/groups");
    expect(hrefOf("Map")).toBe("/teacher-map");
  });
});
