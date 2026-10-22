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

/*
 * Reanimated's worklets need its Babel plugin, which vitest does not run, and
 * its own mock pulls in Flow-typed React Native source. This stand-in renders
 * every animated value at its target: tests assert what a component shows,
 * not how it moves.
 */
vi.mock("react-native-reanimated", async () => {
  const { Image, ScrollView, Text, View, Easing } = await import("react-native");
  const Animated = { View, Text, Image, ScrollView };
  const last = <T,>(...values: T[]) => values[values.length - 1];
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    Easing,
    useSharedValue: <T,>(value: T) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: <T,>(value: T) => value,
    withSpring: <T,>(value: T) => value,
    withRepeat: <T,>(value: T) => value,
    withDelay: <T,>(_delay: number, value: T) => value,
    withSequence: last,
    cancelAnimation: () => {},
  };
});

/*
 * `expo-speech` and `expo-audio` load native modules that have no jsdom build.
 * Nothing is spoken or played in a test; one that asserts on sound mocks them
 * itself (see `textTasks.test.tsx`).
 */
vi.mock("expo-speech", () => ({ speak: vi.fn(), stop: vi.fn() }));
vi.mock("expo-audio", () => ({
  createAudioPlayer: vi.fn(() => ({ play: vi.fn(), pause: vi.fn(), seekTo: vi.fn(async () => {}), remove: vi.fn() })),
  setAudioModeAsync: vi.fn(async () => {}),
}));

/* The bundled sound files (`~/lib/sfxSources`) are binary; tests get stand-ins. */
vi.mock("~/lib/sfxSources", () => ({
  SFX_SOURCES: {
    missionStart: { uri: "mission-start.m4a" },
    mapTravel: { uri: "map-travel.m4a" },
    snakeHiss: { uri: "snake-hiss.m4a" },
    rewardApplause: { uri: "reward-applause.m4a" },
  },
}));
