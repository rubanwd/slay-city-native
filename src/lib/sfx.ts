import type { AudioPlayer } from "expo-audio";
import { AppState } from "react-native";

import { audioAdapter } from "./audio-adapter";
import { SFX_SOURCES } from "./sfxSources";

export type SfxName = keyof typeof SFX_SOURCES;

/** One player per sound, made on first use and kept, so a repeat play never waits on loading. */
const players = new Map<SfxName, Promise<AudioPlayer>>();
let watchingAppState = false;

/** Stops every sound effect that is playing. */
export function stopAllSfx(): void {
  players.forEach((player) => {
    player.then((p) => p.pause()).catch(() => {});
  });
}

/**
 * Plays a sound effect from the start — the native counterpart of upstream's
 * `lib/sfx.ts` and `lib/hiss.ts` players. Calling it again while the sound is
 * still playing restarts it rather than layering a second copy, as upstream's
 * hiss does, so tapping the mascot repeatedly stays a hiss and not a roar.
 *
 * Sound stops when the app leaves the foreground (AGENTS.md "Timers and app
 * lifecycle"). Never throws: a sound that can't play is skipped, never an
 * error the student sees.
 */
export function playSfx(name: SfxName): void {
  if (!watchingAppState) {
    watchingAppState = true;
    AppState.addEventListener("change", (state) => {
      if (state !== "active") stopAllSfx();
    });
  }

  let player = players.get(name);
  if (!player) {
    player = audioAdapter.createSoundPlayer(SFX_SOURCES[name]);
    players.set(name, player);
    // A player that failed to load is retried next time instead of being kept.
    player.catch(() => players.delete(name));
  }

  player
    .then(async (p) => {
      await p.seekTo(0);
      p.play();
    })
    .catch(() => {});
}
