import * as SecureStore from "expo-secure-store";

/**
 * Thin wrapper around expo-secure-store for session tokens and other secrets.
 *
 * Per AGENTS.md: credentials live here, preferences live in AsyncStorage — never
 * the reverse.
 *
 * SecureStore caps a single value at roughly 2 KB on some platforms (Android's
 * Keystore-backed implementation), but a Supabase session (access + refresh
 * token, user metadata) regularly exceeds that. Chosen fix: chunk oversized
 * values across several SecureStore keys rather than falling back to an
 * AES-key-in-SecureStore + encrypted-AsyncStorage scheme — AGENTS.md's "never
 * AsyncStorage" rule for credentials is simplest to honour literally when the
 * token never leaves SecureStore at all.
 */

const CHUNK_SIZE = 1800;
const CHUNK_SENTINEL_PREFIX = "__slay_chunked__:";

function chunkKey(key: string, index: number): string {
  return `${key}__chunk_${index}`;
}

async function readChunkedValue(sentinel: string, key: string): Promise<string> {
  const count = Number(sentinel.slice(CHUNK_SENTINEL_PREFIX.length));
  const chunks = await Promise.all(
    Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))),
  );
  return chunks.join("");
}

async function deleteChunkRange(key: string, start: number, end: number): Promise<void> {
  const indexes = Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
  await Promise.all(indexes.map((index) => SecureStore.deleteItemAsync(chunkKey(key, index))));
}

export async function readSecureItem(key: string): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (raw === null) {
    return null;
  }
  if (raw.startsWith(CHUNK_SENTINEL_PREFIX)) {
    return readChunkedValue(raw, key);
  }
  return raw;
}

export async function writeSecureItem(key: string, value: string): Promise<void> {
  const previous = await SecureStore.getItemAsync(key);
  const previousChunkCount = previous?.startsWith(CHUNK_SENTINEL_PREFIX)
    ? Number(previous.slice(CHUNK_SENTINEL_PREFIX.length))
    : 0;

  if (value.length <= CHUNK_SIZE) {
    if (previousChunkCount > 0) {
      await deleteChunkRange(key, 0, previousChunkCount);
    }
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + CHUNK_SIZE));
  }

  await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)));
  if (previousChunkCount > chunks.length) {
    await deleteChunkRange(key, chunks.length, previousChunkCount);
  }
  await SecureStore.setItemAsync(key, `${CHUNK_SENTINEL_PREFIX}${chunks.length}`);
}

export async function deleteSecureItem(key: string): Promise<void> {
  const raw = await SecureStore.getItemAsync(key);
  if (raw?.startsWith(CHUNK_SENTINEL_PREFIX)) {
    await deleteChunkRange(key, 0, Number(raw.slice(CHUNK_SENTINEL_PREFIX.length)));
  }
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
