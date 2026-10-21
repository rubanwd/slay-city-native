import type { AudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef } from "react";

import { useAppActive } from "~/hooks/useAppStateAwareInterval";
import { audioAdapter } from "~/lib/audio-adapter";

/**
 * Says a word aloud — the authored clip when there is one, otherwise the
 * device's speech synthesis, as upstream's `SpellingBeeTask` falls back to
 * `speechSynthesis`. If the clip's player can't be created, speech takes over,
 * so the speaker button is never silent.
 *
 * Sound stops when the app leaves the foreground and when the task unmounts
 * (AGENTS.md "Timers and app lifecycle").
 */
export function useSpokenWord(word: string, audioUrl: string | null): () => void {
  const player = useRef<AudioPlayer | null>(null);
  const disposed = useRef(false);
  const active = useAppActive();

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      player.current?.remove();
      player.current = null;
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (active) return;
    player.current?.pause();
    Speech.stop();
  }, [active]);

  const speak = useCallback(() => {
    Speech.stop();
    Speech.speak(word, { language: "en-US", rate: 0.9 });
  }, [word]);

  return useCallback(() => {
    if (!audioUrl) {
      speak();
      return;
    }
    void (async () => {
      try {
        if (!player.current) {
          const created = await audioAdapter.createSoundPlayer({ uri: audioUrl });
          // The task closed while the clip was loading.
          if (disposed.current) {
            created.remove();
            return;
          }
          player.current = created;
        }
        await player.current.seekTo(0);
        player.current.play();
      } catch {
        speak();
      }
    })();
  }, [audioUrl, speak]);
}
