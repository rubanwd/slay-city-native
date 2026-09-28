import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from "@expo-google-fonts/nunito";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@slay/tokens";

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
 * The session provider, the audio adapter and the role-based route guard land
 * here in later phases (WP-1.2, WP-2.6, WP-6.2). For now it establishes the one
 * thing the whole app depends on: a dark ground that never flashes white, which
 * the web repository's AGENTS.md requires by default.
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

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.black },
        }}
      />
    </SafeAreaProvider>
  );
}
