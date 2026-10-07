import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * Setup for the `components` vitest project (see vitest.config.mts).
 *
 * Component tests render the real primitives through `react-native-web` in jsdom,
 * which is the one way to exercise them without a device or a Metro bundle. Two
 * things that only exist on a device have to be filled in here.
 */

/* `expo-haptics`' web build probes the pointer type at import time. */
if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/*
 * `react-native-safe-area-context` reaches for a native view manager that has no
 * web build, so it is replaced with the insets of a notched phone held in a
 * context. Tests assert which edges a screen asks for and that the layout
 * renders; the library's own inset measurement is not ours to test.
 */
vi.mock("react-native-safe-area-context", async () => {
  const { createContext, createElement, useContext } = await import("react");
  const { View } = await import("react-native");

  const insets = { top: 47, left: 0, right: 0, bottom: 34 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  const SafeAreaInsetsContext = createContext(insets);
  const SafeAreaFrameContext = createContext(frame);

  return {
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    initialWindowMetrics: { insets, frame },
    useSafeAreaInsets: () => useContext(SafeAreaInsetsContext),
    useSafeAreaFrame: () => useContext(SafeAreaFrameContext),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ({ children, style }: { children?: React.ReactNode; style?: unknown }) =>
      createElement(View, { style: style as never }, children),
  };
});

afterEach(cleanup);
