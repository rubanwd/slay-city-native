# `WP-2.3` migrations — staged for `rubanwd/slay-city`

> **These files do not run in this repository.** They are the SQL deliverable of
> `SCN-11`, written here because this repository has no `supabase/` directory
> and never will ([AGENTS.md](../../../AGENTS.md), "Migrations belong
> upstream"). Copy them into the web repository's `supabase/migrations/` on a
> branch and open the pull request described in
> [UPSTREAM-PR-WP-2.3.md](../../UPSTREAM-PR-WP-2.3.md).
>
> Base read at upstream commit `7612da5`. Re-verify before applying — the
> migration timeline will have moved.

## What is here

| File | Applies | Reversible by |
| --- | --- | --- |
| `20260930000001_teacher_authoring_rpcs.sql` | 11 functions covering W-01…W-03, W-05…W-17 | `down/…_teacher_authoring_rpcs_down.sql` |
| `20260930000002_homework_qa_rpcs.sql` | 4 functions covering W-18…W-20, plus the `body` length CHECK | `down/…_homework_qa_rpcs_down.sql` |
| `20260930000003_onboarding_profile_rpc.sql` | `create_my_profile`, the `user_stats` trigger, the stranded-profile backfill (W-21, W-22) | `down/…_onboarding_profile_rpc_down.sql` |
| `20260930000004_revoke_direct_write_grants.sql` | removes `authenticated`'s write grants on the eight audited tables | `down/…_revoke_direct_write_grants_down.sql` |
| `20260930000005_widen_profile_age_range.sql` | widens `profiles.age`'s CHECK from 7–14 to 5–99 (decision recorded on `SCN-11-1`) | `down/…_widen_profile_age_range_down.sql` |
| `tests/negative-tests.sql` | nothing — one transaction that ends in `ROLLBACK` | n/a |

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

5/5 is independent of 1/4–4/4 and of their ordering: it only touches the
`profiles.age` CHECK, which none of the RPCs re-validate. Apply it whenever.

## Rolling back

Every file has a counterpart in `down/`, and they undo in reverse order:
`005 → 004 → 003 → 002 → 001`. `down/…_revoke_direct_write_grants_down.sql` is the
one to reach for first in an incident — it restores the old write paths without
touching a function, and since no RLS policy was ever changed, the boundary
returns to exactly what it was before this work package.

Two things the rollbacks deliberately do not undo:

- the backfilled `user_stats` rows (3/4). They are zeroed rows those accounts
  should always have had and are indistinguishable from any other. Deleting
  them would strand the accounts again.
- nothing else. There is no data migration here beyond that backfill.

## Verifying

`tests/negative-tests.sql` is the evidence for `AC3` and `AC4`. Fill in the
fixture ids at the top, run the whole file, read the notices. It fakes
`request.jwt.claims` and `set local role authenticated` — the same role and
claim shape PostgREST gives a signed-in request — so it exercises the grants
and policies a real client meets, not a superuser's view of them.

Sections 4 and 5 assert the revokes and therefore need 4/4 applied. Section 5a
is worth running against production **before** the migration too: there it is
expected to succeed, and that success is finding F1.

Section 11 covers 5/5 — the widened `profiles.age` range — and reads the
constraint first: if 5/5 is not applied it prints `SKIP 11` and the rest of the
file still passes, so the two halves of this directory can be verified
independently.
