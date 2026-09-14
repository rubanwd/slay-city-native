# AGENTS.md — SLAY CITY Native Operating Manual

The operating manual for `slay-city-native`.

Everything in the web repository's `AGENTS.md` still applies — the product loop, the
brand palette, the database rules, the security rules, the four-role system. That
document is the product's constitution and this repository does not get to amend it.
This one adds what is specific to the native app, and overrides it only where it says
so explicitly.

**The web repository's `AGENTS.md` is at `upstream/AGENTS.md`** once you have run
`npm run upstream:fetch`. Read it.

## Development commands

```bash
npm install
npm run lint
npm run type-check
npm run test
npx expo start
npx expo run:ios | run:android   # dev build on a device
eas build --profile preview      # cloud build, no Mac required

# Shared-logic drift against the live web app — see docs/SYNC.md
git clone --depth 1 https://github.com/rubanwd/slay-city /tmp/upstream
node scripts/check-upstream-drift.mjs --upstream /tmp/upstream
```

## Layer rules — enforced by lint, not by convention

| Package | May import | Must never import |
| --- | --- | --- |
| `packages/core` | TypeScript stdlib only | React, React Native, Next.js, `@supabase/*` |
| `packages/data` | `core`, `@supabase/supabase-js` types | React, React Native, Next.js |
| `packages/tokens` | nothing | everything |
| `src/`, `app/` | all packages, Expo | `next/*`, `upstream/` |
| `upstream/` | — | read-only reference; never imported from, never edited, never committed |

**If a piece of logic could be needed by the web app, it goes in `packages/core`.**
Reward maths, unlock rules, validation, puzzle generation, i18n, streak logic — all
core, never a screen. A screen renders and dispatches. It does not decide.

## Structure

```
slay-city-native/
├── app/                  # Expo Router — routes only, thin
│   ├── _layout.tsx       # session, fonts, audio, splash, route guard
│   └── (auth)/ (student)/ (teacher)/ (parent)/
├── src/
│   ├── components/ui/    # design-system primitives
│   ├── components/layout/
│   ├── features/         # mirrors the web's feature folders, screens only
│   ├── animations/       # one hook per web keyframe, same name
│   ├── hooks/
│   └── lib/              # supabase client, secure storage, audio adapter
├── packages/core|data|tokens/
├── upstream/             # read-only checkout of the web app — GITIGNORED
└── assets/               # fonts, icons, splash, sounds
```

### Working with `upstream/`

```bash
npm run upstream:fetch               # current upstream head — use this to port
npm run upstream:fetch -- --baseline # the commit this repo was seeded from
```

It is the original implementation, in the same checkout as the file you are writing.
Read it constantly — the diff between `upstream/src/features/mission/QuizTask.tsx`
and `src/features/mission/QuizTask.tsx` is exactly what a reviewer needs to see.

Three rules, all absolute: **never import from it, never edit it, never commit it.**
It is gitignored on purpose. A snapshot committed here would go stale within weeks,
and porting from stale code reproduces behaviour that no longer exists — which looks
correct in review. Fetch it fresh instead; it is one command.

## Shared logic is a tracked copy, not a fork

`packages/core` duplicates ~6 000 lines that also live in `rubanwd/slay-city`. The
web repository is upstream and authoritative.

**Never edit a tracked file here to fix a shared bug.** Fix it upstream, then sync.
A local edit to a tracked file is how two copies stop being copies — and how the
phone starts paying different XP than the browser for the same mission.

The manifest, the drift check and the resolution rules are in `docs/SYNC.md`.

## Migrations belong upstream

This repository has no `supabase/` directory and never runs `supabase db push`.
Both apps share one Supabase project, and `rubanwd/slay-city` owns its migration
timeline.

Need a new RPC or Edge Function? Open a pull request against the web repository.

Route files stay thin: resolve params, call a hook, render a feature component.
No data fetching and no business logic inside `app/`.

## Styling

- NativeWind v4 with the shared preset from `@slay/tokens`. Class names first.
- Drop to `StyleSheet` only where NativeWind genuinely cannot express it — measured
  layouts, animated styles.
- **Never a raw hex value.** The six brand colours are locked by the root manual.
- `rounded-2xl` or larger on cards.
- Design at 390 pt. Verify at 428 pt, a 20:9 Android, and a tablet.
- Every screen wraps in `SafeAreaView` or uses safe-area insets. A notch eating the
  primary action is a bug.
- Touch targets at least 44×44 pt.

## Animation

- `react-native-reanimated` only. Nothing on the JS thread.
- Animate `transform` and `opacity`. Animating `width`, `height` or `top` triggers
  layout on every frame.
- One hook per web keyframe in `src/animations/`, keeping the web's name
  (`useGlowPulse`, `useLoaderBob`, …) so the two platforms stay comparable.
- Slay is the emotional centre — the mascot is present and alive on map, mission and
  reward screens, as the root manual requires.

## State and data

- Server state: TanStack Query. Never `useEffect` + `useState` for a fetch.
- `invalidateQueries` replaces the web's `revalidatePath`.
- Credentials in `expo-secure-store`. Preferences in `AsyncStorage`. Never the
  reverse — session tokens are credentials.
- Every data call goes through `@slay/data` with the mobile client injected. A screen
  never writes a raw `.from()` query.

## Security — non-negotiable

- **No XP, coin, streak or unlock logic in the app.** Rewards come from
  `complete_mission()` and nowhere else. A mobile binary is fully readable by its
  user; anything the client could decide, a user could forge.
- **No secrets in the bundle.** No `OPENROUTER_API_KEY`, no service-role key, ever.
  The anon key is public by design and is the only key allowed.
- Privileged work happens in a `SECURITY DEFINER` RPC or an Edge Function that
  re-checks the caller's role in SQL. A client-side role check is a UX affordance,
  never an authorisation.
- Any new direct table write needs an RLS policy that would stop a hostile client,
  and a negative test proving it does.

## Timers and app lifecycle

Use the shared `useAppStateAwareInterval` hook for every interval. A phone does not
throttle a backgrounded app the way a browser throttles a hidden tab: an unmanaged
timer drains battery, records study time for a pocket, and desyncs game state.

Audio stops on background. The study heartbeat stops on background. Game loops pause
and resume without losing state.

## Mission tasks

- Every task implements the frozen `TaskProps` contract from `WP-3.2`.
- A task reports outcomes. It never computes a reward.
- Content comes from the database. Never hardcode mission text, vocabulary or quiz
  content — this is a root-manual rule and it applies identically here.
- Text-input tasks configure `autoCorrect`, `autoCapitalize` and `spellCheck`
  explicitly. A spelling exercise whose keyboard suggests the answer is broken.

## Language

Per the root manual, and unchanged on mobile: mission content, authored content and
knowledge-level names stay **English** — the English is the lesson. Translated
surfaces are the parent console in full, and on the student side only the profile
screen and the tab bar.

## Definition of done

The web repository's Definition of Done items 1–10 still apply, plus:

1. `npm run lint`, `type-check` and `test` pass.
2. Verified on a **physical iOS device and a physical Android device** — not only a
   simulator. Simulators lie about performance, keyboards, safe areas and haptics.
3. Tested at 390 pt and at least one other width.
4. No new raw hex colours; brand tokens only.
5. No business logic added to `src/` that the web would also need — it belongs in `packages/core`.
6. No tracked file in `packages/core` edited locally; the drift check passes.
7. No secrets in the diff; if the package touches an API key, the built binary was
   grepped for it.
8. Screenshots attached to the PR for any visual change.
9. New timers use `useAppStateAwareInterval`.
10. Accessibility labels on new interactive elements.

## What not to change without permission

Everything in the root manual's list, plus:

- The layer rules above, and the sync contract — together they are what keeps one product from becoming two.
- The frozen `TaskProps` contract.
- The decision that this repository holds no secrets and no `supabase/` directory.
- The choice of Expo managed workflow. Ejecting to bare React Native is a one-way
  door that gives up EAS Build's Mac-free iOS builds.
