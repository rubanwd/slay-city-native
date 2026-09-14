# Target Architecture

## 1. Repository shape

The web app is in production and is not restructured. The native app gets its own
repository, seeded with a snapshot of the current code. The reasoning is in
[CONCEPT.md](CONCEPT.md) §1; this document covers the consequences.

```
slay-city-native/
├── app/                      # Expo Router — routes only, thin
│   ├── _layout.tsx           # session, fonts, audio, splash, route guard
│   └── (auth)/ (student)/ (teacher)/ (parent)/
├── src/
│   ├── components/ui/        # design-system primitives
│   ├── components/layout/
│   ├── features/             # screens, mirroring the web's feature folders
│   ├── animations/           # one hook per web CSS keyframe
│   ├── hooks/
│   └── lib/                  # supabase client, secure storage, audio adapter
├── packages/
│   ├── core/                 # pure logic — tracked copy of upstream
│   ├── data/                 # Supabase queries + RPC wrappers
│   └── tokens/               # brand palette and type scale
├── upstream/                 # read-only checkout of the web app — GITIGNORED
├── scripts/fetch-upstream.mjs, check-upstream-drift.mjs
├── UPSTREAM_BASELINE         # the commit this repo was seeded from
├── docs/
└── assets/
```

### Layer rules

| Layer | May import | Must never import |
| --- | --- | --- |
| `packages/core` | nothing but the TypeScript stdlib | React, React Native, Next.js, `@supabase/*` |
| `packages/data` | `core`, `@supabase/supabase-js` types | React, React Native, Next.js |
| `packages/tokens` | nothing | everything |
| `src/`, `app/` | all packages, Expo | `upstream/`, `next/*` |
| `upstream/` | — | read-only reference; never imported from, never edited, never committed |

Enforced by ESLint `no-restricted-imports`, not by convention. These rules are what
keeps one product from quietly becoming two.

`packages/data` never constructs a Supabase client. Every function takes one as its
first argument, so the same code path can be driven by a SecureStore-bound client
here and a cookie-bound one on the web:

```ts
// packages/data/src/mission.ts
export async function completeMission(
  db: SupabaseClient<Database>,
  missionId: string,
  rewardFraction = 1,
): Promise<MissionCompletionResult> { /* … */ }
```

### The shared-logic copy

`packages/core` holds ~6 000 lines that the web app also has. It is a **tracked
copy**, not a dependency: every file records its upstream path and content hash, and
CI fails when upstream changes a tracked file.

This is the cost of not restructuring a live product. The full contract — what is
tracked, how drift is resolved, and the signals that say the arrangement has stopped
paying for itself — is in [SYNC.md](SYNC.md). Read it before M0.

### Supabase ownership

One Supabase project serves both apps. `rubanwd/slay-city` owns `supabase/` and is
the only repository that applies migrations; its CI already does so on every merge to
`main`.

This repository contains **no `supabase/` directory**. New RPCs and Edge Functions
are opened as pull requests against the web repository. Two repositories writing to
one migration timeline produce conflicting version numbers and a schema history
nobody can reconstruct.

## 2. Mobile stack

| Concern | Choice | Replaces |
| --- | --- | --- |
| Runtime | Expo SDK (managed), React Native, TypeScript | Next.js runtime |
| Routing | Expo Router (file-based, mirrors App Router) | `src/app/**` routing |
| Styling | NativeWind v4 + shared Tailwind preset | Tailwind CSS |
| Animation | `react-native-reanimated` | CSS `@keyframes` |
| Gradients / blur | `expo-linear-gradient`, `expo-blur` | CSS gradients, `backdrop-filter` |
| Images | `expo-image` | `<img>` |
| Audio | `expo-audio` | Web Audio API (`src/lib/audioContext.ts`) |
| Haptics | `expo-haptics` | — (new) |
| Session storage | `expo-secure-store` | HTTP-only cookies |
| Deep links | `expo-linking`, scheme `slaycity://` | `NEXT_PUBLIC_SITE_URL` redirects |
| Server state | TanStack Query | Server Components + `revalidatePath` |
| Builds | EAS Build + EAS Submit | Vercel |
| OTA updates | EAS Update | Vercel deploys |

EAS Build compiles iOS in the cloud, so **no Mac is required** to produce a build.
An Apple Developer account still is, to sign and ship it.

## 3. How the backend boundary moves

This is the heart of the migration. Today the browser never touches privileged
logic — a Server Action does, after a `requireTeacher()` / `requireAdmin()` guard.
React Native has no Server Actions, so each of the 26 action files must land in one
of three places.

### Category A — thin RPC wrappers (18 files) → `packages/data`

`submitMissionCompletion`, `purchaseWardrobeItem`, `equipWardrobeItem`,
`recordStudyTime`, `setMyKnowledgeLevel`, `completeHomeworkVocab`,
`resetLocationProgress` and the rest are three-line wrappers around a
`SECURITY DEFINER` RPC. The security lives in Postgres, not in the action.

Moving them changes **nothing** about the trust model: the RPC still validates, the
RLS policies still apply, XP and coins are still granted exclusively by
`complete_mission()`. The web's action file shrinks to a call into `packages/data`.

### Category B — direct table writes behind a role guard (5 files) → new RPCs

`src/features/teacher/vocabularyActions.ts` (14 direct `.from()` writes),
`grammarActions.ts` (9), `teacher/actions.ts` (3), `homework/qa/actions.ts` (3),
`onboarding/actions.ts` (2) write to tables directly and rely on the server-side
`requireTeacher()` guard for authorisation.

**That guard cannot exist on a phone.** Shipping these as direct client writes would
let any signed-in student author homework for any group, if RLS does not already
forbid it. Every one of these paths must be audited and, where RLS is not already
sufficient, wrapped in a new `SECURITY DEFINER` RPC that re-checks the caller's role
in SQL.

This is the single highest-risk work in the migration. It is `WP-2.3` and it gates
the entire teacher console.

### Category C — OpenRouter AI generation (6 files) → Supabase Edge Functions

`openRouterChat.ts`, `openRouterImage.ts` and their callers hold
`OPENROUTER_API_KEY`. A mobile binary is not a secret store — anyone can extract a
key from an `.ipa` in minutes. These move to Edge Functions:

| New Edge Function | Replaces | Guard |
| --- | --- | --- |
| `draft-vocabulary` | `teacher/vocabularyActions.ts` AI path | caller must be `teacher` |
| `draft-grammar` | `teacher/grammarActions.ts` AI path | caller must be `teacher` |
| `generate-image` | `admin/openRouterImage.ts` callers | caller must be `admin` |

The secret moves from Vercel env vars to Supabase Secrets. The web's Server Actions
become thin callers of the same functions, so there is one implementation, not two.

> **Requires product-owner approval.** The root `AGENTS.md` lists *"The decision to
> call OpenRouter exclusively from Next.js Server Actions"* under **What Not to
> Change Without Permission**. There is no way to ship AI drafting to a mobile
> teacher console without changing it. See Open Decision **OD-1**.

### Category D — not ported

`src/features/admin/**` in the web app (all of it, including `generateTaskImage.ts`,
`missionImageActions.ts`, `uploadContentImage.ts`, `ImageCropField.tsx` and its
`react-easy-crop` dependency) stays in the web repository, untouched.

## 4. Authentication

```
Web                                Mobile
───                                ──────
HTTP-only cookie                   expo-secure-store
middleware.ts route guard          root-layout session guard + <Redirect>
NEXT_PUBLIC_SITE_URL/auth/callback slaycity://auth/callback
Google OAuth via redirect          expo-auth-session + setSession()
```

Client construction differs in three settings:

```ts
createClient(url, anonKey, {
  auth: {
    storage: SecureStoreAdapter,   // not AsyncStorage — these are credentials
    detectSessionInUrl: false,     // no URL bar on a phone
    autoRefreshToken: true,
  },
})
```

plus an `AppState` listener calling `startAutoRefresh` / `stopAutoRefresh`, without
which tokens silently expire while the app is backgrounded.

`roleHome()` in `src/features/auth/roleRouting.ts` already encodes where each role
lands after sign-in. It moves to `packages/core` and drives the mobile guard
unchanged — the routing rules do not get rewritten, only the redirect mechanism.

Supabase's redirect allow-list must gain the mobile deep links **alongside** the
existing web URLs; removing the web ones breaks password reset in production.

> **Requires product-owner approval.** App Store Review Guideline 4.8 requires an
> equivalent privacy-preserving login option — in practice Sign in with Apple —
> whenever an app offers third-party social login. SLAY CITY offers Google. The root
> `AGENTS.md` puts Apple OAuth under **Do Not Build Yet**. One of the two has to
> give. See Open Decision **OD-2**.

## 5. Design system

`tailwind.config.ts` expresses brand colours as `rgb(var(--color-neon-pink) /
<alpha-value>)` against CSS custom properties in `src/styles/theme.css`. React
Native has no CSS variables at runtime, so the tokens become plain TypeScript and
both platforms derive from them:

```
packages/tokens/src/
├── colors.ts      # #FF2D8E, #9DFF00, #00F0FF, #6A00FF, #111111, #FFFFFF
├── typography.ts  # the --fs-* / --lh-* / --ls-* scale as numbers
├── radii.ts
└── preset.ts      # Tailwind preset consumed by web config and NativeWind config
```

The palette itself is locked by `AGENTS.md` and does not change — only where the
numbers are declared.

Nunito ships as a bundled font asset loaded with `expo-font`, rather than fetched.

### The eight keyframe animations

`src/styles/globals.css` defines `glow-pulse`, `logo-shimmer-sweep`, `loader-bob`,
`loader-shadow`, `loader-dot`, `label-float`, `watermark-breathe` and
`banner-drop`. Each becomes a Reanimated hook in
`src/animations/`, keeping the same name so the two platforms stay
reviewable against each other.

## 6. Mission task types — the good news

A full interaction audit of all 32 `*Task.tsx` files found:

- **0 use drag gestures.** `WordSearchTask` selects by tapping the first and last
  cell (`tapCell(r, c)`); `SentenceBuilderTask`, `StorySequencingTask`,
  `CategorySortTask` and `MatchingTask` are all tap-to-select. The one
  `onPointerDown` in `WordSearchTask` is a tooltip dismisser.
- **5 take text input**, and `SnakeGameTask`'s keyboard handler is a desktop
  convenience on top of on-screen D-pad buttons that already exist.
- The heavy state machines (`snakeGrid.ts`, `wordPuzzle.ts`, `missionReward.ts`)
  are already pure modules with unit tests, and move to `packages/core` untouched.

This turns the mission port from bespoke gesture engineering into mostly mechanical
JSX translation, and is the main reason the estimate in
[03-roadmap.md](ROADMAP.md) is what it is.

## 7. Open decisions

Blocking. Each needs an explicit answer before the phase that depends on it starts.

| ID | Decision | Options | Blocks |
| --- | --- | --- | --- |
| **OD-1** | Move OpenRouter calls out of Server Actions into Edge Functions | (a) Yes — one implementation, both platforms. **Recommended.** (b) No — teacher AI drafting is web-only, mobile teachers author manually | M4 |
| **OD-2** | Sign in with Apple | (a) Implement it — keeps Google everywhere. **Recommended.** (b) Hide Google on iOS, email/password only there | M2, M7 |
| **OD-3** | Apple Kids Category | (a) Enter it — better discovery, but bans third-party analytics and needs a parental gate. (b) Stay out, rate 4+. **Recommended** — Google Analytics is already wired in via `@next/third-parties` | M7 |
| **OD-4** | Analytics on mobile | (a) Drop GA on mobile. **Recommended if OD-3(a).** (b) Keep it | M6 |
| **OD-5** | Offline play depth | (a) Read-only cache of map + profile. **Recommended for v1.** (b) Full offline missions with a sync queue — significant extra work | M6 |
| **OD-6** | Push notifications | (a) Defer past v1. **Recommended** — `AGENTS.md` lists it under Do Not Build Yet. (b) Ship streak reminders in v1 | M6 |
| **OD-7** | The signed-out demo (`/demo`) on mobile | (a) Skip — the store listing is the discovery surface. **Recommended.** (b) Port it | M3 |
