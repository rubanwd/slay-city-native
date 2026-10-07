import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MapPlaceholder from "./MapPlaceholder";
import ProfilePlaceholder from "./ProfilePlaceholder";
import ProgressPlaceholder from "./ProgressPlaceholder";

vi.mock("expo-router", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)}>{children}</a>
  ),
}));

function hrefOf(label: string): string | null {
  return screen.getByText(label).closest("a")?.getAttribute("href") ?? null;
}

describe("parent placeholders", () => {
  it("Progress links to the other parent placeholders", () => {
    render(<ProgressPlaceholder />);
    expect(screen.getByText("Progress")).toBeTruthy();
    expect(hrefOf("Map")).toBe("/parent-map");
    expect(hrefOf("Profile")).toBe("/parent-profile");
  });

  it("Map links to the other parent placeholders", () => {
    render(<MapPlaceholder />);
    expect(screen.getByText("Map")).toBeTruthy();
    expect(hrefOf("Progress")).toBe("/progress");
    expect(hrefOf("Profile")).toBe("/parent-profile");
  });

  it("Profile links to the other parent placeholders", () => {
    render(<ProfilePlaceholder />);
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(hrefOf("Progress")).toBe("/progress");
    expect(hrefOf("Map")).toBe("/parent-map");
  });
});
