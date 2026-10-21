import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

/** Anything but the background (or iOS's brief "inactive" — a call, Control Centre) counts as on screen. */
const isForeground = (state: AppStateStatus | null) => state !== "background" && state !== "inactive";

/**
 * Whether the app is in the foreground. A phone keeps a backgrounded app's
 * JavaScript timers running, unlike a browser throttling a hidden tab, so
 * anything that counts time reads this and stops while it is false.
 */
export function useAppActive(): boolean {
  const [active, setActive] = useState(() => isForeground(AppState.currentState));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(isForeground(state)));
    return () => subscription.remove();
  }, []);

  return active;
}

/**
 * `setInterval` that only ticks while the app is in the foreground (AGENTS.md
 * "Timers and app lifecycle"). Backgrounding stops it; coming back starts a
 * fresh interval, so the time spent away is never counted and no tick fires
 * in a burst on return. Pass `null` as the delay to stop it.
 *
 * The callback may change between renders; the latest one always runs.
 */
export function useAppStateAwareInterval(callback: () => void, delayMs: number | null): void {
  const active = useAppActive();
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    if (delayMs === null || !active) return;
    const id = setInterval(() => latest.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs, active]);
}
