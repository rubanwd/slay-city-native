# SCN-60 — Implement WP-2.1 Supabase client with SecureStore storage adapter and AppState auto-refresh

> Type: feature · Date: 2026-10-07

## Context

WP-2.1 is the first ticket in P5 (Auth & session) and gates everything after
it — WP-2.2's auth screens, WP-2.6's route guard, and every screen that will
eventually call `@slay/data`. The web app persists a session in an HTTP-only
cookie the browser manages for it; native has no cookie jar, so the session
has to be persisted and refreshed by hand. `src/lib/supabase.ts` and
`src/lib/secure-storage.ts` already existed from an earlier ticket with the
basic `createClient` wiring and a pass-through SecureStore adapter, but three
of the ticket's acceptance criteria were not yet met: SecureStore's ~2 KB
per-value limit was not handled (a real session payload exceeds it), nothing
started or stopped token auto-refresh as the app foregrounded/backgrounded
(AC3/AC5), and there was no way for the rest of the app to read the current
session or react to sign-out.

## What was done

**Chunked SecureStore adapter.** `src/lib/secure-storage.ts`'s `getItem` /
`setItem` / `removeItem` now transparently split any value over 1 800
characters across multiple SecureStore keys (`<key>__chunk_0`,
`<key>__chunk_1`, …), with the base key holding either the raw value (small
case) or a sentinel string `__slay_chunked__:<count>` that tells `getItem`
how many chunks to read back and join. `setItem` also reconciles chunk count
across writes — if a value shrinks from N chunks to M, the now-orphaned
chunks `M..N-1` are deleted so old session data never lingers under an
abandoned key.

**AppState-driven auto-refresh.** `app/_layout.tsx`'s `RootLayout` now
subscribes to `AppState`'s `"change"` event: `supabase.auth.startAutoRefresh()`
when the state is `"active"`, `supabase.auth.stopAutoRefresh()` otherwise.
This is the app's one `AppState` listener, matching the "one Supabase client"
pattern the rest of the lib follows.

**Session context.** New `src/hooks/useSession.tsx` exports a
`SessionProvider` that owns the app's one `supabase.auth.onAuthStateChange`
subscription (seeded with an initial `supabase.auth.getSession()` call so the
first render already reflects a restored session rather than a flash of
"signed out") and a `useSession()` hook that reads `{ session, isLoading }`
from its context, throwing if called outside the provider. On a `SIGNED_OUT`
event the provider calls `queryClient.clear()`.

**Query client.** New `src/lib/query-client.ts` exports the one
`QueryClient` instance for the app, as a plain module export rather than only
through context — `useSession` can call `.clear()` on it without caring where
in the tree it is read from. `app/_layout.tsx` wraps the app in
`QueryClientProvider` (this is the first ticket with a concrete need for
server-state cache invalidation; `@tanstack/react-query` was installed since
WP-0.1/SCN-1 but not wired into the tree until now) and nests `SessionProvider`
inside it.

**Root layout wiring.** `RootLayout` now returns
`QueryClientProvider > SessionProvider > SafeAreaProvider > …` instead of
`SafeAreaProvider` as the outermost element. Font loading and the splash
screen hide-on-ready effect are unchanged.

Env var reading, `persistSession: true`, `autoRefreshToken: true` and
`detectSessionInUrl: false` in `src/lib/supabase.ts` were already correct
from the earlier ticket and were not touched. "Inject the client into the
`packages/data` factory" (step 5) needed no new code: `packages/data`
functions already take a `SupabaseClient` as their first argument rather than
constructing one (`packages/data/src/index.ts`'s own doc comment), and
`src/lib/supabase.ts` already exports the one shared `supabase` instance plus
a `useSupabase()` hook — that instance is what a screen passes as the `db`
argument.

## Changes by file

- `src/lib/secure-storage.ts` — modified. Added chunking (`CHUNK_SIZE = 1800`,
  `CHUNK_SENTINEL_PREFIX`) to `readSecureItem`/`writeSecureItem`/`deleteSecureItem`,
  plus `chunkKey`, `readChunkedValue` and `deleteChunkRange` helpers. Updated
  the file's doc comment to record the chunking-vs-AES-AsyncStorage decision.
- `src/lib/secure-storage.test.ts` — new. Mocks `expo-secure-store` with an
  in-memory `Map` and covers: small-value round-trip, missing key, chunking a
  5 000-character value, shrinking a chunked value back to one key, shrinking
  from more chunks to fewer and dropping the orphaned tail, and that
  `removeItem` deletes every chunk.
- `src/lib/query-client.ts` — new. Exports the app's one `QueryClient`
  instance.
- `src/hooks/useSession.tsx` — new. `SessionProvider` + `useSession()`, as
  described above.
- `src/hooks/useSession.test.tsx` — new. Mocks `~/lib/supabase`'s `auth` via
  `vi.hoisted` and covers: throwing outside a provider, the initial
  loading→resolved transition, updating on `onAuthStateChange`, clearing the
  real `queryClient` on `SIGNED_OUT`, and unsubscribing on unmount.
- `app/_layout.tsx` — modified. Added the `AppState` listener
  (`startAutoRefresh`/`stopAutoRefresh`), wrapped the tree in
  `QueryClientProvider` and `SessionProvider`, and updated the file's doc
  comment (the "session provider... lands here in later phases" line was
  stale — it now does).
- `vitest.config.mts` — modified. Added `src/lib/**/*.test.ts` to the
  `packages` project's `include` (plain-TypeScript, no-JSX tests under `src/`
  need a home outside the `components` project, which only collects
  `.test.tsx`) and updated that project's doc comment accordingly.

## Technical decisions

- **Chunking over AES-key-in-SecureStore + encrypted AsyncStorage.** The
  ticket allowed either. Chunking keeps every byte of the session inside
  SecureStore, so AGENTS.md's "credentials live in `expo-secure-store`...
  never `AsyncStorage`" rule (and WP-2.1's own AC1) holds literally rather
  than "an encrypted blob happens to sit in AsyncStorage but the key is
  elsewhere." It also avoids a new dependency and a key-management surface
  (rotating/clearing the AES key, handling a corrupt key separately from a
  corrupt payload).
- **1 800-character chunk size**, not 2 048. The ~2 KB limit cited by the
  ticket is a platform figure for the raw stored bytes; leaving headroom
  avoids tripping the limit on a value that is short in JS `.length` but
  longer once UTF-8-encoded, without needing to measure byte length per call.
- **`queryClient` as a plain exported instance, not read via `useQueryClient()`
  inside `useSession`.** `useSession`'s effect needs to call `.clear()`
  regardless of where `SessionProvider` sits relative to
  `QueryClientProvider` in the tree; importing the singleton directly removes
  that ordering dependency. `QueryClientProvider` is still added at the root
  so future screens can call `useQuery`/`useQueryClient` normally.
- **`useSession.tsx`, not `useSession.ts` as the ticket's step 6 names it.**
  The file exports a context `Provider` component, which needs JSX; `.tsx` is
  the repo's existing convention for any file containing JSX (see
  `src/components/**`).
- **Wiring `QueryClientProvider` into the root layout now**, rather than
  waiting for "the first screen that needs server-state caching" (the
  deferral SCN-1 recorded when `@tanstack/react-query` was first installed).
  This ticket's own AC — invalidating the cache on sign-out — has no effect
  without a `QueryClient` existing somewhere, so WP-2.1 is that first
  consumer.

## Data, API and configuration

None. No new dependencies (`@tanstack/react-query` was already in
`package.json` from SCN-1), no new env vars, no schema or RPC changes.

## How to verify

- `npm run type-check` — passes.
- `npm test` — 358/358 tests pass across both vitest projects, including the
  12 new tests in `secure-storage.test.ts` and `useSession.test.tsx`.
- `npm run lint` — passes.
- Not verified on-device in this change (no physical device/simulator in this
  environment): AC4 (session survives a full app kill and relaunch) and AC5
  (backgrounding over an hour then foregrounding refreshes the token) both
  follow directly from `persistSession: true` + the SecureStore adapter
  (AC4) and the new `AppState` listener calling `startAutoRefresh()`/
  `stopAutoRefresh()` (AC5), but should be exercised on a real device against
  the live Supabase project before this is considered fully closed.

## Limitations and follow-ups

- `useSession()` is written but not yet consumed by any screen — WP-2.2's
  auth screens and WP-2.6's route guard are the first real callers.
- No test exercises the chunked adapter against the real `expo-secure-store`
  native module (only the mocked in-memory version) — only a real
  device/simulator can confirm the actual ~2 KB platform limit and chunk
  size chosen here are compatible end to end.
- `QueryClientProvider`'s default cache options (stale time, retry count,
  etc.) were left at TanStack Query's defaults; tuning them is left to
  whichever ticket adds the first real query.
