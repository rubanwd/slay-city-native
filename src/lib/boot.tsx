import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { alpha, colors } from "@slay/tokens";

import { useBootBob, useLoaderDot } from "~/animations";
import { SlayText } from "~/components/ui";

/** How long nothing may hold the boot before it ends — lets a redirect land and its screen mount. */
export const BOOT_SETTLE_MS = 150;
/** The native splash gives way to the animated loader by now even if its image never reports loaded. */
export const BOOT_SPLASH_MAX_MS = 1500;
/** Start-up never covers the app for longer than this, whatever is still loading. */
export const BOOT_MAX_MS = 20000;

/**
 * `imageWidth` of the expo-splash-screen plugin in app.json. The loader draws
 * the same picture at the same size and spot, so the hand-over from the
 * static native splash to the animated loader is invisible.
 */
export const SPLASH_IMAGE_WIDTH = 180;
/** Android 12+ draws the plugin's 288dp icon canvas at 240dp; iOS draws the image at `imageWidth` pt. */
const SPLASH_IMAGE_SIZE = Platform.OS === "android" ? (SPLASH_IMAGE_WIDTH * 240) / 288 : SPLASH_IMAGE_WIDTH;
const SPLASH_IMAGE = require("../../assets/splash/splash-icon.png");

const DOT_COLORS = [colors.neonPink, colors.limeGreen, colors.cyan] as const;
const DOT_DELAYS_MS = [0, 180, 360] as const;

type BootContextValue = {
  booted: boolean;
  hold: (id: number, label: string | undefined) => void;
  release: (id: number) => void;
};

const BootContext = createContext<BootContextValue | undefined>(undefined);

/**
 * One loading screen at start-up. The native splash shows the mascot while
 * the JavaScript starts; as soon as the loader below has drawn the same
 * picture in the same spot, the splash is hidden and the mascot starts to hop,
 * with the three dots and a caption saying what is loading. The loader covers
 * everything (the tab bar included) until the first screen is fully ready —
 * session and account resolved, redirect done, the map's data loaded and its
 * art decoded, the tab bar settled.
 *
 * Screens say "not ready yet" with `useBootHold(true, "Loading map…")`; the
 * boot ends once no hold has been registered for `BOOT_SETTLE_MS`. After that,
 * holds are ignored and each screen shows its own loader again.
 */
export function BootProvider({ children }: { children: ReactNode }) {
  const holds = useRef(new Map<number, string | undefined>());
  const [holdState, setHoldState] = useState<{ count: number; label?: string }>({ count: 0 });
  const [booted, setBooted] = useState(false);

  const sync = useCallback(() => {
    // The newest hold with a caption is the stage start-up is waiting on.
    const label = [...holds.current.values()].filter(Boolean).pop();
    setHoldState({ count: holds.current.size, label });
  }, []);
  const hold = useCallback(
    (id: number, label: string | undefined) => {
      holds.current.set(id, label);
      sync();
    },
    [sync],
  );
  const release = useCallback(
    (id: number) => {
      holds.current.delete(id);
      sync();
    },
    [sync],
  );

  useEffect(() => {
    if (booted || holdState.count > 0) return;
    const timer = setTimeout(() => setBooted(true), BOOT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [booted, holdState.count]);

  useEffect(() => {
    const splash = setTimeout(hideSplash, BOOT_SPLASH_MAX_MS);
    const cap = setTimeout(() => setBooted(true), BOOT_MAX_MS);
    return () => {
      clearTimeout(splash);
      clearTimeout(cap);
    };
  }, []);

  useEffect(() => {
    if (booted) hideSplash();
  }, [booted]);

  const value = useMemo(() => ({ booted, hold, release }), [booted, hold, release]);

  return (
    <BootContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        {booted ? null : <BootLoader label={holdState.label} />}
      </View>
    </BootContext.Provider>
  );
}

function hideSplash() {
  SplashScreen.hideAsync().catch(() => {});
}

function BootLoader({ label }: { label?: string }) {
  const bob = useBootBob();
  return (
    <View
      style={styles.cover}
      testID="boot-cover"
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? "Loading…"}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={bob}>
        {/* Drawn where the native splash drew it; once it is on screen the splash can go. */}
        <Image source={SPLASH_IMAGE} style={styles.mascot} contentFit="contain" onDisplay={hideSplash} accessible={false} />
      </Animated.View>
      <View style={styles.below}>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {DOT_COLORS.map((color, i) => (
            <BootDot key={color} color={color} delayMs={DOT_DELAYS_MS[i]} />
          ))}
        </View>
        <SlayText variant="small" weight="700" color={alpha.white70} style={styles.caption}>
          {label ?? "Slay City"}
        </SlayText>
      </View>
    </View>
  );
}

function BootDot({ color, delayMs }: { color: string; delayMs: number }) {
  const pulse = useLoaderDot(delayMs);
  return <Animated.View style={[styles.dot, { backgroundColor: color }, pulse]} />;
}

let nextHoldId = 0;

/**
 * Keeps the start-up loader up while `active` is true, with `label` as its
 * caption ("Loading map…"). A no-op once the app has booted.
 */
export function useBootHold(active: boolean, label?: string): void {
  const context = useContext(BootContext);
  const [id] = useState(() => ++nextHoldId);
  const hold = context?.hold;
  const release = context?.release;
  const booted = context?.booted ?? true;

  useEffect(() => {
    if (!active || booted || !hold || !release) return;
    hold(id, label);
    return () => release(id);
  }, [active, booted, hold, release, id, label]);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
  },
  mascot: { width: SPLASH_IMAGE_SIZE, height: SPLASH_IMAGE_SIZE },
  // Below the centred mascot, so the mascot stays exactly where the splash put it.
  below: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    marginTop: SPLASH_IMAGE_SIZE / 2 + 16,
    alignItems: "center",
    gap: 16,
  },
  dots: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  caption: { textTransform: "uppercase", letterSpacing: 2.8 },
});
