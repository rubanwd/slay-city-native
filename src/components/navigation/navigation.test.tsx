import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BottomTabBarProps } from "expo-router/tabs";

import { SlayTabBar, tabIcon } from "./SlayTabBar";

const bar = vi.hoisted(() => ({ insets: [] as unknown[] }));
vi.mock("expo-router/tabs", () => ({
  BottomTabBar: (props: { insets: unknown }) => {
    bar.insets.push(props.insets);
    return <span>tabs</span>;
  },
}));

function props(tabBarStyle?: object): BottomTabBarProps {
  return {
    state: { index: 0, routes: [{ key: "map-1", name: "map" }] },
    descriptors: { "map-1": { options: { tabBarStyle } } },
    insets: { top: 47, right: 0, bottom: 34, left: 0 },
  } as unknown as BottomTabBarProps;
}

describe("SlayTabBar", () => {
  it("puts the tabs above the Slay School strip, and the home-indicator inset below both", () => {
    const { container } = render(<SlayTabBar {...props()} />);
    expect(container.textContent).toBe("tabsSlay School");
    expect(bar.insets.at(-1)).toEqual({ top: 47, right: 0, bottom: 0, left: 0 });
    // One element per letter, so each can flash on its own.
    expect(screen.getAllByText(/^[A-Za-z]$/)).toHaveLength(10);
  });

  it("hides the whole frame on a full-screen route", () => {
    const { container } = render(<SlayTabBar {...props({ display: "none" })} />);
    expect(container.textContent).toBe("");
  });
});

describe("tabIcon", () => {
  it("draws the web's icon in a circle that fills when the tab is active", () => {
    const Icon = tabIcon("map");
    const { container, rerender } = render(<Icon focused={false} />);
    expect(container.querySelector("svg")).toBeTruthy();
    const idle = container.firstElementChild?.getAttribute("style") ?? "";
    rerender(<Icon focused />);
    expect(container.firstElementChild?.getAttribute("style")).not.toBe(idle);
  });
});
