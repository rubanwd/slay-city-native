import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from "expo-audio";

/**
 * Plumbing only. Mission sound effects (docs/ARCHITECTURE.md's `expo-audio` row,
 * MIGRATION-MAP.md §6) sequence through `packages/core` and play back through this
 * adapter — that wiring lands with the mission task components that need it.
 */

let audioModeReady: Promise<void> | null = null;

function ensureAudioMode(): Promise<void> {
  if (!audioModeReady) {
    audioModeReady = setAudioModeAsync({ playsInSilentMode: true });
  }
  return audioModeReady;
}

export async function createSoundPlayer(source: AudioSource): Promise<AudioPlayer> {
  await ensureAudioMode();
  return createAudioPlayer(source);
}

export const audioAdapter = {
  ensureAudioMode,
  createSoundPlayer,
};
