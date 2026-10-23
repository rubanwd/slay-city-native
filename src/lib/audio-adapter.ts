import { createAudioPlayer, setAudioModeAsync, type AudioMode, type AudioPlayer, type AudioSource } from "expo-audio";

/**
 * What a sound is for, which decides how it treats the phone's silent switch
 * and other apps' audio (WP-6.2):
 *
 * - `effect` — the game's decoration: applause, the hiss, the map whoosh. It
 *   obeys the silent switch (and Android's silent and vibrate ringer modes)
 *   and mixes under whatever the student is listening to, never stopping it.
 * - `speech` — a word read aloud because the student tapped the speaker. That
 *   is the lesson, asked for, so it plays even on silent, the way a video the
 *   student starts does, and ducks other audio while it speaks.
 *
 * Neither keeps playing in the background; the players stop when the app
 * leaves the foreground (`~/lib/sfx`, `useSpokenWord`).
 */
export type AudioKind = "effect" | "speech";

const MODES: Record<AudioKind, Partial<AudioMode>> = {
  effect: { playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false },
  speech: { playsInSilentMode: true, interruptionMode: "duckOthers", shouldPlayInBackground: false },
};

let currentKind: AudioKind | null = null;
let modeReady: Promise<void> = Promise.resolve();

/**
 * Switches the app's audio session to suit the next sound. The session is
 * global, so this runs before every play, not once: a word read aloud leaves
 * it in `speech`, and the next sound effect must put it back. A failure is
 * swallowed — the sound still plays under whatever mode the session had.
 */
function ensureAudioMode(kind: AudioKind): Promise<void> {
  if (kind !== currentKind) {
    currentKind = kind;
    modeReady = setAudioModeAsync(MODES[kind]).catch(() => {
      // Retry on the next play rather than believing a mode that never applied.
      currentKind = null;
    });
  }
  return modeReady;
}

export async function createSoundPlayer(source: AudioSource, kind: AudioKind = "effect"): Promise<AudioPlayer> {
  await ensureAudioMode(kind);
  return createAudioPlayer(source);
}

export const audioAdapter = {
  ensureAudioMode,
  createSoundPlayer,
};
