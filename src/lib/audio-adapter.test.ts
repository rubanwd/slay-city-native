import { setAudioModeAsync } from "expo-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-audio", () => ({ setAudioModeAsync: vi.fn(() => Promise.resolve()), createAudioPlayer: vi.fn(() => ({})) }));

// A fresh module per test: the adapter remembers the session's mode.
async function load() {
  vi.resetModules();
  return (await import("./audio-adapter")).audioAdapter;
}

beforeEach(() => {
  vi.mocked(setAudioModeAsync).mockClear();
});

describe("audio modes (WP-6.2)", () => {
  it("lets sound effects obey the silent switch and mix under other apps", async () => {
    const audio = await load();
    await audio.createSoundPlayer({ uri: "hiss.m4a" });
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false });
  });

  it("plays a word the student asked to hear even on silent, ducking other audio", async () => {
    const audio = await load();
    await audio.createSoundPlayer({ uri: "bread.mp3" }, "speech");
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true, interruptionMode: "duckOthers", shouldPlayInBackground: false });
  });

  it("switches only when the kind of sound changes", async () => {
    const audio = await load();
    await audio.ensureAudioMode("effect");
    await audio.ensureAudioMode("effect");
    await audio.ensureAudioMode("speech");
    await audio.ensureAudioMode("effect");
    expect(vi.mocked(setAudioModeAsync).mock.calls.map(([mode]) => mode.playsInSilentMode)).toEqual([false, true, false]);
  });

  it("tries again after a mode that failed to apply", async () => {
    const audio = await load();
    vi.mocked(setAudioModeAsync).mockRejectedValueOnce(new Error("session busy"));
    await audio.ensureAudioMode("speech");
    await audio.ensureAudioMode("speech");
    expect(setAudioModeAsync).toHaveBeenCalledTimes(2);
  });
});
