# SCN-49 — Create `packages/data` with queries and RPC wrappers using an injected Supabase client

> Type: feature · Date: 2026-10-06

## Context

SCN-49 is badged "Goal: WP-0.3." `packages/data` is where the native app's
Supabase access lives: the thin wrapper functions the web app currently calls
from its Next.js Server Actions (`submitMissionCompletion`,
`purchaseWardrobeItem`, `recordStudyTime`, …) and the read-only `queries.ts`
files that back its dashboards. Unlike `packages/core` (a byte-identical
tracked copy, per `docs/SYNC.md`), `packages/data`'s functions take an
injected `SupabaseClient<Database>` as their first argument instead of
constructing one — the same function body is driven by a cookie-bound client
on the web and a `SecureStore`-bound client on the phone. This is what lets
`src/` (and later screens) call these functions without ever importing
`@supabase/supabase-js` directly or duplicating RPC names/argument shapes by
hand.

Before this ticket, `packages/data/src/index.ts` was a placeholder — a
docstring describing the intended shape and an empty `export {}` — left by
`SCN-45` (Expo bootstrap). This ticket fills it in.

## What was done

Ran `npm run upstream:fetch` and read every Category A action file and
`queries.ts` file named in `docs/MIGRATION-MAP.md` §2, plus the inline RPC call
in `app/parent/page.tsx` (`link_student_by_email`, which the web app calls
directly from a Server Component rather than through an `actions.ts`/
`queries.ts` file). Per `docs/MIGRATIONS-NEEDED.md`'s own admission and this
project's memory that planning-doc counts don't survive contact with the
actual tree ("right number, wrong list, twice now"), the "18 RPCs" and "12
action files" named in `MIGRATION-MAP.md` were treated as a starting
inventory to verify against the code, not as a checklist to satisfy
mechanically. Re-deriving from `upstream/` directly turned up three
corrections, detailed in **Technical decisions** below.

Ported, as plain functions taking `db: SupabaseClient<Database>` first (the
shape the placeholder's own docstring and `WP-0.3`'s step 2 specify — not the
`createDataClient(...)` factory the ticket also mentions as *an* example):

- **`mission.ts`** — `submitMissionCompletion` (`complete_mission` RPC, then
  best-effort `update-streak` Edge Function call) and `resetLocationProgress`
  (`reset_location_progress` RPC).
- **`wardrobe.ts`** — `purchaseWardrobeItem`, `equipWardrobeItem`,
  `unequipWardrobeItem` (one RPC each) and `loadMascotImage` (direct read of
  `user_wardrobe_items` joined to `wardrobe_items`, resolved through
  `@slay/core`'s `resolveMascotImage`).
- **`levels.ts`** — `restartMyLevel` (`reset_level_progress`), `changeMyLevel`
  (`set_my_knowledge_level`), `getAvailableLevels`
  (`available_knowledge_levels`), `getMyLevel` and `isLevelCleared` (direct
  reads).
- **`homework.ts`** — `completeHomeworkVocab` / `completeHomeworkGrammar`
  (`complete_homework_vocab` / `complete_homework_grammar`), `getMyGroups` /
  `hasAnyGroup` (`my_groups`), and `getTopicMessages` / `getUnreadCounts`
  (`get_topic_messages` / `get_unread_topics`, originally in
  `homework/qa/queries.ts` upstream — folded into this file rather than a
  separate one, since both are homework Q&A reads with no Category B writes
  attached).
- **`study.ts`** — `recordStudyTime` (`record_study_time`),
  `STUDY_HEARTBEAT_SECONDS` (the 30-second client-side clamp constant), and
  `getStudyTimeSummary` (direct read of `study_time_daily`, folded through
  `@slay/core`'s `summarizeStudyTime`).
- **`profile.ts`** — `changeMyUsername` (direct `profiles` update under RLS,
  validated through `@slay/core`'s `checkUsername`).
- **`feedback.ts`** — `submitFeedbackReport` only (direct `feedback_reports`
  insert under RLS, validated through `@slay/core`'s
  `validateFeedbackReport`).
- **`map.ts`** — `moveLocationOnMap` (`set_location_map_position`), the one
  function from `map/actions.ts`.
- **`parent.ts`** — `linkStudentByEmail` (`link_student_by_email`, newly
  wrapped — upstream calls this RPC inline in `app/parent/page.tsx`, not from
  a named action), `getLinkedStudent` (reads the link the RPC establishes),
  and `getParentProgressSummary` (direct multi-table read, folded through
  `@slay/core`'s `taskFamilyOf`/`TASK_FAMILIES`).

`index.ts` now barrel-exports all nine modules in place of the placeholder,
with a doc comment recording the injected-client shape and what was
deliberately left out (see **Limitations**).

Every function has a `.test.ts` sibling using a hand-built mock of the
relevant `SupabaseClient` surface (`vi.fn()` on `auth.getUser`,
`auth.getSession`, `rpc`, `functions.invoke`, and `from(...).select()...`
chains) — no real Supabase client, network, or database involved. Tests
assert three things per wrapper, per the ticket's step 4: the exact RPC name
and argument shape called, the success-path return value, and that an RPC/
`.from()` error is propagated into the function's result rather than thrown
or swallowed (except where upstream's own contract is to swallow it, e.g.
`recordStudyTime`, which is explicitly fire-and-forget).

## Changes by file

- `packages/data/src/index.ts` — modified. Replaced the WP-0.3 placeholder
  (docstring + `export {}`) with a barrel re-exporting the nine modules below.
- `packages/data/src/mission.ts` / `.test.ts` — new. `submitMissionCompletion`,
  `resetLocationProgress`.
- `packages/data/src/wardrobe.ts` / `.test.ts` — new. `purchaseWardrobeItem`,
  `equipWardrobeItem`, `unequipWardrobeItem`, `loadMascotImage`.
- `packages/data/src/levels.ts` / `.test.ts` — new. `restartMyLevel`,
  `changeMyLevel`, `getAvailableLevels`, `getMyLevel`, `isLevelCleared`.
- `packages/data/src/homework.ts` / `.test.ts` — new.
  `completeHomeworkVocab`, `completeHomeworkGrammar`, `getMyGroups`,
  `hasAnyGroup`, `getTopicMessages`, `getUnreadCounts`.
- `packages/data/src/study.ts` / `.test.ts` — new. `recordStudyTime`,
  `STUDY_HEARTBEAT_SECONDS`, `getStudyTimeSummary`.
- `packages/data/src/profile.ts` / `.test.ts` — new. `changeMyUsername`.
- `packages/data/src/feedback.ts` / `.test.ts` — new. `submitFeedbackReport`.
- `packages/data/src/map.ts` / `.test.ts` — new. `moveLocationOnMap`.
- `packages/data/src/parent.ts` / `.test.ts` — new. `linkStudentByEmail`,
  `getLinkedStudent`, `getParentProgressSummary`.

No file under `packages/core`, `packages/tokens`, `app/`, or `src/` was
touched.

## Technical decisions

- **Plain functions over a `createDataClient(...)` factory.** The ticket
  offers the factory as one example ("a factory such as..."), but the
  pre-existing placeholder docstring in `packages/data/src/index.ts` and
  `WP-0.3`'s own acceptance text both already commit to "every exported
  function takes `db: SupabaseClient<Database>` first." Following that over
  the looser example keeps this ticket consistent with what was already
  checked in, and matches `AC3`'s naming rule ("named as in the web app's
  action") more directly — a factory method name and an action name are not
  the same kind of symbol to grep against.
- **Re-derived the RPC/file list instead of trusting the "18 RPCs" /
  "12 action files" counts in `docs/MIGRATION-MAP.md`.** Reading every
  candidate file in `upstream/` directly surfaced three corrections:
  - `unread_feedback_count` and `mark_feedback_read` are **not ported.** Both
    back the admin inbox badge (`feedback/queries.ts`'s
    `getUnreadFeedbackCount`, `feedback/actions.ts`'s `markAllFeedbackRead`),
    and `CLAUDE.md` is explicit that "the admin console stays web-only." The
    18-RPC list in `MIGRATION-MAP.md` includes them anyway — an inventory
    mistake, not a mobile requirement.
  - `set_location_map_position` (`map/actions.ts`) **is ported** despite not
    appearing in that same 18-RPC list — it's a real Category A file the list
    simply omitted.
  - `i18n/actions.ts`'s `setLocalePreference` and all of `auth/actions.ts`
    were **not ported**, even though `MIGRATION-MAP.md` names both files as
    "Category A." Neither calls an RPC or reads/writes a table:
    `setLocalePreference` only sets a Next.js cookie (mobile's equivalent,
    per `WP-4.7`, is `SecureStore`/`AsyncStorage`, owned by that ticket, not
    this package), and `auth/actions.ts`'s `supabase.auth.*` calls are
    entangled with `next/navigation` redirects and `next/headers` cookies
    that `WP-2.1`/`WP-2.2` ("Supabase client," "Auth screens") own as their
    own, separate work. Porting either here would have meant inventing a
    mobile-specific contract this ticket has no mandate to design.
  - `demo/*` (`demo/actions.ts`, `demo/queries.ts`) was **not ported** at
    all — `docs/MIGRATION-MAP.md` §3 marks every `app/demo/**` route ⚪ "not
    ported," so there is no mobile caller for it.
- **`getParentDashboardData` (full dashboard aggregation,
  `parent/queries.ts`) and all of `teacher/queries.ts` (`getTeacherGroups`,
  `getReusableTopicSources`) were not ported.** Both upstream functions pull
  in the placement-test feature (`placement/queries.ts`,
  `getLatestPlacementAttempt(s)`), whose pure result-shaping logic
  (`parseLevelScores`, `PlacementResult`, etc., in `placement/placement.ts`)
  was never copied into `packages/core` — confirmed by re-reading
  `packages/core/src/` directly rather than assuming. Porting it now would
  mean adding game-relevant pure logic to `packages/core` from a ticket
  scoped to `packages/data`, blurring the exact boundary `docs/SYNC.md`
  exists to keep. It's also not a `packages/core` *drift* to fix: `SCN-48`
  already found and documented that `packages/core/src/types/database.ts` is
  seven files behind the current upstream head, including the placement
  tables and RPCs (`docs/changes/SCN-48.md`, Limitations) — the type the
  Database generic would need doesn't exist in this repo's copy yet either.
  `getLinkedStudent` and `getParentProgressSummary` (the placement-independent
  halves of `parent/queries.ts`) are ported in full; `linkStudentByEmail` (one
  of the 18 listed RPCs) is ported as its own wrapper since upstream never
  gave it one.
- **Dropped the mascot-image cookie plumbing from `wardrobe.ts`.** Upstream's
  `equipWardrobeItem`/`unequipWardrobeItem` call `writeMascotImageCookie()`
  after the RPC succeeds, and `loadMascot.ts` exports cookie read/write
  helpers for a Next.js `loading.tsx` fallback. Mobile has no cookie jar and,
  per `AGENTS.md`, caches server state with TanStack Query instead — the
  caller invalidates the mascot-image query after a successful equip/unequip
  rather than this package writing a cache itself. Only the data-reading half
  of `loadMascot.ts` (`loadMascotImage`) was ported.
- **`submitFeedbackReport` takes `supabaseUrl` as a parameter instead of
  reading `process.env.NEXT_PUBLIC_SUPABASE_URL`.** `process.env` doesn't
  carry Expo's public env vars the same way, and `packages/data` must not
  read app configuration directly — everything it needs is injected, exactly
  like the client itself.

## Data, API and configuration

No migrations, schema changes, or new dependencies. No secrets. Every RPC
name and argument shape (`p_mission_id`, `p_reward_fraction`, `p_item_id`,
`p_topic_id`, `p_seconds`, `p_level`, `p_location_id`, `p_map_x`, `p_map_y`,
`p_student_email`) was taken from `upstream/src/types/database.ts`'s
`Database["public"]["Functions"]` entries, not retyped from memory.

## How to verify

- `npm test` — 253/253 tests pass across 27 files (61 of them new, across the
  9 `packages/data/src/*.test.ts` files added here); 0 regressions in the
  existing 192.
- `npm run type-check` — passes with no output; `SupabaseClient<Database>` is
  resolved for every RPC call from `@slay/core/types`, so an RPC name or
  argument typo here would be a compile error, not a runtime surprise.
- `npm run lint` — passes; `packages/data/**/*.ts` is covered by the
  `no-restricted-imports` rule in `eslint.config.js` that bans
  `react`/`react-native`/`next`/`expo` imports, and none of the new files
  import any of them.
- `git status --porcelain` — only `packages/data/src/**` changed; nothing
  under `packages/core`, `src/`, or `app/` was touched.

## Limitations and follow-ups

- `getParentDashboardData` and all of `teacher/queries.ts` are not yet
  ported — see **Technical decisions** above. Unblocking them needs a
  `packages/core` sync that adds the placement-test pure logic
  (`placement/placement.ts` → something like `core/placement/`) and the
  `types/database.ts` resync `SCN-48` already flagged as outstanding (adds
  `placement_test_attempts`, `placement_test_questions`,
  `get_placement_test`, `submit_placement_test`). That sync should land
  before `WP-5.1` (teacher dashboard) or `WP-5.8` (`ParentDashboard`) need
  these functions.
- Auth (`signUp`/`signIn`/`signInWithGoogle`/`signOut`/password reset) and
  locale preference are intentionally absent from `packages/data` — they
  belong to `WP-2.1`/`WP-2.2` and `WP-4.7` respectively, per the reasoning
  above. If those tickets decide the Supabase Auth calls should also live in
  `packages/data` (for the same injected-client reason everything else here
  does), that's a small, separate addition — not a reason to block this
  ticket.
- `onboarding/actions.ts` (Category B) is correctly excluded per the ticket's
  own instruction; `docs/MIGRATIONS-NEEDED.md` already flags its
  `link_student_by_email`-adjacent write as needing its own RPC audit before
  any mobile port.
