import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from "@expo-google-fonts/nunito";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@slay/tokens";

import { resolveRedirect } from "~/features/auth/routeGuard";
import { SessionProvider, useSession } from "~/hooks/useSession";
import { useMyRole } from "~/hooks/useMyRole";
import { queryClient } from "~/lib/query-client";
import { supabase } from "~/lib/supabase";

import "../global.css";

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Root layout.
 *
 * Loads Nunito (400–900) via expo-font/@expo-google-fonts/nunito and holds the
 * splash screen until it's ready, so text never flashes in the system font —
 * every weight `@slay/tokens`' `fontFamilyByWeight` maps to must be registered
 * here before any screen renders.
 *
 * Also owns the one `AppState` listener that drives Supabase's auto-refresh
 * (WP-2.1 AC3/AC5): refreshing only while the app is foregrounded avoids
 * burning a refresh on a backgrounded app and lets a long background period
 * resolve with a single refresh on return rather than a stale, expired token.
 *
 * `RouteGuard` below is WP-2.6's role-based route guard. It needs `useSession`
 * (from `SessionProvider`) and `useSegments`/`useRouter` (from the router
 * context `<Stack>` establishes for its own children), so it is a child of
 * both rather than logic inlined here. The audio adapter lands in a later
 * phase (WP-6.2).
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    function handleAppStateChange(state: AppStateStatus) {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <RouteGuard />
        </SafeAreaProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

/**
 * Decides, on every segment/session/role change, whether the current route is
 * one its role is allowed to be on (WP-2.6) — never duplicating `roleHome()`'s
 * rule (`~/features/auth/routeGuard`'s `resolveRedirect`), only acting on it.
 * Keeps the splash screen up (AC: no auth flash) until the session is known
 * and, if signed in, the profile role has loaded too.
 */
function RouteGuard() {
  const { session, isLoading: sessionLoading } = useSession();
  const role = useMyRole();
  const segments = useSegments();
  const router = useRouter();

  const target = resolveRedirect(segments, sessionLoading ? undefined : session, role);
  const ready = !sessionLoading && (session === null || role !== undefined);

  useEffect(() => {
    if (target) {
      router.replace(target as Href);
    }
  }, [target, router]);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.black },
      }}
    />
  );
}
