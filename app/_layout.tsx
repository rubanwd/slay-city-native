import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@slay/tokens";

import "../global.css";

/**
 * Root layout.
 *
 * Fonts, the session provider, the audio adapter and the role-based route guard
 * all land here in later phases (WP-1.2, WP-2.1, WP-2.6, WP-6.2). For now it
 * establishes the one thing the whole app depends on: a dark ground that never
 * flashes white, which the web repository's AGENTS.md requires by default.
 */
export default function RootLayout() {
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
