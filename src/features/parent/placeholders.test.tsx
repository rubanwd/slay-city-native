import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProfilePlaceholder from "./ProfilePlaceholder";

vi.mock("~/features/auth", () => ({ SignOutButton: () => <button>Log Out</button> }));
vi.mock("expo-router", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)}>{children}</a>
  ),
}));

function hrefOf(label: string): string | null {
  return screen.getByText(label).closest("a")?.getAttribute("href") ?? null;
}

describe("parent placeholders", () => {
  it("Profile links to the other parent placeholders", () => {
    render(<ProfilePlaceholder />);
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(hrefOf("Progress")).toBe("/parent");
    expect(hrefOf("Map")).toBe("/parent/map");
  });
});
