# Roadmap

Nine phases, P3 → P11. A phase is not done because its code exists — it is done
because its exit criterion is demonstrably met on a real device.

The phases were first numbered M0 → M8. Work-package ids keep that original
numbering, so `WP-0.x` belongs to P3, `WP-1.x` to P4, and so on (phase = first
digit + 3).

`rubanwd/slay-city` is untouched throughout, except for the pull requests named in
§ *P1 - Cross-repository work* below.

## P12 - Overview

| Phase | Name | Eng. days | Calendar | Exit criterion |
| --- | --- | --- | --- | --- |
| **P3** | Foundations — new repo, snapshot, shared packages | 4 | wk 1 | Drift check green, Expo app builds |
| **P4** | Mobile shell — routing, design system | 5 | wk 2 | App opens on a real phone |
| **P5** | Auth & session | 5.5 | wk 3 | Sign in, reset, refresh all work natively |
| **P6** | Student core loop — map → mission → reward | 10 | wk 4–5 | A mission completes and pays out correctly |
| **P7** | Student surround — homework, wardrobe, profile | 7 | wk 6–7 | Student app feature-complete |
| **P8** | Teacher & parent consoles | 11 | wk 7–9 | All three roles usable |
| **P9** | Polish — animation, audio, offline, performance | 7 | wk 9–10 | 60 fps on a low-end Android |
| **P10** | Store readiness — accounts, compliance, builds | 5 + wait | wk 10–12 | Builds submitted for review |
| **P11** | Beta, review, launch | — | wk 12–14 | Live in both stores |

**~54.5 engineering days. ~12–14 calendar weeks to launch**, of which 2–4 weeks is
store-review latency that cannot be compressed.

Everything before P10 is work I can do in the repository. P10 and P11 need you: Apple
and Google accounts, physical devices, and legal text with your name on it.

## P2 - Dependency graph

```
P3 ── P4 ── P5 ──┬── P6 ── P7 ──┐
                 │              ├── P9 ── P10 ── P11
   WP-2.3 ───────┴───── P8 ─────┘
   (RLS audit, upstream PR)

WP-7.1 (dev accounts) ─── start at P3, needed by P10
OD-2 answered ─────────── needed by P5   (OD-1 answered 2026-09-29 ✅, OD-2 answered 2026-09-30 ✅)
```

Live status on every gate above — owner, evidence, unblock criteria, target
date — is tracked in [dependency-gates.md](dependency-gates.md). Update that
file, not this diagram, when a gate's status changes.

Two things must start earlier than their phase:

- **WP-7.1 — Apple and Google developer accounts.** Apple's organisation
  verification can take weeks (D-U-N-S lookup). Start it in week 1, not week 10.
- **WP-2.3 — the teacher RLS audit.** It gates all of P8, it is the one piece of work
  where being wrong means a security hole rather than a bug, and it lands as a pull
  request against the *web* repository, so it needs review time there.

## P1 - Cross-repository work

Three work packages produce changes to `rubanwd/slay-city` rather than to this
repository. They are pull requests against the live product and are reviewed as
such.

| Package | What lands upstream | Why it cannot live here |
| --- | --- | --- |
| `WP-2.3` | New `SECURITY DEFINER` RPCs for teacher writes | The web repo owns `supabase/migrations/` and its CI applies them |
| `WP-5.6` | `draft-vocabulary`, `draft-grammar` Edge Functions | Same — plus the web's Server Actions become callers, so one implementation serves both apps. Specified in [EDGE-FUNCTIONS-PLAN.md](EDGE-FUNCTIONS-PLAN.md); PR staged in [UPSTREAM-PR-WP-5.6.md](UPSTREAM-PR-WP-5.6.md) |
| `WP-2.4` | Nothing in code — a Supabase dashboard change | The redirect allow-list gains `slaycity://` **alongside** the web URLs |

Everything else is confined to `slay-city-native`.

## Parallelisation

Work packages are sized for independent agents. Safe concurrency:

| Phase | Parallel tracks |
| --- | --- |
| P3 | 1 — everything else depends on these packages |
| P4 | 2 — design-system primitives ‖ navigation skeleton |
| P6 | 3 — map ‖ mission tiers 1–2 ‖ mission tiers 3–4 |
| P7 | 4 — homework ‖ wardrobe+profile ‖ onboarding+levels ‖ feedback+i18n |
| P8 | 2 — teacher ‖ parent |
| P9 | 3 — animation ‖ audio+haptics ‖ offline+perf |

P6's mission work is the best parallelisation target: 32 independent components
against one shared `TaskRunner` contract. Freeze that contract first (`WP-3.2`),
then fan out.

---

## P3 - Foundations
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

## P4 - Mobile shell
**5 days · needs P3**

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

## P5 - Auth & session
**5.5 days · needs P4 · OD-2 answered ✅ 2026-09-30**

- `WP-2.1` Supabase client with SecureStore adapter and `AppState` auto-refresh
- `WP-2.2` Login, register, forgot-password, reset-password screens
- `WP-2.3` **Teacher/parent RLS audit** → upstream PR
- `WP-2.4` Deep links: scheme, `slaycity://auth/callback`, Supabase allow-list
- `WP-2.5` Google OAuth via `expo-auth-session`; Sign in with Apple, per
  [OD-2-DECISION.md](OD-2-DECISION.md)
- `WP-2.6` Route guard driven by `roleHome()` from core

**Exit:** a real account signs in on both platforms; the session survives an app
restart and a 24-hour gap; a password-reset email opens the app at the right screen;
each of the four roles lands on its own home; **web password reset still works**.

## P6 - Student core loop
**10 days · needs P5**

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

## P7 - Student surround
**7 days · needs P6 · needs OD-7 answered** (OD-1 answered ✅)

`WP-4.1` homework · `WP-4.2` wardrobe · `WP-4.3` profile and levels ·
`WP-4.4` onboarding · `WP-4.5` study-time tracker · `WP-4.6` feedback ·
`WP-4.7` i18n

**Exit:** every student-facing route in the migration map exists and works; the
student app is feature-complete against the web app.

## P8 - Teacher & parent consoles
**11 days · needs P5 and WP-2.3 merged upstream · OD-1 answered ✅ — `WP-5.6` now
needs the [upstream PR](UPSTREAM-PR-WP-5.6.md) merged**

`WP-5.1` dashboard and groups · `WP-5.2` topic authoring · `WP-5.3`
`VocabularyManager` · `WP-5.4` `GrammarManager` · `WP-5.5` Q&A ·
`WP-5.6` AI drafting → upstream Edge Functions · `WP-5.7` view-as-student ·
`WP-5.8` `ParentDashboard` · `WP-5.9` parent profile and linking

**Exit:** a teacher authors a topic on a phone and a student receives it; a parent
sees that student's progress update. Nothing is left to port, so `upstream/` is
needed only for the drift check from here on.

## P9 - Polish
**7 days · needs P7 and P8 · needs OD-4, OD-5, OD-6 answered**

`WP-6.1` Reanimated animations · `WP-6.2` audio · `WP-6.3` haptics ·
`WP-6.4` offline · `WP-6.5` performance · `WP-6.6` accessibility ·
`WP-6.7` error boundaries and crash reporting

**Exit:** 60 fps on a low-end Android device through map, mission and reward; cold
start under 2 s to interactive on that device.

## P10 - Store readiness
**5 engineering days + 2–4 weeks of waiting · needs P9**

`WP-7.1` developer accounts — **start week 1** · `WP-7.2` EAS Build and Submit ·
`WP-7.3` identifiers and versioning · `WP-7.4` privacy policy, terms, data
declarations · `WP-7.5` kids compliance per OD-3 · `WP-7.6` store listings ·
`WP-7.7` TestFlight and Play internal testing

**Exit:** builds uploaded, passing automated checks, submitted for review.

## P11 - Beta and launch
**Calendar-bound, not effort-bound**

`WP-8.1` closed beta · `WP-8.2` fixes · `WP-8.3` submission and review responses ·
`WP-8.4` staged rollout · `WP-8.5` OTA and crash-monitoring workflow.

Expect at least one rejection. Budget for it rather than being surprised by it.

**Exit:** live in both stores.

---

## P0 - After launch

Two front ends, one backend, one sync contract.

The web app continues exactly as it is — same repository, same CI, same deploys.
This repository ships its own releases through EAS, on its own cadence.

Shared logic is written once and synced, per [SYNC.md](SYNC.md). Screens are written
twice. Budget roughly **1.8× today's effort** for a new student-facing feature.
Admin-only features cost exactly what they cost now.

The signals that say the manual sync contract has stopped paying for itself — and
the one-week change that replaces it — are in [SYNC.md](SYNC.md) §5. Watch them.
