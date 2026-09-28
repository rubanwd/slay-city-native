import { createClient } from "@supabase/supabase-js";

import type { Database } from "@slay/core/types";

import { secureStorage } from "./secure-storage";

/**
 * `EXPO_PUBLIC_*` vars are inlined by Metro at build time (see .env.example).
 * The same two values can instead be set under `expo.extra` in app.json — Expo
 * merges both into `process.env` for `EXPO_PUBLIC_*` keys, so no extra plumbing
 * is needed to support either source.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in the shared Supabase project's values.",
  );
}

/**
 * The one Supabase client for this app, pointed at the same project the web app
 * uses (docs/ARCHITECTURE.md §"Supabase ownership"). Session tokens persist in
 * expo-secure-store, never AsyncStorage — see AGENTS.md's security rules.
 *
 * This only wires up storage; sign-in/sign-out flows and the AppState-driven
 * auto-refresh listener land with the auth screens (WP-2.1/WP-2.2).
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
