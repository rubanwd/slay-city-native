# SCN-13 — Add SQL/RLS regression tests for teacher RPC authorization boundaries

> Type: task · Date: 2026-09-30

## Context

`WP-2.3` (`SCN-11`, `SCN-12`) replaced 21 phone-unsafe direct table writes with
twelve `SECURITY DEFINER` RPCs, each re-checking the caller's role and the
record's ownership in SQL instead of relying on a TypeScript guard that only
ran on the Next.js server. `SCN-11` already wrote the regression evidence for
that boundary — `docs/migrations/wp-2.3/tests/negative-tests.sql`, a single
transaction of `DO` blocks that fakes `request.jwt.claims` and asserts a
`student`, a non-owning teacher, and (via the missing table grants) a direct
PostgREST write are all rejected.

That file had two gaps `SCN-13` was opened to close, both named in its
acceptance criteria:

1. **Not CI-runnable.** The first block was seven `set_config` calls with
   placeholder all-zero UUIDs and a comment reading "FILL THESE IN" — a human
   had to look up real row ids from a target database before every run. A
   script that needs a human in the loop cannot run in CI, and a test that
   only runs when someone remembers to run it by hand is not a regression
   test.
2. **No `anon` coverage.** Every existing section drove the boundary with a
   `student` or `teacher` JWT (`set local role authenticated`). Nothing
   exercised the unauthenticated case — the public `anon` key an app ships
   with — which is a materially different boundary: a rejected `student` call
   still reaches the function body and is turned away by
   `can_author_group`/`can_author_topic`; a rejected `anon` call never gets
   that far, because `revoke all … from public` / `grant execute … to
   authenticated` (already asserted mechanically in the existing §5c/§5d) is
   supposed to stop it before the function runs at all.

This repository has no `supabase/` directory and never will (`AGENTS.md`,
"Migrations belong upstream") — the web repository (`rubanwd/slay-city`) owns
the migration timeline, and `WP-2.3`'s SQL is staged here only to be copied
over as a pull request. `SCN-13` follows that same pattern: everything below
is staged for the web repo, not runnable in this one.

## What was done

**Automated the fixtures.** `docs/migrations/wp-2.3/tests/fixtures.sql` is
new. It replaces the manual "FILL THESE IN" block with real inserts — four
`auth.users` rows, three `profiles` rows (a student, the owning teacher, a
second teacher who owns nothing the student can reach), a `teacher_groups`
row the student is a member of, a `homework_topics` row inside it, and a
second, disjoint `teacher_groups`/`homework_topics` pair the student is *not*
a member of (the `foreign_topic` fixture `AC4`/cross-group-isolation section
6 needs) — all under fixed literal UUIDs for readability, then calls the same
`set_config('wp23.*', …)` sequence the rest of the suite already reads.
`negative-tests.sql` now pulls it in with `\ir fixtures.sql` (resolved
relative to the including script, not the caller's working directory) right
after `begin;`, so the whole suite runs unattended with one `psql` invocation.
Both files run inside `negative-tests.sql`'s existing `begin; … rollback;`,
so nothing the fixtures insert survives a run.

**Added the `anon` case.** A new "Section 0" in `negative-tests.sql` switches
to `set local role anon` with `request.jwt.claims` cleared entirely and
attempts one call into each of the three distinct RPC "shapes" in the package
— an authoring write (`create_homework_topic`), a publish
(`publish_homework_vocabulary`), a Q&A write (`post_topic_message`), and
onboarding (`create_my_profile`) — asserting each raises `insufficient_privilege`
(`42501`) before ever reaching the function's own logic. This is the
"anonymous where applicable" case the ticket's acceptance criteria named that
the existing suite didn't cover.

**Wrote a stock-Postgres bootstrap and proved the whole chain replays.**
`docs/migrations/wp-2.3/tests/bootstrap.sql` is new — the ~130-line "what
Supabase provides that a plain `postgres:16-alpine` container does not"
script referenced (but never committed) by the project's `[[upstream-schema-replays-on-stock-postgres]]`
memory from the original `SCN-11` verification: the `anon`/`authenticated`/
`service_role`/`authenticator` roles, `auth.users`, `auth.uid()`/`auth.role()`,
`storage.buckets`/`storage.objects` with `storage.foldername()`, and the
`supabase_realtime` publication `20260722000002_homework_qa.sql` adds a table
to. This was built and verified end-to-end in this session, in Docker,
against a **fresh** `postgres:16-alpine` container:

1. `bootstrap.sql` applied cleanly.
2. All 67 files in `upstream/supabase/migrations/` (the real, fetched
   migration timeline, at the commit read for this package) applied in order
   with zero edits.
3. All five `docs/migrations/wp-2.3/*.sql` files applied in order with zero
   edits.
4. `negative-tests.sql` (now pulling in `fixtures.sql`) ran via
   `psql -v ON_ERROR_STOP=1`, exit code 0, 70 `PASS` notices, zero `FAIL`,
   zero `SKIP` (all five `wp-2.3` migrations were applied, so §4/§5/§11 all
   ran instead of skipping) — including the four new §0 checks.
5. **Confirmed the suite actually regresses, not just passes.** Rebuilt the
   chain on a second fresh container with `20260930000004_revoke_direct_write_grants.sql`
   (4/4, the lockdown) deliberately held back — simulating a weakened
   boundary — and reran the same test. It failed exactly as designed:
   `psql` exited 3 on `FAIL 4c: DELETE on homework_vocab_tasks still granted`,
   the first check in the file that needs 4/4. This is the acceptance
   criterion "new authorization tests fail if role/scope checks are
   weakened," demonstrated rather than asserted.

Both throwaway containers were removed after verification; nothing was left
running.

**Wired it into CI.** `docs/migrations/wp-2.3/ci-database-tests.yml` is a new
GitHub Actions job, staged to merge into the web repository's
`.github/workflows/ci.yml` (fetched and read for this package — it currently
runs lint, type-check, the `unit` vitest project and the Next.js build, with
no database step of any kind). The job starts a `postgres:16-alpine` service
container, runs `bootstrap.sql`, replays every file under `supabase/migrations/`
in lexical (= chronological, given the timestamp-prefixed filenames) order,
then runs `negative-tests.sql`. It needs nothing beyond the `postgresql-client`
GitHub's `ubuntu-latest` runner already has — no pgTAP, no Supabase CLI, no
`supabase/config.toml` change — since the existing harness is plain `psql` +
`DO` blocks, not pgTAP, and `SCN-13` kept that choice rather than introducing
a new tool for one job.

**Documentation.** `docs/migrations/wp-2.3/README.md` gained the three new
files in its "What is here" table, a rewritten "Verifying" section describing
the now-unattended run (with the exact commands used to verify it in this
session) and what each section of the suite proves, and a new "CI" section
describing the job and the `supabase/tests/wp-2.3/` destination path it
assumes (new — nothing under `supabase/` in the web repo runs a database test
today). `docs/UPSTREAM-PR-WP-2.3.md` — the staged pull-request body — gained
a note in its banner, an updated "Test plan" checkbox, and a new checklist
line recording that the negative-test hardening is done but the CI job itself
is not yet merged into the web repo's workflow file.

## Changes by file

- `docs/migrations/wp-2.3/tests/bootstrap.sql` — new. The stock-Postgres
  platform bootstrap (roles, `auth`/`storage` schemas and stand-in functions,
  the realtime publication) that lets the migration timeline and the wp-2.3
  migrations replay against a plain `postgres:16-alpine` container. Generic
  to the whole migration timeline, not wp-2.3-specific, but staged here since
  this is the first package that needed it committed rather than recreated by
  hand each time.
- `docs/migrations/wp-2.3/tests/fixtures.sql` — new. Creates the
  student/teacher/other-teacher/fresh-user `auth.users` + `profiles` rows, the
  owned and foreign `teacher_groups`/`homework_topics` pairs, and points every
  `wp23.*` config var `negative-tests.sql` reads at them. Replaces the old
  "fill these ids in by hand" block.
- `docs/migrations/wp-2.3/tests/negative-tests.sql` — modified. Replaced the
  manual fixture-id block with `\ir fixtures.sql`; added "Section 0" (four new
  checks: `anon` cannot call `create_homework_topic`, `publish_homework_vocabulary`,
  `post_topic_message`, or `create_my_profile`); rewrote the header comment's
  "HOW TO RUN" section to cover both local and CI use and to reference the new
  files.
- `docs/migrations/wp-2.3/ci-database-tests.yml` — new. The GitHub Actions job
  to merge into the web repo's `ci` workflow, with an inline comment
  explaining the assumed file layout and why plain `psql` was chosen over
  pgTAP.
- `docs/migrations/wp-2.3/README.md` — modified. Added the three new files to
  the file table, rewrote "Verifying" to describe the unattended run and what
  was proved while validating it this session, added a "CI" section.
- `docs/UPSTREAM-PR-WP-2.3.md` — modified. Banner note, "Test plan" checkbox
  update, new checklist line for the `SCN-13` work and its not-yet-merged CI
  job.
- `docs/changes/SCN-13.md` — new. This file.

## Technical decisions

- **Plain `psql` + `DO` blocks over pgTAP.** The web repo has no existing
  database-test convention at all (`supabase/tests/` doesn't exist there
  yet), and `SCN-11`'s `negative-tests.sql` had already established the
  `psql -v ON_ERROR_STOP=1` + `RAISE EXCEPTION`/`RAISE NOTICE` pattern.
  Introducing pgTAP for this one hardening ticket would mean a new extension,
  a new assertion library, and a rewrite of a file that already works and is
  already read by a human as its own documentation — no benefit proportional
  to the cost. Kept.
- **Fixed literal UUIDs in `fixtures.sql`, not `gen_random_uuid()`.** The
  whole suite runs inside one transaction that always ends in `ROLLBACK`, so
  idempotency across runs was never a concern. Fixed ids make a failing
  assertion's output ("teacher=22222222-…") legible without a second query,
  which matters more for a file a human reads when CI goes red.
- **`\ir` instead of `\i`.** `\i` resolves a relative path against `psql`'s
  own working directory, which is whatever CI happened to `cd` to;
  `\ir` resolves against the including script's own directory. Verified the
  difference directly — `\i fixtures.sql` failed with "No such file or
  directory" run from outside `tests/`, `\ir fixtures.sql` did not.
- **`bootstrap.sql` committed rather than left as a one-off.** The project
  memory `[[upstream-schema-replays-on-stock-postgres]]` already recorded that
  this approach works and roughly what it needs, but the script itself was
  never saved after the `SCN-11` session that built it — every future package
  under `docs/migrations/` would otherwise reconstruct it from scratch. Its
  scope is the whole migration timeline, not `WP-2.3`, but it lives under
  `docs/migrations/wp-2.3/tests/` for now since that's the only package that
  needs it; a second package needing it is the trigger to promote it
  somewhere shared.
- **CI job staged as a separate file, not inlined into `UPSTREAM-PR-WP-2.3.md`.**
  Every other `UPSTREAM-PR-WP-2.3.md` section is prose describing a diff; a
  ~50-line YAML block would be copy-pasted directly into a `.yml` file by
  whoever opens the PR, so it is more useful verbatim in its own file (with
  `git diff`-able formatting) than embedded in a Markdown code fence.
- **`supabase/tests/wp-2.3/` as the destination, not `supabase/tests/database/`.**
  Supabase CLI's own convention (`supabase test db`) expects pgTAP under
  `supabase/tests/database/`; since this harness is intentionally not pgTAP,
  using that exact path would misleadingly imply CLI-native test-runner
  support that isn't there. A `wp-2.3`-named subdirectory under `supabase/tests/`
  keeps it discoverable without the implication.

## Data, API and configuration

None. No schema change — this ticket adds test coverage for RPCs `SCN-11`
already wrote; it does not add, remove or alter a table, column, policy,
grant or function. No new dependency: the CI job uses `postgresql-client`,
already present on GitHub's `ubuntu-latest` runner image.

## How to verify

- Ran, in this session, against Docker (`postgres:16-alpine`, removed after):
  `bootstrap.sql` → all 67 `upstream/supabase/migrations/*.sql` → all five
  `docs/migrations/wp-2.3/2026*.sql` → `negative-tests.sql`
  (`psql -v ON_ERROR_STOP=1`). Result: exit 0, 70 `PASS`, 0 `FAIL`, 0 `SKIP`.
- Re-ran the same chain on a second fresh container with
  `20260930000004_revoke_direct_write_grants.sql` held back. Result: exit 3,
  `FAIL 4c: DELETE on homework_vocab_tasks still granted` — proves the suite
  detects a weakened boundary instead of passing regardless.
- To reproduce once this package is copied into the web repository:
  ```bash
  psql -v ON_ERROR_STOP=1 -f supabase/tests/wp-2.3/bootstrap.sql
  for f in $(ls supabase/migrations/*.sql | sort); do
    psql -v ON_ERROR_STOP=1 -f "$f"
  done
  psql -v ON_ERROR_STOP=1 -f supabase/tests/wp-2.3/negative-tests.sql
  ```
- Not run: the GitHub Actions job itself (`ci-database-tests.yml`) — it only
  runs once merged into `rubanwd/slay-city`'s own `.github/workflows/ci.yml`,
  which is outside this repository. Its steps are the exact commands just
  verified above, run against an ephemeral `postgres:16-alpine` service
  container instead of a local Docker container, so the only untested delta
  is GitHub Actions' `services:` plumbing itself.
- This repository's own gates: nothing under `src/`, `packages/`, or the
  native app's own test/type-check/lint surface changed, so `npm run lint`,
  `npm run type-check` and `npm test` are unaffected by this change (not
  re-run for this reason — see `AGENTS.md` on why `docs/migrations/` is
  exempt from this repo's own build).

## Limitations and follow-ups

- **Not yet merged into the web repo.** Per this repository's standing rule
  (no `supabase/` directory, ever), none of this runs until a human opens the
  `WP-2.3` pull request and copies `docs/migrations/wp-2.3/*.sql`,
  `docs/migrations/wp-2.3/tests/*.sql` and the `database-tests` job in
  `ci-database-tests.yml` into place, per `docs/UPSTREAM-PR-WP-2.3.md`.
- **Anon coverage is 4 of 12 RPCs, not all 12.** Section 0 covers one
  representative call per "shape" (authoring, publish, Q&A, onboarding) on the
  reasoning that all twelve share the same two-layer guard (`revoke … from
  public` + `grant … to authenticated`, already asserted structurally for
  every one of them in §5c/§5d) — an `anon` rejection is a grant-level
  property, not a per-function one, so exhaustive per-function anon checks
  would be repetition without additional coverage. If a future RPC is added
  with a different grant shape, this reasoning should be revisited.
- **`ci-database-tests.yml` is unverified against real GitHub Actions.** The
  underlying `psql` commands were verified directly in Docker; the YAML
  syntax and the `services:` container wiring were written to GitHub Actions'
  documented conventions but not run through an actual Actions run, since
  this repository has no CI of its own to execute someone else's workflow
  file against.
- **`bootstrap.sql`'s scope is broader than `WP-2.3`.** It bootstraps the
  whole Supabase-on-stock-Postgres approach, which any future `docs/migrations/`
  package will likely need again. Left under `wp-2.3/tests/` rather than
  promoted to a shared location, since this is the only consumer so far.
