# SCN-61 — Open upstream PR in rubanwd/slay-city adding SECURITY DEFINER RPCs for teacher/parent writes not covered by RLS

> Type: feature · Date: 2026-10-08

## Context

`WP-2.3` is one of three work packages whose deliverable is a pull request
against the live web product, `rubanwd/slay-city`, rather than a commit in this
repository. This repository has no `supabase/` directory and never will — the
web repository owns the migration timeline.

The problem it solves: twenty-two direct table writes in five web Server Actions
(`teacher/vocabularyActions.ts`, `teacher/grammarActions.ts`,
`teacher/actions.ts`, `homework/qa/actions.ts`, `onboarding/actions.ts`) are
authorized today by two things — a TypeScript role guard (`requireTeacher`,
`requireTopicAccess`) that only exists on the Next.js server, and RLS. The
native app talks to PostgREST directly with the public anon key and never runs
the guard, so whatever the guard was adding has to move into the database or it
stops existing.

By the time this ticket ran, `SCN-11` through `SCN-13` had already written every
line of SQL, every rollback and the whole negative-test harness, and `SCN-28`
had reconciled them against the audit and concluded that "the entire remaining
gap is procedural, not technical."

That conclusion was true when written and stale by the time this ticket read
it. The package was written against upstream `7612da5`; upstream had moved nine
commits to `02630a3`, and three of those commits broke assumptions the staged
package depended on. The ticket's step 1 — "run `npm run upstream:fetch` so you
work against current upstream" — is what surfaced them.

## What was done

Two things: the staged package was **rebased onto current upstream** (ticket
steps 1–5, which had silently decayed), and the **native-side typed wrappers**
were written (ticket step 6, not previously done). Step 7, actually opening the
PR, is blocked — see *Limitations and follow-ups*.

### 1. Re-derived the write inventory against `02630a3`

Rather than trusting the planning docs' counts — a recurring source of error on
this project — the sweep was re-run over the five named files. Result: the same
22 writes the audit found (W-01…W-22), no new ones, mapping 1:1 onto the twelve
staged functions. The ticket's own per-file counts (14/9/3/3/2 = 31) include
`.from()` reads, which is why they are higher.

One genuinely new direct-write site exists upstream since the audit: four writes
to `placement_test_questions` in `src/features/admin/placementActions.ts`. They
are out of scope and documented as such — admin-only, and the admin console
stays web-only per `AGENTS.md`.

### 2. Re-read every RLS policy and recorded the evidence (ticket step 2)

Each write was checked against the policy that governs it in
`upstream/supabase/migrations/`, answering one question: *could a signed-in
`student` perform this write directly through PostgREST today?* The result is a
new table in the PR description with the governing policy, the answer and a
file:line citation for each. The findings, all confirmed to still hold at
`02630a3`:

- **W-01…W-17** (topics, vocabulary, grammar, image cache): **no**. RLS already
  carries the boundary. Worth noting that the teacher policies check *group
  ownership only, never the role* — `can_author_group` adds the `is_teacher()`
  conjunct the policies lack.
- **W-19** (`homework_topic_reads` upsert): **yes, and further than intended.**
  `hw_reads_insert_own` is `user_id = auth.uid()` and nothing else — `topic_id`
  is unconstrained, so any signed-in user can create a read marker for any
  topic, including topics in groups they have no connection to. A real gap.
- **W-22** (`user_stats` insert): **yes, with arbitrary contents.** This is
  finding F1 and it is live on production. `user_stats_insert_own` constrains
  *which row* a caller may insert and never *what is in it*; there is no CHECK,
  no INSERT trigger, and `20260701000001_initial_schema.sql:384` grants
  `select, insert` on the table to `authenticated` wholesale. Any user with a
  profile and no stats row can `POST /rest/v1/user_stats` with whatever `xp`,
  `coins`, `level` and streaks they like.
- **W-18, W-20** (Q&A messages): author pinned, but `created_at` was
  client-settable; moderation-by-owning-teacher is intended.

### 3. Resolved U-4 from the schema

`UPSTREAM-PR-WP-2.3.md`'s checklist had U-4 — "is Q&A moderation by the owning
teacher intended?" — recorded as needing a human. It does not:
`20260722000002_homework_qa.sql:45–46` documents the `hw_messages_delete`
policy as "light moderation without a separate role check" in the schema
itself. It is intended, it is preserved, and the checklist item is closed.

### 4. Rebased the package — three drifts fixed

**Timestamps renumbered `20260930…` → `20261008…`** (four migrations, four
`down/` counterparts). Not cosmetic: upstream merged `20261001000001`,
`20261003000001` and `20261004000001` in the meantime, so the staged files now
sorted *before* three migrations already applied to production. A migration that
sorts before the current head is not a migration.

**The fifth migration was dropped.** `SCN-11-1` staged
`…0005_widen_profile_age_range.sql` to widen `profiles.age` from 7–14 to the
onboarding form's range, resolving finding F2. Upstream fixed the same finding
itself in `20261001000001_widen_profile_age_range.sql` — choosing **5–90**,
where this package had chosen 5–99 — and extracted `MIN_AGE`/`MAX_AGE` into a
new `features/onboarding/age.ts` so the column and the form cannot drift again.
Applying ours on top would have re-widened the column past `MAX_AGE` and
recreated finding F2 in the opposite direction, so it was deleted rather than
renumbered. `tests/negative-tests.sql` §11 was repointed at upstream's
constraint: its `SKIP` guard now reads for `90`, and the boundary cases became
"90 accepted, 91 rejected".

**The `onboarding/actions.ts` thin caller was rebased.** The staged copy still
carried its own inline `MIN_AGE`/`MAX_AGE` constants and range check. Copying it
over `main` would have silently reverted upstream's `parseAge` extraction and
reintroduced the second source of truth F2 was about. It now imports `parseAge`
from `./age` exactly as `main` does.

Re-verified unchanged by the rebase: all twelve function signatures, every RLS
predicate the authorization model rests on, and the exported surface of the
other four thin callers — each still exports exactly the names upstream's
version exports, including the `copyVocabularyFromTopic` /
`copyGrammarFromTopic` pair this package does not touch. Every `import` in all
five thin callers was re-resolved against `02630a3`: all twelve first-party
modules and every named symbol they pull out of them still exist. Upstream's CI
at `02630a3` still has no database test step (`ci` and `migrate` jobs only), so
the staged `ci-database-tests.yml` still applies as written.

### 5. Found that the staged deployment plan cannot work as one PR

Reading `upstream/.github/workflows/ci.yml` to confirm the `ci-database-tests.yml`
assumptions turned up a problem with the package's own deployment plan. The
`migrate` job runs `supabase db push` on **every push to `main`**, so merging
one PR containing all four migrations applies all four at once — and 4/4, the
revoke, lands at the same moment as or before Vercel finishes deploying the
thin callers that depend on it. In that window teacher authoring, Q&A and
onboarding are all broken, and the plan's step 3 ("verify in production before
the point of no return") is unreachable.

The §Deployment section was rewritten to split the work into **PR #1**
(migrations 1/4–3/4 + all five thin callers — purely additive, safe to
auto-apply, deploy order irrelevant) and **PR #2** (migration 4/4 alone, opened
only after PR #1's deploy has been verified against production). This also
re-scopes the U-1 gate: it blocks PR #2, not PR #1.

### 6. Native typed wrappers (ticket step 6)

`packages/data/src/guardedWrites.ts` is new and wraps all twelve RPCs behind the
injected `SupabaseClient` every other function in that package takes:
`createHomeworkTopic`, `updateHomeworkTopic`, `deleteHomeworkTopic`,
`cacheVocabImage`, `publishHomeworkVocabulary`, `clearHomeworkVocabulary`,
`publishHomeworkGrammar`, `clearHomeworkGrammar`, `postTopicMessage`,
`markTopicRead`, `deleteTopicMessage`, `createMyProfile`.

They return the package's usual `{ ok: true } | { ok: false; error: string }`
(or `{ ok: true; id }` for the two functions that return a `uuid`) and pass the
function's own message straight through, so a native screen can show `error`
directly and match the web app's wording.

**They are exported from `@slay/data` and imported by nothing**, per the
ticket: the functions do not exist in any database until the PR merges, so a
call today returns `PGRST202`.

The one non-obvious piece is why they cannot be typed off the generated
`Database` type. `packages/core/src/types/database.ts` is a *tracked copy* of
upstream's generated types, so it lists exactly the functions that exist in the
live database — and these twelve do not. Hand-editing it to add them is the one
thing this repository forbids: `npm run upstream:check` would report drift and a
reviewer could no longer tell a generated type from a guess. So the argument and
return shapes are declared locally in a `GuardedRpcs` interface and a single
`callGuardedRpc` helper narrows one untyped `rpc()` call against them. That
indirection is documented as deletable the day upstream regenerates
`database.ts`. The client is cast rather than `db.rpc` itself, because an
extracted `rpc` reference loses its receiver and throws at runtime.

## Changes by file

- `packages/data/src/guardedWrites.ts` — (new) the twelve typed wrappers, the
  `GuardedRpcs` contract, the `callGuardedRpc` shim and the input types
  (`VocabularyWordInput`, `GrammarPointInput`, `HomeworkTaskInput`,
  `HomeworkTopicFields`). Each wrapper's doc comment records which audit op it
  replaces and what the RPC adds over the policy it supersedes.
- `packages/data/src/guardedWrites.test.ts` — (new) 25 tests pinning the wire
  contract: the exact RPC name and argument object for every call, the
  defaulting of optional topic fields, errors surfacing as
  `{ ok: false, error }` rather than throwing, and two negative shape assertions
  — `post_topic_message` sends only `p_topic_id`/`p_body` (no forgeable
  `author_id`/`created_at`) and `create_my_profile` sends no role and no
  counters.
- `packages/data/src/index.ts` — (modified) re-exports `./guardedWrites`; the
  module header's scope note updated to say Category B is now wrapped-but-not-
  callable, and that the new admin-only `placement_test_questions` writes are
  out of scope.
- `docs/migrations/wp-2.3/20260930000001…4` → `20261008000001…4` — (renamed, 4
  files) plus the same rename for all four files under `down/`. In-file
  cross-references updated to the new names.
- `docs/migrations/wp-2.3/20260930000005_widen_profile_age_range.sql` and
  `down/20260930000005_widen_profile_age_range_down.sql` — (deleted) superseded
  by upstream's own `20261001000001_widen_profile_age_range.sql`.
- `docs/migrations/wp-2.3/20261008000003_onboarding_profile_rpc.sql` —
  (modified) the two comments that pointed at the dropped 5/5 now record that
  upstream closed F2 at 5–90 and why ours was dropped rather than reapplied.
- `docs/migrations/wp-2.3/tests/negative-tests.sql` — (modified) §11 repointed
  from the dropped 5/5 (5–99) to upstream's migration (5–90): the `SKIP` guard,
  the accepting upper bound (99 → 90) and the rejecting case (100 → 91). The
  "how to run" header now says four files, not five.
- `docs/migrations/wp-2.3/README.md` — (modified) base commit banner, the 5/5
  row removed from the file table, the "5/5 is independent" paragraph replaced
  with why there is no 5/5, rollback order `005 → …` → `004 → …`, and §Verifying
  updated so §11 is described as pinning upstream's constraint.
- `docs/migrations/wp-2.3/thin-callers/src/features/onboarding/actions.ts` —
  (modified) inline `MIN_AGE`/`MAX_AGE` and the range check replaced by
  `parseAge` from `./age`, matching upstream.
- `docs/migrations/wp-2.3/thin-callers/src/features/teacher/actions.ts` —
  (modified) comment reference to the renumbered migration.
- `docs/migrations/wp-2.3/thin-callers/README.md` — (modified) records the
  rebase, why `onboarding/actions.ts` had to change, and that every import in
  all five files was re-resolved.
- `docs/UPSTREAM-PR-WP-2.3.md` — (modified) the biggest change. New
  §"Evidence: what RLS does and does not stop" (the step-2 per-write policy
  reading), new §"Rebase onto `02630a3`", new §"The native side", the write→RPC
  table gained a column with the file:line of each original write at `02630a3`,
  the `profiles.age` decision section rewritten as closed-upstream, §Deployment
  split into two PRs (see below), five
  checklist items flipped to done (including U-4), and the two that remain
  marked with *why* an agent cannot close them, plus a new unchecked item for the
  two-PR split.
- `docs/MIGRATIONS-NEEDED.md` — (modified) §7.3's decision now records that
  upstream resolved it at 5–90 and that nothing is outstanding.
- `docs/WP-2.3-RECONCILIATION.md` — (modified) header note correcting §1's
  "the gap is purely procedural" (it was procedural *and* stale), R4 narrowed
  to U-1/U-3 with U-4 closed, §5 item 4 marked done, and §2 gained a paragraph
  on the new native wrappers.

## Technical decisions

- **Drop the staged age migration rather than renumber it.** The alternative —
  keeping it and widening to 99 — would have made the column disagree with
  `features/onboarding/age.ts`'s `MAX_AGE = 90`, which is the precise shape of
  the bug finding F2 reported. Upstream owning the bounds alone is the only
  arrangement where they cannot drift, and `create_my_profile` already passes
  `p_age` through without re-validating, so no function needed changing.
- **Two PRs, not one PR with `migrate` disabled.** The alternative to splitting
  was to open a single PR and turn the `migrate` job off while applying all four
  migrations by hand. Rejected: it needs a CI change as part of a security PR,
  and it leaves `main` in a state where a later unrelated push applies
  migrations nobody re-checked. Splitting needs no CI change and makes the
  risky migration its own reviewable, revertible commit.
- **Renumber rather than leave the timestamps.** Tempting to treat as cosmetic
  and defer to whoever opens the PR, but three upstream migrations now sort
  after `20260930…`, so the staged files were no longer appendable to the
  timeline. This is also now a recurring cost, flagged as such in both the
  README and the reconciliation doc: every upstream merge while the PR sits
  unopened re-stales them.
- **A local RPC contract plus one cast, not an edit to `database.ts`.**
  Alternatives rejected: editing the tracked generated types (fails
  `upstream:check`, and `CLAUDE.md` forbids it outright); `@ts-expect-error` at
  each of twelve call sites (suppresses the argument checking that is the whole
  point, since `p_words`/`p_points`/`p_tasks` keys are column names); `any` on
  the client (same). The chosen shape keeps every argument type-checked, isolates
  the unsoundness to one 10-line helper, and has an explicit deletion trigger.
- **snake_case keys in the exported input types.** Deliberately inconsistent
  with the camelCase used elsewhere in `packages/data`. These objects are
  serialised to `jsonb` and read back inside the functions with
  `->> 'image_url'`, so the keys are column names; renaming them to match
  house style would compile and then silently publish words with no image.
  Called out in both the module doc and the tests.
- **Test the wire contract, not the authorization.** The wrappers have no logic
  of their own — the boundary lives in SQL, and
  `docs/migrations/wp-2.3/tests/negative-tests.sql` is what proves a student and
  a non-owning teacher are rejected. Duplicating that intent in a mock would
  assert only that the mock was written to agree with it. What the unit tests
  pin instead is the half the type-checker cannot catch: the exact name and
  argument object crossing into `jsonb`.
- **Left the `docs/changes/SCN-*.md` history untouched** when renumbering. Those
  files are the record of what past tickets did, and `SCN-11` did stage
  `20260930000005`. Rewriting them would make the history lie.

## Data, API and configuration

No migrations exist in this repository and none were added — `docs/migrations/`
is staging for upstream, which is the only repository that owns
`supabase/migrations/`. Net effect of this ticket on that staging directory:
four migrations renamed, two files deleted, zero SQL statements changed.

No schema change, no new endpoint, no env var, no feature flag, no new
dependency. `packages/data`'s public surface grows by twelve functions and six
exported types, all unreachable until the upstream PR merges.

Twelve RPC contracts are introduced on the native side (names, arguments and
return types in `GuardedRpcs`), but they describe functions that do not exist
yet; they are not a live API.

## How to verify

- `npm run type-check` — passes clean.
- `npm run lint` — passes clean.
- `npm test` — 43 files, 383 tests, all passing; 25 of those are the new
  `guardedWrites.test.ts`.
- `npm run upstream:check` — 48/48 tracked files in sync. (Worth recording: the
  7-file drift `SCN-52`'s exit check found is now clear.)
- `npm run upstream:fetch` then
  `gh api repos/rubanwd/slay-city/compare/7612da5...02630a3` — reproduces the
  nine-commit diff this rebase was derived from, including the three merged
  migrations and the `onboarding/actions.ts` change.
- The RLS evidence table in `docs/UPSTREAM-PR-WP-2.3.md` is reproducible from
  `upstream/supabase/migrations/` at `02630a3`; every row cites the file and
  line it was read from.
- `docs/migrations/wp-2.3/tests/negative-tests.sql` was **not** re-run against a
  database in this ticket — the §11 edit is the only change to it, and no
  Postgres container was stood up. `SCN-13`'s run (70 PASS, 0 FAIL) remains the
  last executed evidence, and §11's three changed assertions are unverified
  against a live constraint.

## Limitations and follow-ups

- **The PR is not open, which is the ticket's headline deliverable and its
  third acceptance criterion.** Two of the package's own gating checklist items
  cannot be closed from this repository: **U-1** is a diff of production's live
  policies and grants against the migration timeline the entire evidence
  section assumes (the reading is from migration files; if production has
  drifted, conclusions drawn from them are wrong), and **U-3** is a product
  decision on whether to audit and clean up `user_stats` rows that were already
  forged. `MIGRATIONS-NEEDED.md` §10 step 1 names finding F1 as the one item
  that should be decided explicitly rather than merged silently — and it is
  live on production right now, independent of the native app.
  Scoped more precisely after the two-PR split (§5): **U-1 gates PR #2 only**,
  since PR #1 is purely additive and cannot weaken anything whatever
  production's current grants are. U-3 does not technically gate either PR —
  the migration never touches an existing `user_stats` row — so a maintainer
  can unblock it with one decision ("clean-up is a follow-up ticket"). What
  genuinely cannot be done without production access is confirming the
  evidence table against the live database, and that is only required before
  the revoke.
- **"CI is green" is unverifiable from here** even once opened. Upstream's `ci`
  job runs lint, type-check, vitest and the Next.js build against the web
  source tree, which this repository does not contain; the thin callers were
  checked by resolving every import and symbol, not by compiling them. The
  database tests are not in upstream's CI at all until
  `ci-database-tests.yml` is merged (`R8`).
- **The wrappers stay dead code until the PR merges.** That is intended, per the
  ticket, but it means nothing exercises them against a real database and the
  `callGuardedRpc` cast is not deletable yet.
- **The rebase will need repeating.** Every upstream migration merged while this
  PR sits unopened re-stales the four timestamps. The cost is now documented in
  three places rather than discovered again.
- **W-04 remains out of scope by design** — a Storage upload cannot run inside a
  Postgres function. It belongs to `WP-5.6`'s `generate-image` Edge Function,
  a second unmerged upstream PR (`docs/UPSTREAM-PR-WP-5.6.md`), which is also
  why `WP-5.3` needs two merges and not one (`WP-2.3-RECONCILIATION.md` §4).
- **R5 / R6 unchanged** — the `profiles.username` table CHECK and the
  teacher-wide (rather than teacher-scoped) `vocab_image_cache` both remain
  deliberate deferrals, neither blocking `P8`.
