# SCN-4 — Set up Supabase client and secure storage in packages/lib

> Type: task · Date: 2026-09-28

## Context

Every future screen needs three pieces of plumbing before any real feature can
be built: a Supabase client, a place to keep session tokens and secrets that
isn't `AsyncStorage`, and a seam for sound playback that mission tasks will
fill in later. WP-2.1 (`docs/WORK-PACKAGES.md`) and `docs/MIGRATION-MAP.md` §6
already name this work and its destination; SCN-4 is the ticket that asked for
it to actually be built, deliberately scoped to plumbing only — no sign-in,
sign-up or session-restoration flow yet.

## What was done

Created three modules under `src/lib/` (see "Technical decisions" for why not
`packages/lib`, which is what the ticket's title literally says) and two hooks
under `src/hooks/` that expose them to screens:

- **`src/lib/secure-storage.ts`** — `readSecureItem` / `writeSecureItem` /
  `deleteSecureItem` wrap `expo-secure-store`'s `getItemAsync` /
  `setItemAsync` / `deleteItemAsync`. They're re-exported as `secureStorage`,
  an object shaped exactly like the `getItem`/`setItem`/`removeItem` storage
  interface `@supabase/supabase-js` expects for its auth adapter.
- **`src/lib/supabase.ts`** — calls `createClient<Database>` from
  `@supabase/supabase-js`, typed against `@slay/core/types`'s `Database`, and
  configured with `auth.storage: secureStorage`, `autoRefreshToken: true`,
  `persistSession: true`, `detectSessionInUrl: false`. The URL and anon key
  come from `process.env.EXPO_PUBLIC_SUPABASE_URL` /
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, which Metro inlines at build time whether
  they're set via a local `.env` or `expo.extra` in `app.json` (Expo merges
  both into `process.env` for `EXPO_PUBLIC_*` keys). Missing either throws
  immediately with a message pointing at `.env.example`, rather than
  constructing a client that silently fails every request.
- **`src/lib/audio-adapter.ts`** — `createSoundPlayer(source)` lazily calls
  `setAudioModeAsync({ playsInSilentMode: true })` once, then
  `createAudioPlayer(source)` from the newly-added `expo-audio` package.
  Exported as `audioAdapter` for mission components to call once they exist;
  no sound-effect sequencing logic lives here, matching the ticket's "not
  implemented until mission components need it."
- **`src/hooks/useSupabase.ts`** and **`src/hooks/useSecureStorage.ts`** — thin
  hooks returning the `supabase` client and the `secureStorage` object
  respectively, so screens consume them the same way they'll consume any other
  app-provided value (and so tests can mock the import).

`expo-audio` wasn't a dependency yet; added via `npx expo install expo-audio`
(SDK-57-compatible `~57.0.5`), which also registered the `expo-audio` config
plugin in `app.json` automatically.

Added `.env.example` documenting the two `EXPO_PUBLIC_*` variables (no real
values — this repository holds no secrets, and the anon key, while public by
design, still isn't mine to invent), and added `.env` to `.gitignore` (only
`.env*.local` was previously ignored).

## Changes by file

- `src/lib/secure-storage.ts` — new. `expo-secure-store` read/write/delete
  wrapper plus the `secureStorage` object shaped for Supabase's auth storage
  adapter.
- `src/lib/supabase.ts` — new. The app's single `createClient<Database>`
  instance, wired to `secureStorage` and reading its URL/anon key from env.
- `src/lib/audio-adapter.ts` — new. `expo-audio`-backed `createSoundPlayer`,
  initialized (audio mode configured once) but with no playback logic beyond
  creating a player.
- `src/hooks/useSupabase.ts` — new. Returns the shared `supabase` client.
- `src/hooks/useSecureStorage.ts` — new. Returns the shared `secureStorage`
  object.
- `.env.example` — new. Documents `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `.gitignore` — modified. Added a bare `.env` entry alongside the existing
  `.env*.local` pattern.
- `package.json` / `package-lock.json` — modified. Added `expo-audio: ~57.0.5`
  (via `npx expo install`, which also verified SDK compatibility).
- `app.json` — modified. `expo-audio` added to the `plugins` array
  (automatically, by `expo install`).

## Technical decisions

- **Built the three modules under `src/lib/`, not `packages/lib`, despite the
  ticket's title and body naming `packages/lib` three times.** This
  repository's own architecture documents are unanimous and specific about the
  destination: `docs/ARCHITECTURE.md`'s repository-shape diagram lists
  `src/lib/ # supabase client, secure storage, audio adapter` verbatim;
  `AGENTS.md`'s structure section repeats the same line; and
  `docs/MIGRATION-MAP.md` §6 maps `lib/supabase/client.ts, server.ts` directly
  to `src/lib/supabase.ts` with a SecureStore adapter — this ticket's own
  design, stated before it was written. The layer-rules table in both
  `AGENTS.md` and `docs/ARCHITECTURE.md` enumerates exactly three packages —
  `core`, `data`, `tokens` — and `tsconfig.json`'s `paths` has aliases for
  those three plus `@/*` and `~/*`, with no `@slay/lib` anywhere. Creating a
  fourth package that no alias resolves, that ESLint's `no-restricted-imports`
  layer rules don't know about, and that contradicts an explicit, current
  migration-map entry would be inventing a second, competing answer to a
  question the project has already answered. Treating "packages/lib" as
  imprecise ticket phrasing for "the lib layer" and building it where the
  architecture says it goes was the smaller deviation.
- **Wired `secureStorage` into the Supabase client's `auth.storage` now,
  rather than leaving `createClient` unconfigured.** The ticket says not to
  implement authentication *logic* (no sign-in/sign-up/session-restore flows),
  but AGENTS.md is unconditional that "credentials in `expo-secure-store` …
  never the reverse — session tokens are credentials," and WP-2.1 AC1 states
  the same. Passing the storage adapter at construction time is configuration,
  not a flow, and getting it right from the first commit avoids a later PR
  quietly switching 
  the default (`AsyncStorage`) out from under an app that already has
  sessions on disk.
- **Did not wire an `AppState` listener to start/stop `autoRefreshToken`.**
  That's WP-2.1 AC3/AC5 territory and is explicitly about session lifecycle,
  which this ticket excludes. Left for the auth work package.
- **Env vars via `EXPO_PUBLIC_*` + `process.env`, not `expo-constants` +
  `app.json extra`.** Expo SDK 49+ inlines `EXPO_PUBLIC_*` vars from `.env`
  directly through Metro with no extra config, and the same keys can be set
  under `expo.extra` in `app.json` if a build ever needs to bake in a
  per-environment value — satisfying the ticket's "from app.json or .env"
  without maintaining two separate code paths.
- **No real Supabase URL or anon key committed anywhere.** Nothing in the
  ticket, the codebase or `docs/` supplied the shared project's actual
  credentials, and inventing placeholder-looking-real values would be worse
  than an honest blank — `.env.example` documents the two names and a human
  fills in `.env` locally, which is also the only file the client reads that
  is meant to vary per machine.

## Data, API and configuration

- New dependency: `expo-audio@~57.0.5` (SDK-57-compatible, added via
  `expo install`). No other dependency changes.
- New env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  (documented in `.env.example`, read by `src/lib/supabase.ts`). No values are
  committed; the app throws a descriptive error at import time if either is
  missing.
- `app.json`'s `plugins` array gained `"expo-audio"`, alongside the existing
  `"expo-router"` and `"expo-secure-store"`.
- No schema, RPC, or Supabase-project-side changes — this package never
  constructs privileged access; the anon key is the only key it will ever
  hold, per `AGENTS.md`.

## How to verify

- `npm run type-check` — passes with no errors.
- `npm run lint` — passes with no warnings or errors (confirms the new
  `src/lib` and `src/hooks` files don't trip the `no-restricted-imports` layer
  rules, and that nothing under `packages/*` was touched).
- `npm test` — 184/184 tests pass across 16 files, unchanged from before this
  run (no test files were added or modified; there is no runtime to exercise
  yet beyond what type-checking already covers).
- Manual: with `.env` absent, importing `src/lib/supabase.ts` (e.g. via
  `useSupabase()` from a screen) throws
  `"Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY…"`
  rather than constructing a client pointed at `undefined`. Copying
  `.env.example` to `.env` with the shared project's real URL and anon key
  should make `useSupabase()` return a working client — not exercised here
  since no credentials were available in this environment.

## Limitations and follow-ups

- No credentials were available to actually connect to the shared production
  Supabase project; a maintainer needs to fill in `.env` from the real project
  values to smoke-test the client against a live backend.
- No sign-in/sign-up/session-restore UI, and no `AppState`-driven
  auto-refresh start/stop — both belong to WP-2.1/WP-2.2's auth work, which
  this ticket explicitly excluded.
- `audioAdapter.createSoundPlayer` only creates a configured `AudioPlayer`; no
  mission task calls it yet, and no sound assets are wired in. That lands with
  the first mission task component that needs audio.
- The ticket's literal instruction to use `packages/lib` was not followed —
  see "Technical decisions" above. Flagging this explicitly in case the
  ticket's author intended something the current `docs/ARCHITECTURE.md` /
  `docs/MIGRATION-MAP.md` don't yet reflect; if so, those documents need
  updating before a `packages/lib` layer would make sense (a new package
  needs a layer rule, a tsconfig/webpack alias, and an ESLint entry, none of
  which exist today).
