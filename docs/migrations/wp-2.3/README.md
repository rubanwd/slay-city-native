# `WP-2.3` migrations — staged for `rubanwd/slay-city`

> **These files do not run in this repository.** They are the SQL deliverable of
> `SCN-11`, written here because this repository has no `supabase/` directory
> and never will ([AGENTS.md](../../../AGENTS.md), "Migrations belong
> upstream"). Copy them into the web repository's `supabase/migrations/` on a
> branch and open the pull request described in
> [UPSTREAM-PR-WP-2.3.md](../../UPSTREAM-PR-WP-2.3.md).
>
> Base rebased onto upstream commit `02630a3` on `SCN-61` (2026-10-08), from
> the `7612da5` the package was originally written against. What that rebase
> changed, and why, is recorded in
> [UPSTREAM-PR-WP-2.3.md](../../UPSTREAM-PR-WP-2.3.md) §"Rebase onto `02630a3`".
> In short: the timestamps moved from `20260930…` to `20261008…` so they still
> sort after upstream's own `20261001`–`20261004` migrations, and the fifth
> migration was dropped because upstream resolved `profiles.age` itself.
> Re-verify before applying — the migration timeline will have moved again.

## What is here

| File | Applies | Reversible by |
| --- | --- | --- |
| `20261008000001_teacher_authoring_rpcs.sql` | 11 functions covering W-01…W-03, W-05…W-17 | `down/…_teacher_authoring_rpcs_down.sql` |
| `20261008000002_homework_qa_rpcs.sql` | 4 functions covering W-18…W-20, plus the `body` length CHECK | `down/…_homework_qa_rpcs_down.sql` |
| `20261008000003_onboarding_profile_rpc.sql` | `create_my_profile`, the `user_stats` trigger, the stranded-profile backfill (W-21, W-22) | `down/…_onboarding_profile_rpc_down.sql` |
| `20261008000004_revoke_direct_write_grants.sql` | removes `authenticated`'s write grants on the eight audited tables | `down/…_revoke_direct_write_grants_down.sql` |
| `tests/bootstrap.sql` | nothing to the target database — run against a *fresh* one first, see [Verifying](#verifying) | n/a |
| `tests/fixtures.sql` | nothing — included by `negative-tests.sql`, rolled back with it | n/a |
| `tests/negative-tests.sql` | nothing — one transaction that ends in `ROLLBACK` | n/a |
| `ci-database-tests.yml` | nothing — a CI job to merge into the web repo's `.github/workflows/ci.yml`, see [CI](#ci) | n/a |

`W` ids refer to the operation inventory in the audit that specified this work:
`docs/native-app/DIRECT-WRITES.md` upstream, mirrored here as
[`.atlas/assets/direct-writes-4nzmc9.md`](../../../.atlas/assets/direct-writes-4nzmc9.md).

## Order

1/4, 2/4 and 3/4 are **additive**. They add functions and one CHECK; they drop
no policy and revoke no grant, so every current direct write keeps working and
the web app is unaffected until it is changed to call them. Apply them whenever.

4/4 is the **lockdown** and is the only breaking file. Apply it *after* a web
app that calls the RPCs is deployed. Applying it against the current web app
breaks teacher authoring, the Q&A thread and onboarding at once.

3/4 must precede 4/4 for a second reason: it installs the trigger that creates
`user_stats` rows, and 4/4 revokes the INSERT grant the parent sign-up path in
`features/auth/roleRouting.ts` relies on.

There is no 5/5. `SCN-11-1` staged one — a widening of the `profiles.age`
CHECK — and `SCN-61` dropped it on rebase: upstream shipped the same fix as
`20261001000001_widen_profile_age_range.sql`, choosing 5–90 where this package
had chosen 5–99. Re-applying ours would have put the column back out of step
with `features/onboarding/age.ts`, which is the bug finding F2 described in the
first place. Nothing in 1/4–4/4 depended on it; none of the RPCs re-validate
the age range.

## Rolling back

Every file has a counterpart in `down/`, and they undo in reverse order:
`004 → 003 → 002 → 001`. `down/…_revoke_direct_write_grants_down.sql` is the
one to reach for first in an incident — it restores the old write paths without
touching a function, and since no RLS policy was ever changed, the boundary
returns to exactly what it was before this work package.

Two things the rollbacks deliberately do not undo:

- the backfilled `user_stats` rows (3/4). They are zeroed rows those accounts
  should always have had and are indistinguishable from any other. Deleting
  them would strand the accounts again.
- nothing else. There is no data migration here beyond that backfill.

## Verifying

`tests/negative-tests.sql` is the evidence for `AC3` and `AC4`, hardened with
explicit CI regression coverage on `SCN-13`. It fakes `request.jwt.claims` and
`set local role authenticated` (or, for the unauthenticated case, `anon`) —
the same role and claim shape PostgREST gives a real request — so it exercises
the grants and policies a real client meets, not a superuser's view of them.
Section 0 covers `anon` (no session at all), sections 1–3 a `student`, section
6 a **non-owning teacher** (`AC4`, the cross-group-isolation case), and
section 7 the owning teacher's flows, to prove the boundary doesn't also
reject the caller it's supposed to let through.

As of `SCN-13` nothing needs filling in by hand: `tests/fixtures.sql` creates
its own rows and `negative-tests.sql` pulls it in itself (`\ir fixtures.sql`).
Run it against a *fresh* database that has replayed the whole migration
timeline — `tests/bootstrap.sql` first (the roles, schemas and `auth`/`storage`
stand-ins a plain `postgres:16-alpine` container doesn't have; see
[[upstream-schema-replays-on-stock-postgres]] in project memory for how this
was derived), then every file in the web repository's `supabase/migrations/`
in order, including 1/4–4/4 above:

```bash
psql -v ON_ERROR_STOP=1 -f tests/bootstrap.sql
for f in $(ls path/to/supabase/migrations/*.sql | sort); do
  psql -v ON_ERROR_STOP=1 -f "$f"
done
psql -v ON_ERROR_STOP=1 -f tests/negative-tests.sql
```

`psql -v ON_ERROR_STOP=1` is what makes this CI-safe: the first `DO` block
that raises aborts the script and exits non-zero, rather than leaving a `FAIL`
notice for someone to notice or not.

Sections 4 and 5 assert the revokes and therefore need 4/4 applied — without
it they fail outright (confirmed while writing `SCN-13`: holding 4/4 back and
re-running prints `FAIL 4c: DELETE on homework_vocab_tasks still granted` and
`psql` exits 3, which is the point — a weakened grant is a failed run, not a
quiet pass). Section 5a is worth running against production **before** the
migration too: there it is expected to succeed, and that success is finding
F1.

Section 11 needs no file from this package. It pins the widened `profiles.age`
range that upstream's own `20261001000001_widen_profile_age_range.sql` installs
(5–90, matching `features/onboarding/age.ts`), and reads the constraint first:
against a timeline older than that migration it prints `SKIP 11` and the rest
of the file still passes.

## CI

`ci-database-tests.yml` is the job to merge into the web repository's
`.github/workflows/ci.yml`, which today runs lint, type-check, the `unit`
vitest project and the Next.js build with no database step at all (checked
against `upstream/.github/workflows/ci.yml` as fetched for this package). Add
it as a sibling of the existing `ci` job and add its name to `migrate`'s
`needs:` list, so a push to `main` only reaches `supabase db push` after the
authorization boundary passes too.

It assumes this package has already been copied into place per the table
above, plus `tests/bootstrap.sql`, `tests/fixtures.sql` and
`tests/negative-tests.sql` copied to a new `supabase/tests/wp-2.3/` — nothing
under `supabase/` in the web repo runs a database test today, so that
directory doesn't exist yet. Plain `psql` + `DO` blocks was chosen over pgTAP
so the job needs nothing beyond the `postgresql-client` GitHub's
`ubuntu-latest` runner already has — no new tool, no `supabase/config.toml`
change, no local Supabase CLI dependency.
