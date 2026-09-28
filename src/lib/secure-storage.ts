import * as SecureStore from "expo-secure-store";

/**
 * Thin wrapper around expo-secure-store for session tokens and other secrets.
 *
 * Per AGENTS.md: credentials live here, preferences live in AsyncStorage — never
 * the reverse.
 */

export async function readSecureItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function writeSecureItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

/**
 * Shaped to match the `getItem` / `setItem` / `removeItem` storage interface
 * `@supabase/supabase-js` expects for its auth session storage adapter.
 */
export const secureStorage = {
  getItem: readSecureItem,
  setItem: writeSecureItem,
  removeItem: deleteSecureItem,
};
