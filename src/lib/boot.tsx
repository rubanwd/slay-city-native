import * as SplashScreen from "expo-splash-screen";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { FullScreenLoader } from "~/components/ui";

/** How long nothing may hold the boot before it ends — lets a redirect land and its screen mount. */
export const BOOT_SETTLE_MS = 150;
/**
 * The native splash never stays longer than this. Past it, a slow network gets
 * the animated loader (the same cover the app was already behind) instead of a
 * static logo that looks frozen.
 */
export const BOOT_SPLASH_MAX_MS = 6000;

type BootContextValue = {
  booted: boolean;
  hold: (id: number) => void;
  release: (id: number) => void;
};

const BootContext = createContext<BootContextValue | undefined>(undefined);

/**
 * One loading screen at start-up instead of four. Until the first screen is
 * fully ready — session and account resolved, redirect done, the map's data
 * loaded and its art decoded, the tab bar settled — the native splash stays up,
 * with one opaque loader under it covering everything (tab bar included).
 *
 * Screens say "not ready yet" with `useBootHold(true)`; the boot ends once no
 * hold has been registered for `BOOT_SETTLE_MS`. After that, holds are ignored
 * and each screen shows its own loader again, as before.
 */
export function BootProvider({ children }: { children: ReactNode }) {
  const holds = useRef(new Set<number>());
  const [holdCount, setHoldCount] = useState(0);
  const [booted, setBooted] = useState(false);
  const [splashTimedOut, setSplashTimedOut] = useState(false);

  const hold = useCallback((id: number) => {
    holds.current.add(id);
    setHoldCount(holds.current.size);
  }, []);
  const release = useCallback((id: number) => {
    holds.current.delete(id);
    setHoldCount(holds.current.size);
  }, []);

  useEffect(() => {
    if (booted || holdCount > 0) return;
    const timer = setTimeout(() => setBooted(true), BOOT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [booted, holdCount]);

  useEffect(() => {
    const timer = setTimeout(() => setSplashTimedOut(true), BOOT_SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (booted || splashTimedOut) SplashScreen.hideAsync().catch(() => {});
  }, [booted, splashTimedOut]);

  const value = useMemo(() => ({ booted, hold, release }), [booted, hold, release]);

  return (
    <BootContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        {booted ? null : (
          <View style={styles.cover} testID="boot-cover">
            <FullScreenLoader />
          </View>
        )}
      </View>
    </BootContext.Provider>
  );
}

let nextHoldId = 0;

/** Keeps the start-up loader up while `active` is true. A no-op once the app has booted. */
export function useBootHold(active: boolean): void {
  const context = useContext(BootContext);
  const [id] = useState(() => ++nextHoldId);
  const hold = context?.hold;
  const release = context?.release;
  const booted = context?.booted ?? true;

  useEffect(() => {
    if (!active || booted || !hold || !release) return;
    hold(id);
    return () => release(id);
  }, [active, booted, hold, release, id]);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100 },
});
