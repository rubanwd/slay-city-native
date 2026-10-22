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
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@slay/tokens";

import { RouteGuard } from "~/features/auth";
import { SessionProvider } from "~/hooks/useSession";
import { LocaleProvider } from "~/lib/locale";
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
 * `RouteGuard` (WP-2.6) decides who may see which screen and covers the
 * navigator until it has. The audio adapter lands here in WP-6.2. For now it establishes the one thing the whole app depends
 * on: a dark ground that never flashes white, which the web repository's
 * AGENTS.md requires by default.
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
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

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
        <LocaleProvider>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <RouteGuard>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.black },
                }}
              />
            </RouteGuard>
          </SafeAreaProvider>
        </LocaleProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
