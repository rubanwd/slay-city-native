import { secureStorage } from "~/lib/secure-storage";

/**
 * Returns the read/write/delete wrapper around expo-secure-store, for screens
 * that need to store a secret directly rather than through the Supabase client's
 * own session storage.
 */
export function useSecureStorage(): typeof secureStorage {
  return secureStorage;
}
