import { AppState, type AppStateStatus } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { audioAdapter } from "./audio-adapter";

vi.mock("./audio-adapter", () => ({ audioAdapter: { createSoundPlayer: vi.fn(), ensureAudioMode: vi.fn(() => Promise.resolve()) } }));

const makePlayer = () => ({ play: vi.fn(), pause: vi.fn(), seekTo: vi.fn(() => Promise.resolve()) });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let listeners: ((state: AppStateStatus) => void)[];

// A fresh module per test: `sfx.ts` caches its players.
async function load() {
  vi.resetModules();
  return import("./sfx");
}

beforeEach(() => {
  vi.mocked(audioAdapter.createSoundPlayer).mockReset();
  listeners = [];
  vi.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    listeners.push(listener as (state: AppStateStatus) => void);
    return { remove: () => {} };
  });
});

describe("playSfx", () => {
  it("loads a sound once and replays it from the start, rather than layering copies", async () => {
    const player = makePlayer();
    vi.mocked(audioAdapter.createSoundPlayer).mockResolvedValue(player as never);
    const { playSfx } = await load();

    playSfx("snakeHiss");
    playSfx("snakeHiss");
    await flush();

    expect(audioAdapter.createSoundPlayer).toHaveBeenCalledTimes(1);
    expect(audioAdapter.createSoundPlayer).toHaveBeenCalledWith({ uri: "snake-hiss.m4a" });
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalledTimes(2);
    // Decoration: back to the mode that obeys the silent switch before each play (WP-6.2).
    expect(audioAdapter.ensureAudioMode).toHaveBeenCalledWith("effect");
  });

  it("stops every sound when the app leaves the foreground", async () => {
    const hiss = makePlayer();
    const whoosh = makePlayer();
    vi.mocked(audioAdapter.createSoundPlayer).mockResolvedValueOnce(hiss as never).mockResolvedValueOnce(whoosh as never);
    const { playSfx } = await load();

    playSfx("snakeHiss");
    playSfx("mapTravel");
    await flush();

    listeners.forEach((listener) => listener("active"));
    await flush();
    expect(hiss.pause).not.toHaveBeenCalled();

    listeners.forEach((listener) => listener("background"));
    await flush();
    expect(hiss.pause).toHaveBeenCalled();
    expect(whoosh.pause).toHaveBeenCalled();
  });

  it("never throws, and retries a sound that failed to load", async () => {
    const player = makePlayer();
    vi.mocked(audioAdapter.createSoundPlayer).mockRejectedValueOnce(new Error("no audio")).mockResolvedValue(player as never);
    const { playSfx } = await load();

    expect(() => playSfx("missionStart")).not.toThrow();
    await flush();
    playSfx("missionStart");
    await flush();

    expect(audioAdapter.createSoundPlayer).toHaveBeenCalledTimes(2);
    expect(player.play).toHaveBeenCalledTimes(1);
  });
});
