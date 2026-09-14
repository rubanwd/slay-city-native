# SLAY CITY Native — Concept

The concept document for `slay-city-native`: a separate repository holding the
native iOS and Android build of SLAY CITY, developed independently of the live web
app.

---

## 1. Why a separate repository

`rubanwd/slay-city` is in production. Students complete missions on it today,
teachers author homework on it today. Restructuring it into a monorepo would touch
every import path in a running product for the benefit of an app that does not exist
yet — a real outage risk taken up front, paid before any user sees a native screen.

So the native app gets its own repository, seeded with a snapshot of the current
code, and the web app is not touched at all.

**What this buys:** the live app carries zero migration risk. Its CI, its Vercel
deploys, its release cadence all continue exactly as they are. Work on the native
app can be abandoned, paused, or restarted without any trace in production.

**What this costs:** logic that both apps need now exists twice. That cost is real,
permanent, and addressed head-on in [SYNC.md](SYNC.md) rather than wished away.
Read that document before starting M0 — it is the price of this decision and the
plan for keeping it bounded.

## 2. What is being built

A native application for iOS and Android, built with Expo and React Native,
covering three of the product's four roles:

| Role | Native app | Web app |
| --- | --- | --- |
| **Student** — map, missions, rewards, homework, wardrobe, profile | ✅ | stays live |
| **Teacher** — groups, homework authoring, Q&A, vocabulary and grammar | ✅ | stays live |
| **Parent** — progress, streaks, study time, homework summary | ✅ | stays live |
| **Admin** — content authoring back office | ❌ never | **only here** |

The admin console is deliberately excluded. It is a laptop tool: dense tables, image
cropping, bulk content edits, AI art generation. Porting its ~9 400 lines would add
roughly a third to the project and serve nobody who needs a phone.

The signed-out demo (`/demo`) is also excluded — on a phone, the store listing is
the discovery surface that the demo provides on the web.

## 3. The product stays the same

This is a port, not a redesign. The core loop is untouched:

```
Map → Mission → Reward → Unlock → Return Tomorrow
```

Everything the root `AGENTS.md` locks stays locked: the six brand colours, the four
roles, the rule that teacher accounts are promotion-only, the rule that every reward
and progress mutation happens server-side, the rule that mission content is English
because the English is the lesson.

Two things the native app gains that the web cannot have: real haptics, and a home
screen icon that is not an "add to home screen" prompt. Two things it must give up:
the service worker, and the install banner.

## 4. Three repositories, one backend

```
┌──────────────────────────┐     ┌──────────────────────────┐
│  rubanwd/slay-city       │     │  rubanwd/slay-city-native│
│  ──────────────────────  │     │  ──────────────────────  │
│  Next.js web app  (live) │     │  Expo iOS + Android      │
│  Admin console           │     │  Student · Teacher ·     │
│  Student · Teacher ·     │     │  Parent                  │
│  Parent (web)            │     │                          │
│                          │     │  packages/core  ← copy   │
│  OWNS supabase/          │     │  packages/data  ← copy   │
│    migrations/           │     │  upstream/ ← fetched     │
│    functions/            │     │                          │
└───────────┬──────────────┘     └───────────┬──────────────┘
            │                                │
            │        ┌───────────────┐       │
            └───────▶│   Supabase    │◀──────┘
                     │  ONE project  │
                     │  one schema   │
                     │  one RLS set  │
                     │  27 RPCs      │
                     └───────────────┘
```

**One Supabase project, shared by both apps.** A student who completes a mission on
the phone sees it completed on the web. There is no second database, no sync, no
merge. This is non-negotiable: two databases would mean two versions of a child's
progress.

### The migration-ownership rule

`rubanwd/slay-city` **owns `supabase/` and is the only repository that applies
migrations.** Its CI already pushes pending migrations to production on every merge
to `main`.

`slay-city-native` never contains a `supabase/migrations/` directory and never runs
`supabase db push`. When the native app needs a new RPC — and it will, see §6 — that
migration is opened as a pull request **against the web repository**, reviewed there,
and merged there.

Two repositories writing to one migration timeline would produce conflicting version
numbers and a database whose schema history nobody can reconstruct. One owner, one
timeline.

## 5. Repository layout

```
slay-city-native/
├── app/                      # Expo Router — routes only, thin
│   ├── _layout.tsx
│   ├── (auth)/  (student)/  (teacher)/  (parent)/
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
├── scripts/
│   ├── fetch-upstream.mjs
│   └── check-upstream-drift.mjs
├── UPSTREAM_BASELINE         # the commit this repo was seeded from
├── docs/                     # this planning set
└── assets/                   # fonts, icons, splash, sounds
```

### `upstream/` — the reference checkout

A checkout of `rubanwd/slay-city`, fetched on demand and **never committed**:

```bash
npm run upstream:fetch              # current upstream head
npm run upstream:fetch -- --baseline # the commit this repo was seeded from
```

It exists so that an agent porting `WordSearchTask` can read the original
implementation in the same checkout as the file it is writing. That is worth real
time in an AI-driven workflow, and it makes every port reviewable: the diff between
`upstream/src/features/mission/QuizTask.tsx` and
`src/features/mission/QuizTask.tsx` is exactly the question a reviewer needs to
answer.

**It defaults to current upstream, not a frozen snapshot.** A snapshot committed
into this repository would rot within weeks, and an agent porting from it would
faithfully reproduce behaviour that no longer exists — a bug class that is
invisible in review because the code looks right. Fetching on demand removes it
entirely, and the same checkout serves the drift check in [SYNC.md](SYNC.md), so
there is one mechanism rather than two.

`UPSTREAM_BASELINE` records the commit the port started from, for when
determinism matters more than currency.

### `packages/core` — the shared logic

The modules both apps need: reward maths, unlock rules, puzzle generation, streak
logic, validation, i18n dictionaries. Roughly 6 000 lines, all of it already pure
and unit-tested in the web app.

In this repository it is a **tracked copy**, not a dependency. Every file records
the upstream path and content hash it was copied from, and CI fails when upstream
changes a tracked file. The full contract is in [SYNC.md](SYNC.md).

## 6. Where the backend boundary moves

The web app's browser never touches privileged logic — a Next.js Server Action does,
after a `requireTeacher()` or `requireAdmin()` guard. **React Native has no Server
Actions.** Each of the 26 action files lands in one of three places.

### A — thin RPC wrappers (18 files) → `packages/data`

`submitMissionCompletion`, `purchaseWardrobeItem`, `recordStudyTime` and the rest
are three-line wrappers around a `SECURITY DEFINER` RPC. The security lives in
Postgres. The native app calls the same RPC directly; nothing about the trust model
changes.

### B — direct table writes behind a role guard (5 files) → new RPCs 🔴

`teacher/vocabularyActions.ts` (14 direct writes), `grammarActions.ts` (9),
`teacher/actions.ts` (3), `homework/qa/actions.ts` (3), `onboarding/actions.ts` (2)
write tables directly and rely on a guard running on a server the user does not
control.

**That guard cannot exist on a phone.** If RLS does not already forbid these writes,
shipping them as direct client calls would let any signed-in student author homework
for any group. Every one is audited, and what RLS does not cover is wrapped in a
`SECURITY DEFINER` RPC that re-checks the caller's role in SQL.

Those migrations go to the **web repository**, per §4. This is the highest-risk work
in the project and it gates the entire teacher console, so it starts in week 1.

### C — OpenRouter AI generation (6 files) → Supabase Edge Functions

`OPENROUTER_API_KEY` cannot ship in a mobile binary; anyone can extract it from an
`.ipa`. AI drafting moves behind `draft-vocabulary` and `draft-grammar` Edge
Functions, which live in the **web repository's** `supabase/functions/`.

This changes a rule the root `AGENTS.md` locks. See open decision **OD-1**.

## 7. Technology

| Concern | Choice | Replaces |
| --- | --- | --- |
| Runtime | Expo (managed), React Native, TypeScript | Next.js |
| Routing | Expo Router — file-based, mirrors App Router | `src/app/**` |
| Styling | NativeWind v4 + shared preset | Tailwind CSS |
| Animation | Reanimated | CSS `@keyframes` |
| Images | `expo-image` | `<img>` |
| Audio | `expo-audio` | Web Audio API |
| Session | `expo-secure-store` | HTTP-only cookies |
| Deep links | `slaycity://` | `NEXT_PUBLIC_SITE_URL` redirects |
| Server state | TanStack Query | Server Components + `revalidatePath` |
| Builds | EAS Build + Submit | Vercel |

EAS Build compiles iOS in the cloud — **no Mac required**. An Apple Developer
account still is.

## 8. What the audit found

The plan is built on a read of all 373 files, not on assumptions. Two findings
moved the estimate in opposite directions.

**None of the 32 mission task types needs drag gestures.** `WordSearchTask` selects
a word by tapping its first and last cell — `tapCell(r, c)`. `SentenceBuilderTask`,
`StorySequencingTask`, `CategorySortTask` and `MatchingTask` are all tap-to-select.
The heavy state machines are already pure, tested modules. This turns the mission
port from bespoke gesture engineering into mostly mechanical JSX translation.

**32 direct table writes depend on a guard that cannot exist on a phone.** Described
in §6B. This is the one place where being wrong produces a security hole rather than
a bug.

## 9. Scale of the work

| | |
| --- | --- |
| Work packages | 54 |
| Engineering effort | ~54 days |
| Calendar to launch | 12–14 weeks |
| — of which store review | 2–4 weeks, not compressible |
| Files in the source app | 373 (~41 950 lines) |
| Ported | student ~16 900 + teacher ~3 800 + parent ~1 220 lines |
| Not ported | admin ~9 400 lines |
| Shared without rewriting | ~6 000 lines, tests included |

Full breakdown in [ROADMAP.md](ROADMAP.md) and [WORK-PACKAGES.md](WORK-PACKAGES.md).

## 10. What you have to decide

Seven decisions block specific phases. Two of them change rules the root `AGENTS.md`
lists under *What Not to Change Without Permission*.

| ID | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| **OD-1** 🔒 | Move OpenRouter calls into Edge Functions | Yes — the key cannot ship in a binary | M4, WP-5.6 |
| **OD-2** 🔒 | Implement Sign in with Apple | Yes — Guideline 4.8 requires it wherever Google sign-in exists | M2, M7 |
| **OD-3** | Enter the Apple Kids Category | No — rate 4+; the category bans third-party analytics | WP-7.5 |
| **OD-4** | Keep Google Analytics on mobile | Keep, unless OD-3 is yes | WP-7.5 |
| **OD-5** | Offline depth | Read-only cache for v1 | WP-6.4 |
| **OD-6** | Push notifications in v1 | Defer — `AGENTS.md` has them under Do Not Build Yet | M6 |
| **OD-7** | Port the signed-out demo | Skip | M4 |

🔒 = changes a locked rule.

## 11. What life looks like afterwards

Two front ends, one backend, one shared-logic contract.

A new student-facing feature is built twice: the logic once in `packages/core` (and
synced), the screens twice. Budget roughly **1.8× today's effort** for such work —
higher than the 1.6× a monorepo would cost, because the sync step is manual rather
than structural. Admin-only features cost exactly what they cost now.

If that multiplier starts to hurt — and it will be felt first in mission task types,
which change most often — the escape hatch is to publish `packages/core` from the
web repository as a private npm package and have both apps depend on it. That is a
one-week change, and [SYNC.md](SYNC.md) §5 describes the trigger for making it.
Nothing in this plan forecloses it.
