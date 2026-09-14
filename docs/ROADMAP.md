# Roadmap

Nine phases, M0 → M8. A phase is not done because its code exists — it is done
because its exit criterion is demonstrably met on a real device.

`rubanwd/slay-city` is untouched throughout, except for the pull requests named in
§ *Cross-repository work* below.

## Overview

| Phase | Name | Eng. days | Calendar | Exit criterion |
| --- | --- | --- | --- | --- |
| **M0** | Foundations — new repo, snapshot, shared packages | 4 | wk 1 | Drift check green, Expo app builds |
| **M1** | Mobile shell — routing, design system | 5 | wk 2 | App opens on a real phone |
| **M2** | Auth & session | 5.5 | wk 3 | Sign in, reset, refresh all work natively |
| **M3** | Student core loop — map → mission → reward | 10 | wk 4–5 | A mission completes and pays out correctly |
| **M4** | Student surround — homework, wardrobe, profile | 7 | wk 6–7 | Student app feature-complete |
| **M5** | Teacher & parent consoles | 11 | wk 7–9 | All three roles usable |
| **M6** | Polish — animation, audio, offline, performance | 7 | wk 9–10 | 60 fps on a low-end Android |
| **M7** | Store readiness — accounts, compliance, builds | 5 + wait | wk 10–12 | Builds submitted for review |
| **M8** | Beta, review, launch | — | wk 12–14 | Live in both stores |

**~54.5 engineering days. ~12–14 calendar weeks to launch**, of which 2–4 weeks is
store-review latency that cannot be compressed.

Everything before M7 is work I can do in the repository. M7 and M8 need you: Apple
and Google accounts, physical devices, and legal text with your name on it.

## Dependency graph

```
M0 ── M1 ── M2 ──┬── M3 ── M4 ──┐
                 │              ├── M6 ── M7 ── M8
   WP-2.3 ───────┴───── M5 ─────┘
   (RLS audit, upstream PR)

WP-7.1 (dev accounts) ─── start at M0, needed by M7
OD-1, OD-2 answered ───── needed by M4, M2
```

Two things must start earlier than their phase:

- **WP-7.1 — Apple and Google developer accounts.** Apple's organisation
  verification can take weeks (D-U-N-S lookup). Start it in week 1, not week 10.
- **WP-2.3 — the teacher RLS audit.** It gates all of M5, it is the one piece of work
  where being wrong means a security hole rather than a bug, and it lands as a pull
  request against the *web* repository, so it needs review time there.

## Cross-repository work

Three work packages produce changes to `rubanwd/slay-city` rather than to this
repository. They are pull requests against the live product and are reviewed as
such.

| Package | What lands upstream | Why it cannot live here |
| --- | --- | --- |
| `WP-2.3` | New `SECURITY DEFINER` RPCs for teacher writes | The web repo owns `supabase/migrations/` and its CI applies them |
| `WP-5.6` | `draft-vocabulary`, `draft-grammar` Edge Functions | Same — plus the web's Server Actions become callers, so one implementation serves both apps |
| `WP-2.4` | Nothing in code — a Supabase dashboard change | The redirect allow-list gains `slaycity://` **alongside** the web URLs |

Everything else is confined to `slay-city-native`.

## Parallelisation

Work packages are sized for independent agents. Safe concurrency:

| Phase | Parallel tracks |
| --- | --- |
| M0 | 1 — everything else depends on these packages |
| M1 | 2 — design-system primitives ‖ navigation skeleton |
| M3 | 3 — map ‖ mission tiers 1–2 ‖ mission tiers 3–4 |
| M4 | 4 — homework ‖ wardrobe+profile ‖ onboarding+levels ‖ feedback+i18n |
| M5 | 2 — teacher ‖ parent |
| M6 | 3 — animation ‖ audio+haptics ‖ offline+perf |

M3's mission work is the best parallelisation target: 32 independent components
against one shared `TaskRunner` contract. Freeze that contract first (`WP-3.2`),
then fan out.

---

## M0 — Foundations
**4 days · no dependencies · start immediately**

Stand up the new repository, seeded with a snapshot of the current app, and extract
the shared packages with a working drift contract. The web repository is not
modified.

- `WP-0.1` Repository bootstrap: Expo app, TypeScript, NativeWind, CI skeleton, and
  the `upstream/` reference mechanism — a read-only checkout of `rubanwd/slay-city`
  fetched on demand, gitignored, excluded from build, lint, tests and `tsconfig.json`
- `WP-0.2` `packages/core` — copy the pure modules with their tests, write
  `.upstream.json`
- `WP-0.3` `packages/data` — queries and RPC wrappers, Supabase client injected
- `WP-0.4` `packages/tokens` — palette and type scale
- `WP-0.5` Drift contract — `check-upstream-drift.mjs`, CI job, nightly schedule

**Exit:** `npm run lint`, `type-check` and `test` pass; the drift check reports every
tracked file in sync; a bare Expo app builds; `rubanwd/slay-city` has zero commits
from this work.

> The equivalent phase under a monorepo plan carried the project's largest risk — a
> refactor of every import path in the live product. That risk is now gone. This is
> the concrete win of the two-repository decision, and it is worth naming.

## M1 — Mobile shell
**5 days · needs M0**

- `WP-1.1` Expo Router configuration, path aliases to the packages
- `WP-1.2` Nunito via `expo-font`; typography components matching `typography.css`
- `WP-1.3` Design-system primitives: `SlayButton`, `SlayCard`, `Section`, `Grid`,
  `AppContainer`, `ScrollScreen`, `ProgressBar`, `CurrencyAmount`, `StreakBadge`
- `WP-1.4` Icons to `react-native-svg`
- `WP-1.5` Route skeleton with role groups and placeholder screens
- `WP-1.6` Portrait lock, splash, app icon, dark `#111111` base

**Exit:** the app installs on a physical iPhone and a physical Android phone,
navigates between placeholders, and a side-by-side screenshot of the primitives
against the web app is approved.

## M2 — Auth & session
**5.5 days · needs M1 · needs OD-2 answered**

- `WP-2.1` Supabase client with SecureStore adapter and `AppState` auto-refresh
- `WP-2.2` Login, register, forgot-password, reset-password screens
- `WP-2.3` **Teacher/parent RLS audit** → upstream PR
- `WP-2.4` Deep links: scheme, `slaycity://auth/callback`, Supabase allow-list
- `WP-2.5` Google OAuth via `expo-auth-session`; Sign in with Apple if OD-2(a)
- `WP-2.6` Route guard driven by `roleHome()` from core

**Exit:** a real account signs in on both platforms; the session survives an app
restart and a 24-hour gap; a password-reset email opens the app at the right screen;
each of the four roles lands on its own home; **web password reset still works**.

## M3 — Student core loop
**10 days · needs M2**

The loop is the product. Nothing else matters if this does not feel good.

- `WP-3.1` City map: background, location nodes, mascot marker, pan and zoom
- `WP-3.2` `TaskRunner` contract and `MissionScreen` shell — **freeze before fan-out**
- `WP-3.3` Tier 1 tasks — 21 tap-only components
- `WP-3.4` Tier 2 tasks — 6 timed components
- `WP-3.5` Tier 3 tasks — 3 text-input components
- `WP-3.6` Tier 4 — `WordSearchTask`, `SnakeGameTask`
- `WP-3.7` Reward screen and modal

**Exit:** on a physical device, a student opens the map, completes one mission of
each of the 32 task types, sees the reward, and the XP and coins in Supabase match
what the web app grants for the same mission.

## M4 — Student surround
**7 days · needs M3 · needs OD-1 and OD-7 answered**

`WP-4.1` homework · `WP-4.2` wardrobe · `WP-4.3` profile and levels ·
`WP-4.4` onboarding · `WP-4.5` study-time tracker · `WP-4.6` feedback ·
`WP-4.7` i18n

**Exit:** every student-facing route in the migration map exists and works; the
student app is feature-complete against the web app.

## M5 — Teacher & parent consoles
**11 days · needs M2 and WP-2.3 merged upstream · needs OD-1 answered**

`WP-5.1` dashboard and groups · `WP-5.2` topic authoring · `WP-5.3`
`VocabularyManager` · `WP-5.4` `GrammarManager` · `WP-5.5` Q&A ·
`WP-5.6` AI drafting → upstream Edge Functions · `WP-5.7` view-as-student ·
`WP-5.8` `ParentDashboard` · `WP-5.9` parent profile and linking

**Exit:** a teacher authors a topic on a phone and a student receives it; a parent
sees that student's progress update. Nothing is left to port, so `upstream/` is
needed only for the drift check from here on.

## M6 — Polish
**7 days · needs M4 and M5 · needs OD-4, OD-5, OD-6 answered**

`WP-6.1` Reanimated animations · `WP-6.2` audio · `WP-6.3` haptics ·
`WP-6.4` offline · `WP-6.5` performance · `WP-6.6` accessibility ·
`WP-6.7` error boundaries and crash reporting

**Exit:** 60 fps on a low-end Android device through map, mission and reward; cold
start under 2 s to interactive on that device.

## M7 — Store readiness
**5 engineering days + 2–4 weeks of waiting · needs M6**

`WP-7.1` developer accounts — **start week 1** · `WP-7.2` EAS Build and Submit ·
`WP-7.3` identifiers and versioning · `WP-7.4` privacy policy, terms, data
declarations · `WP-7.5` kids compliance per OD-3 · `WP-7.6` store listings ·
`WP-7.7` TestFlight and Play internal testing

**Exit:** builds uploaded, passing automated checks, submitted for review.

## M8 — Beta and launch
**Calendar-bound, not effort-bound**

`WP-8.1` closed beta · `WP-8.2` fixes · `WP-8.3` submission and review responses ·
`WP-8.4` staged rollout · `WP-8.5` OTA and crash-monitoring workflow.

Expect at least one rejection. Budget for it rather than being surprised by it.

**Exit:** live in both stores.

---

## After launch

Two front ends, one backend, one sync contract.

The web app continues exactly as it is — same repository, same CI, same deploys.
This repository ships its own releases through EAS, on its own cadence.

Shared logic is written once and synced, per [SYNC.md](SYNC.md). Screens are written
twice. Budget roughly **1.8× today's effort** for a new student-facing feature.
Admin-only features cost exactly what they cost now.

The signals that say the manual sync contract has stopped paying for itself — and
the one-week change that replaces it — are in [SYNC.md](SYNC.md) §5. Watch them.
