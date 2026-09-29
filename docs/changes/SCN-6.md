# SCN-6 — Audit and document required Supabase migrations for teacher tools

> Type: research · Date: 2026-09-29

## Context

On the web (`rubanwd/slay-city`), every teacher-facing write runs inside a
Next.js Server Action that begins with `requireTeacher()` — a role check
executing on a server the user cannot reach. The native app has no Server
Actions. Whatever these code paths do will be done by the device, holding the
public anon key and a user JWT, straight against PostgREST.

`docs/RISKS.md` records this as `R1` (critical): *"Five action files perform 32
direct table writes and rely on `requireTeacher()` running on a server the user
does not control… If these ship as direct client writes and RLS does not already
forbid them, any signed-in student could author homework for any group."*
`docs/WORK-PACKAGES.md` `WP-2.3` carries the mitigation and gates all of M5.

This item is the analysis half of `WP-2.3`: determine, write by write, whether
the database *alone* already refuses the write, and where it does not, name the
`SECURITY DEFINER` RPC that must be written. Explicitly **no migrations** — the
web repository owns `supabase/migrations/` and any fix lands there as a reviewed
pull request.

The five files in scope: `teacher/vocabularyActions.ts`,
`teacher/grammarActions.ts`, `teacher/actions.ts`, `homework/qa/actions.ts`,
`onboarding/actions.ts`.

## What was done

`npm run upstream:fetch` checked the web app out to the gitignored `./upstream`
at commit `7612da5` (2026-09-19). The five action files were read in full, then
every `.from(…).insert/update/upsert/delete` and every `storage.from(…).upload`
call site was extracted — 21 table writes plus one Storage object write. For
each, the owning table's RLS policies were traced through the 67-file migration
timeline (`20260701000001_initial_schema.sql` …
`20260919000001_profiles_insert_role_guard.sql`), together with the grants,
`CHECK` constraints and `BEFORE INSERT/UPDATE` triggers that also gate the write.

The findings are written to `docs/MIGRATIONS-NEEDED.md`.

**Headline result — the assumption behind `R1` is wrong in the reassuring
direction, and wrong in an alarming one somewhere else.**

All 16 writes across the three teacher-authoring files are **already fully
authorised by RLS and need no new RPC**. The policies they rely on
(`homework_vocab_words_insert_teacher`, `homework_grammar_points_delete_teacher`,
`homework_topics_update_teacher`, and their siblings) never checked
`role = 'teacher'` at all. They check *group ownership*:

```sql
EXISTS (SELECT 1 FROM homework_topics t
        JOIN teacher_groups g ON g.id = t.group_id
        WHERE t.id = topic_id AND g.teacher_id = auth.uid())
```

That predicate is strictly stronger than a role check, and it holds because
`teacher_groups` is admin-only (`teacher_groups_insert_admin`,
`teacher_groups_update_admin` are both `is_admin()`), so a user cannot create a
group or point one at themselves; and because the `EXISTS` subquery is itself
evaluated under `teacher_groups_select_own_or_admin`, so the check applies twice
over. A `student` JWT has no `teacher_groups` row and the predicate is false for
every topic in the database. Replacing these with an `is_teacher()` RPC would be
a *downgrade* — it would let any teacher write to any group — and would violate
`WP-2.3` `AC6`.

The `homework/qa/actions.ts` writes are likewise safe: `hw_messages_insert` pins
`author_id = auth.uid()`, so the risk `docs/MIGRATION-MAP.md` names for that file
("posting messages as another teacher") cannot occur.

**The real hole is in `onboarding/actions.ts`, and it is live on the web today.**
`user_stats_insert_own` is `with check (auth.uid() = profile_id)` and nothing
else — it constrains *which row*, never *what is in it*. There is no `CHECK`, no
trigger, and `authenticated` holds `grant select, insert`. A freshly registered
user can `POST /rest/v1/user_stats` with their own uid and
`{"xp": 999999, "coins": 999999, "level": 99}` before onboarding runs.
`purchase_wardrobe_item()` spends exactly that `coins` value and only checks
`coins >= cost`, so the wardrobe economy is bypassed outright; the same numbers
feed parent and teacher dashboards. It is one shot per account (unique
`profile_id`, no UPDATE policy, no DELETE grant) — but accounts are free.

This is the identical blind spot that
`20260919000001_profiles_insert_role_guard.sql` closed for `profiles.role` one
month ago: a `BEFORE UPDATE` guard that never sees an INSERT. `WP-2.3` instructs
the agent to stop and report if the audit finds an existing hole in the *web*
app, so it is reported rather than worked around.

Three further risks are documented: paid OpenRouter generation
(`generateVocabularyDraft`, `generateWordImage`, `generateGrammarDraft`) is
gated *only* by `requireTeacher()` — no RLS protects it because it writes
nothing, and `homework_topics_select` already shows students every topic in their
group, so the Edge Functions of `WP-5.6` must re-check the role before spending
money; `homework_topic_messages.body` has no length constraint in SQL while the
2 000-character limit lives only in the action; and `profiles.username` has no
`CHECK`, so `checkUsername()` is bypassable — and that string is rendered to
other users through `get_topic_messages()`.

Behaviour before → after: nothing executable changed. Before, `WP-2.3` could not
start because no one knew which of the 21 writes needed an RPC. After, the answer
is 2 of 21, the required function is named and specified, the eight negative
tests that prove `AC3`/`AC4` are enumerated, and a live production issue is on
the maintainer's desk with a reproduction.

## Changes by file

- `docs/MIGRATIONS-NEEDED.md` — (new) the audit. Ten sections: why the audit
  exists; the verdict summary; the per-file write inventory tables (action,
  table, operation, the exact policy relied on, `RPC?`, notes); the ownership-chain
  argument for why the teacher writes are safe; the RPC inventory split into
  "already exists and reusable" versus "must be written"; four ranked security
  risks with reproductions and fixes; four hardening notes; scope limits; the
  negative-test list for `WP-2.3` `AC3`/`AC4`; and a recommended order of work.
- `docs/changes/SCN-6.md` — (new) this summary.

No source files were touched. No migrations were written — the item is analysis
only, and `supabase/migrations/` does not exist in this repository by design.

## Technical decisions

- **The required table carries the exact policy name, not a verdict word.**
  "Covered by RLS" is unreviewable; `homework_vocab_words_insert_teacher` can be
  looked up and disagreed with. The `RPC?` column answers only the authorisation
  question the ticket asks — could a non-teacher, or a teacher from another
  group, perform this write — and everything else (input validation, atomicity)
  is a separate note, so the security verdict cannot be diluted by robustness
  wishes.
- **Recommended against adding RPCs for the 16 teacher writes.** The obvious
  reading of `R1` is "wrap all of Category B". Rejected: the existing policies
  enforce ownership, an `is_teacher()`-based RPC would enforce only role, and
  swapping one for the other widens access while looking like hardening. Stated
  explicitly in §4 so the next person does not re-propose it.
- **Atomicity kept out of the security migration.** `publishVocabulary` is four
  unsynchronised round-trips and genuinely should be one RPC — on a phone, a
  mid-publish failure leaving words with no test is routine rather than rare.
  But folding it into `WP-2.3` would make an authorisation diff unreviewable, so
  `publish_topic_vocabulary` / `publish_topic_grammar` are listed as
  *recommended, not required*, to be argued on their own merits.
- **`user_stats` reported, not fixed.** A fix belongs upstream as a reviewed PR
  (`CLAUDE.md`: "the web repository owns the migration timeline"), and revoking
  `INSERT` on `user_stats` changes the live signup path for every existing user
  — not a call to make inside a research item. The document specifies the fix
  and the pre-check (confirm no other user-JWT caller inserts `user_stats`)
  instead.
- **Counts corrected rather than propagated.** The "14 / 9 / 3 / 3 / 2" figures
  in `docs/MIGRATION-MAP.md` and `docs/ARCHITECTURE.md` count `.from()` call
  sites including reads, not writes; the real totals are 21 table writes plus 1
  Storage write. Recorded in §2 of the audit. Those two documents were left
  unedited — correcting them is a doc change outside this item's scope, and the
  audit now says plainly where the discrepancy comes from.
- **Verified against the migration timeline, not the live database.** Stated as
  a scope limit in §8, with an instruction to confirm the `user_stats` finding
  against the live project before acting, in case a policy was added through the
  Supabase dashboard.

## Data, API and configuration

None. No migrations, no schema change, no endpoint, no env var, no feature flag,
no dependency. `./upstream` was fetched as a read-only reference and is
gitignored (`.gitignore:21`); nothing was imported from it or committed.

The audit *proposes* one migration for a future item — `create_my_profile(
p_username text, p_age smallint, p_level knowledge_level)`, plus revoking
`INSERT` on `public.user_stats` from `authenticated` and `CHECK` constraints on
`profiles.username` and `homework_topic_messages.body` — all landing upstream,
none written here.

## How to verify

- `git status` shows exactly two new files, both under `docs/`. No source file
  changed, so `npm run lint`, `npm run type-check` and `npm test` are unaffected
  by this item (nothing under `src/`, `packages/` or `app/` was touched, and
  `./upstream` is gitignored so eslint does not scan it).
- Reproduce the audit: `npm run upstream:fetch`, then check any row of the
  tables in §3 against the named policy in
  `upstream/supabase/migrations/`. The four load-bearing files are
  `20260720000009_homework.sql` (topics), `20260721000002_homework_vocabulary.sql`,
  `20260721000005_homework_grammar.sql`, and `20260701000001_initial_schema.sql`
  lines 276–297 (`profiles` / `user_stats`).
- Confirm the §6.1 finding by reading
  `upstream/supabase/migrations/20260701000001_initial_schema.sql:296` —
  `with check (auth.uid() = profile_id)` with no column predicate — and
  `:384`, `grant select, insert on public.user_stats to authenticated`. Then
  `grep -rn "user_stats" upstream/supabase/migrations/*.sql` to confirm no later
  `CHECK` or `BEFORE INSERT` trigger exists.
- The claims are static analysis of SQL, so the real verification is the eight
  negative tests listed in §9. They are specified but not written — see below.

## Limitations and follow-ups

- **`docs/MIGRATIONS-NEEDED.md` §6.1 needs a maintainer decision before mobile
  teacher work continues.** It is a live economic issue on the web, independent
  of this migration, and `WP-2.3` and `RISKS.md` R1 both say to stop and report
  rather than continue.
- No negative tests were written. §9 specifies all eight with the JWT role and
  expected error code for each; §9.1–§9.6 add no migrations and could be written
  immediately — they are what turns the §4 argument into evidence and satisfies
  `WP-2.3` `AC3`/`AC4`.
- No migration was written, by design. `WP-2.3` `AC2` (every `NEEDS RPC` has a
  migration with `search_path` pinned) and `AC5` (the web's actions call the new
  RPCs) remain open and land upstream.
- `teacher/viewAsActions.ts` — the sixth Category B file — is out of scope for
  this ticket and unaudited.
- Read paths were not audited, only writes. `homework_topics_select` was checked
  because §6.2 depends on it; the read surface as a whole was not.
- `docs/MIGRATION-MAP.md` and `docs/ARCHITECTURE.md` still carry the
  `.from()`-call-site counts described as writes. Worth correcting when those
  files are next touched.
- The `profiles.age` `CHECK (between 7 and 14)` contradicting the action's
  5–99 range (§7.3) is a pre-existing web bug surfaced by this audit, not a
  security issue. It sits on a write that needs an RPC anyway — settle the
  intended range while writing `create_my_profile()`.
