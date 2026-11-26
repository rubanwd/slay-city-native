import { act, render } from "@testing-library/react";
import type { PressableProps } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SlayPressable } from "./SlayPressable";

/**
 * On a phone, NativeWind's css-interop replaces a function `style` on
 * `Pressable` with `{}`; react-native-web does not, so a rendered-output test
 * would pass either way. Capture what actually reaches `Pressable` instead.
 */
const received: PressableProps[] = [];

vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>();
  return {
    ...actual,
    Pressable: (props: PressableProps) => {
      received.push(props);
      return null;
    },
  };
});

vi.mock("~/lib/haptics", () => ({ haptic: vi.fn() }));

const last = () => received[received.length - 1]!;

describe("SlayPressable", () => {
  beforeEach(() => {
    received.length = 0;
  });

  it("never hands Pressable a style function", () => {
    render(<SlayPressable style={({ pressed }) => ({ height: pressed ? 10 : 56 })} />);

    expect(typeof last().style).not.toBe("function");
    expect(last().style).toEqual({ height: 56 });
  });

  it("resolves the pressed style itself and still calls the caller's handlers", () => {
    const onPressIn = vi.fn();
    const onPressOut = vi.fn();
    render(<SlayPressable style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })} onPressIn={onPressIn} onPressOut={onPressOut} />);

    act(() => last().onPressIn?.({} as never));
    expect(last().style).toEqual({ opacity: 0.5 });
    expect(onPressIn).toHaveBeenCalledTimes(1);

    act(() => last().onPressOut?.({} as never));
    expect(last().style).toEqual({ opacity: 1 });
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it("passes a plain style through untouched", () => {
    const style = { width: 44 };
    render(<SlayPressable style={style} />);

    expect(last().style).toBe(style);
  });
});
