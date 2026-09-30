# SCN-11 — Implement SECURITY DEFINER RPC migrations for teacher-authoring writes

> Type: feature · Date: 2026-09-30

## Context

On the web app (`rubanwd/slay-city`), every teacher-facing write runs inside a
Next.js Server Action that begins with a TypeScript guard — `requireTeacher`,
`requireTopicAccess`, or a bare signed-in check. That guard executes on a server
the user cannot reach. Below it sits Row Level Security, which is the only
control a client talking to PostgREST directly has to pass.

The native app *is* such a client. It holds the public anon key and a user JWT
and calls PostgREST itself. It never runs the TypeScript guard. So whatever that
guard was contributing has to move into the database or it stops existing.

`SCN-6` produced the audit ([MIGRATIONS-NEEDED.md](../MIGRATIONS-NEEDED.md)) and
a per-operation reference (`docs/native-app/DIRECT-WRITES.md` upstream, mirrored
here as `.atlas/assets/direct-writes-4nzmc9.md`) enumerating **22 direct write
operations** — 21 table writes plus one Storage upload — across five action
files, each with its current enforcement, its required scope rule, and the
behaviour an RPC must preserve. This item is the implementation half of
`WP-2.3`: write the SQL.

Two facts shape the result. First, the audit's reassuring finding (F7): RLS
already refuses every teacher-side write for a `student` or `parent`, so most of
this work makes an existing boundary explicit rather than closing a hole.
Second, the one genuine hole (F1) is live on the web today: `user_stats` INSERT
is granted on all columns with a policy that checks *which row* and never *what
is in it*, so any user without a stats row can self-mint XP, coins, level and
streaks.

## What was done

Four migrations, four matching rollbacks and a runnable negative-test harness
were authored under **`docs/migrations/wp-2.3/`**, staged for the web
repository's `supabase/migrations/`. Per `AGENTS.md` ("Migrations belong
upstream") and the ticket's own acceptance criterion, **no `supabase/` directory
was created in this repository** — the same pattern `SCN-7` used for the OD-1
Edge Functions, except that here the SQL itself is written, not just described.

### The functions

Twelve caller-facing RPCs plus four helpers. Every one is `SECURITY DEFINER`
with `set search_path = public, pg_temp`, and every one is explicitly
`revoke all … from public` before `grant execute … to authenticated` —
PostgreSQL grants EXECUTE to PUBLIC by default, which would otherwise have
handed `anon` the entire authoring surface.

| Audit ops | Action replaced | Function |
| --- | --- | --- |
| W-01 | `createHomeworkTopic` | `create_homework_topic` → `uuid` |
| W-02 | `updateHomeworkTopic` | `update_homework_topic` |
| W-03 | `deleteHomeworkTopic` | `delete_homework_topic` |
| W-04 | `generateWordImage` → Storage upload | none — cannot run in Postgres, stays behind the OD-1 Edge Function |
| W-05 | `generateWordImage` → cache upsert | `cache_vocab_image` |
| W-06…W-09 | `publishVocabulary` | `publish_homework_vocabulary` |
| W-10…W-11 | `clearVocabulary` | `clear_homework_vocabulary` |
| W-12…W-15 | `publishGrammar` | `publish_homework_grammar` |
| W-16…W-17 | `clearGrammar` | `clear_homework_grammar` |
| W-18 | `postTopicMessage` | `post_topic_message` → `uuid` |
| W-19 | `markTopicRead` | `mark_topic_read` |
| W-20 | `deleteTopicMessage` | `delete_topic_message` |
| W-21 + W-22 | `createProfile` | `create_my_profile` |

Helpers: `can_author_group(uuid)`, `can_author_topic(uuid)`,
`assert_optional_http_url(text, text)`, `can_see_topic(uuid)`.

### The authorization boundary

`can_author_group` and `can_author_topic` carry the whole teacher surface:

```sql
is_admin() or (is_teacher() and <the group's teacher_id = auth.uid()>)
```

Three deliberate details. Both branches are spelled out because `is_teacher()`
is `role = 'teacher'` only and excludes admins, who are authorized today by the
separate `*_admin` policies. The predicate checks **ownership, not visibility** —
it does not reuse `homework_topics_select`, which also admits group members
(finding F6, where `requireTopicAccess` treats "the topic is visible" as "the
caller owns it"). And an admin is not restricted to the teacher they are viewing
as, because today they are not either (unknown U-7); narrowing that would be a
new rule, not parity.

`can_see_topic` is the Q&A counterpart and *is* the visibility predicate — the
same one `get_topic_messages()` already uses — because a group member posting
into their own group's thread is the intended behaviour.

### Behaviour before → after

Every **successful** flow is unchanged: same rows, same columns, same trimming,
same empty-string-to-`NULL`, same dropping of words missing `word`/`translation`
and points missing `title`/`explanation`, same 0-based `order_index`, and
`homework_vocab_completions` / `homework_grammar_completions` still survive a
publish or a clear. Section 7 of the test harness pins all of it.

Failure behaviour changes in four places, all deliberate:

- an UPDATE/DELETE that RLS filtered to zero rows used to return success — a
  non-owning teacher saw `Topic "…" updated.` and nothing changed (F4). Now
  `42501`.
- a publish that failed between its four statements left a live topic with no
  words (F3). One function is one transaction, so the failure mode becomes
  "nothing changed".
- `deleteTopicMessage` returned `{ ok: true }` for a message the caller may not
  delete. Now `42501`. The UI only renders the button on the caller's own
  messages, so no user-visible flow changes.
- an over-long task list was silently clamped to 20. Now `22023` — publishing a
  test the teacher never reviewed is worse than refusing.

Newly enforced in SQL rather than only in TypeScript: `note_link_url` /
`note_image_url` and `vocab_image_cache.image_url` must be http(s); a 2 000
character limit on `homework_topic_messages.body` as a CHECK; `created_at`,
`updated_at` and `last_read_at` now come from the database clock rather than the
Next.js server's, which also stops a client back-dating a Q&A message above
someone else's in a thread ordered by `created_at`.

### Closing F1

Migration 3/4 answers unknown U-5 with a trigger rather than a second RPC.
`profiles_create_user_stats` fires `AFTER INSERT ON public.profiles` and creates
the zeroed `user_stats` row for every new `student`/`parent`, with
`on conflict (profile_id) do nothing`. That means the parent sign-up path in
`features/auth/roleRouting.ts` (`ensureRoleProfile`) and the admin provisioning
RPCs (`admin_create_profile`, `admin_set_user_role`) all keep working untouched
once the INSERT grant goes — an RPC would have covered only the one call site we
know about. The same migration backfills the zeroed row for any profile that
already lacks one, so migration 4/4 cannot strand an account.

`create_my_profile` then inserts `profiles` and `user_stats` in one transaction
with `role` hard-coded to `'student'` (no role parameter exists to abuse) and
the counters fixed at `0 / 0 / 1 / 0 / 0` in SQL.

### Making the RPCs the only path

Migration 4/4 revokes `authenticated`'s INSERT/UPDATE/DELETE on the eight
audited tables. It is the one breaking file and must be applied only after a web
app that calls the RPCs is deployed; 1/4–3/4 are purely additive, so the current
web app is unaffected by them. **No RLS policy is created, dropped, altered or
disabled anywhere in the diff** (`WP-2.3` `AC6`) — a revoked grant and a policy
are independent controls, and keeping both means restoring a grant by mistake
cannot on its own open a hole.

## Changes by file

- `docs/migrations/wp-2.3/README.md` — (new) how the directory maps into the web
  repo, the apply order and why 4/4 is last, what the rollbacks deliberately do
  not undo, and how to run the harness.
- `docs/migrations/wp-2.3/20260930000001_teacher_authoring_rpcs.sql` — (new)
  `can_author_group`, `can_author_topic`, `assert_optional_http_url`,
  `create_homework_topic`, `update_homework_topic`, `delete_homework_topic`,
  `cache_vocab_image`, `publish_homework_vocabulary`,
  `clear_homework_vocabulary`, `publish_homework_grammar`,
  `clear_homework_grammar`. Covers W-01…W-03 and W-05…W-17.
- `docs/migrations/wp-2.3/20260930000002_homework_qa_rpcs.sql` — (new)
  `can_see_topic`, `post_topic_message`, `mark_topic_read`,
  `delete_topic_message`, and the `homework_topic_messages_body_length` CHECK
  (added `not valid` then validated, so a legacy offender names the validation
  step rather than rewriting history). Covers W-18…W-20.
- `docs/migrations/wp-2.3/20260930000003_onboarding_profile_rpc.sql` — (new)
  `create_user_stats_for_new_profile` + the `profiles_create_user_stats`
  trigger, `create_my_profile`, and the stranded-profile backfill. Covers W-21
  and W-22, and closes F1.
- `docs/migrations/wp-2.3/20260930000004_revoke_direct_write_grants.sql` — (new)
  revokes the write grants on `homework_topics`, `homework_vocab_words`,
  `homework_vocab_tasks`, `homework_grammar_points`, `homework_grammar_tasks`,
  `vocab_image_cache`, `homework_topic_messages`, `homework_topic_reads` and
  `user_stats`. `profiles` keeps its INSERT grant, which
  `profiles_prevent_role_insert_escalation` already makes safe.
- `docs/migrations/wp-2.3/down/20260930000001_teacher_authoring_rpcs_down.sql` —
  (new) drops the eleven functions in dependency order.
- `docs/migrations/wp-2.3/down/20260930000002_homework_qa_rpcs_down.sql` — (new)
  drops the four Q&A functions and the body CHECK.
- `docs/migrations/wp-2.3/down/20260930000003_onboarding_profile_rpc_down.sql` —
  (new) drops the trigger, its function and `create_my_profile`; deliberately
  keeps the backfilled rows.
- `docs/migrations/wp-2.3/down/20260930000004_revoke_direct_write_grants_down.sql`
  — (new) restores every grant exactly as the base migrations issued it, naming
  the source migration for each. This is the rollback to reach for first in an
  incident.
- `docs/migrations/wp-2.3/tests/negative-tests.sql` — (new) 61 assertions in one
  transaction that ends in `ROLLBACK`, covering `AC3` and `AC4`.
- `docs/UPSTREAM-PR-WP-2.3.md` — (new) the staged pull-request body for
  `rubanwd/slay-city`: what, why, the parity table, the authorization model, the
  `supabase.rpc(...)` mapping for every Server Action including the snake_case
  JSON payload shapes, what is out of scope, the open `profiles.age` decision,
  the test plan, the deployment and rollback order, and a pre-open checklist.
- `docs/changes/SCN-11.md` — (new) this file.

## Technical decisions

- **The SQL lives in `docs/migrations/wp-2.3/`, not `supabase/migrations/`.**
  The ticket forbids a `supabase/migrations/` change here and `AGENTS.md` says
  this repository will never have a `supabase/` directory. `docs/upstream/` was
  the first choice and had to be abandoned: `.gitignore` contains `upstream/`,
  which matches a directory of that name at any depth, so the files were
  silently untracked and would never have been committed.
- **Four migrations, not one.** Splitting the additive functions (1/4–3/4) from
  the breaking revokes (4/4) is what makes the deploy safe: the functions can
  land and be tested in production while the old write paths still work, and the
  point of no return is a single reviewable file. It also makes 3/4's trigger
  strictly precede 4/4's `revoke insert on user_stats`, without which parent
  sign-up would break.
- **A trigger for `user_stats`, not a provisioning RPC** (unknown U-5). An RPC
  would have required editing `ensureRoleProfile` and would cover only the call
  sites we know about; the trigger covers every present and future writer of
  `profiles`, and `on conflict do nothing` makes it compose with the two admin
  functions that already create the row.
- **The vocabulary test stays in TypeScript.** `buildVocabTest` in
  `features/homework/vocabulary.ts` is a pure seeded generator shared with the
  native app. Reimplementing it in SQL would create two sources of truth for the
  same test; instead the caller passes the finished tasks and the function
  validates the count and the `mission_task_type`.
- **Raise on an unauthorized write rather than preserve the silent no-op.** The
  audit left this open per-RPC. A guarded function that reports success for a
  write it refused is not a guard, and no *successful* flow changes — so all
  four RPC families raise `42501`.
- **No temp tables inside the publish functions.** The first draft staged the
  filtered word and point lists in `pg_temp` tables. In a `SECURITY DEFINER`
  function with `pg_temp` on the search path that is exactly the shadowing risk
  the ticket asks to eliminate, so both were rewritten as
  `jsonb_array_elements … with ordinality` with the filter applied twice — once
  to count, once to insert.
- **A denylist, not an allowlist, for the username character rule.** The
  TypeScript `checkUsername` allows Unicode letters, combining marks, digits and
  `_ - ' ’ .` via `\p{L}\p{M}\p{N}`, which Postgres regex cannot express;
  `[[:alnum:]]` does not reliably cover combining marks. Rejecting control
  characters and `@ / \ < > "` is a deliberate superset that cannot refuse a
  legitimate name written in a script we did not anticipate, while still
  blocking the abuse. Noted in the migration comment.
- **No table-level CHECK on `profiles.username`** (audit §6.4). A CHECK also
  applies to UPDATEs of existing rows, and `admin_create_profile` has never
  enforced a minimum or maximum length, so a legacy 1-character or 50-character
  username would start failing on unrelated updates such as
  `set_my_knowledge_level`. It needs a data audit first and is staged as a
  follow-up in the PR body.
- **`profiles.age` is passed straight through.** See *Limitations* — the range
  is now decided (`SCN-11-1`) and encoded in the column's CHECK, not in this
  function.

## Data, API and configuration

**No change to this repository's schema, dependencies or configuration.** No
`package.json`, TypeScript, lint or test-config file was touched.

For the web repository, when the staged migrations are applied there:

- **New functions** (all `SECURITY DEFINER`, `search_path` pinned, EXECUTE
  granted to `authenticated` only): `can_author_group(uuid)`,
  `can_author_topic(uuid)`, `assert_optional_http_url(text, text)`,
  `create_homework_topic(uuid, text, text, integer, text, text) → uuid`,
  `update_homework_topic(uuid, text, text, integer, text, text)`,
  `delete_homework_topic(uuid)`, `cache_vocab_image(text, text)`,
  `publish_homework_vocabulary(uuid, jsonb, jsonb)`,
  `clear_homework_vocabulary(uuid)`, `publish_homework_grammar(uuid, jsonb, jsonb)`,
  `clear_homework_grammar(uuid)`, `can_see_topic(uuid)`,
  `post_topic_message(uuid, text) → uuid`, `mark_topic_read(uuid)`,
  `delete_topic_message(uuid)`,
  `create_my_profile(text, smallint, knowledge_level)`,
  `create_user_stats_for_new_profile()` (trigger function).
- **New trigger**: `profiles_create_user_stats` AFTER INSERT ON
  `public.profiles`.
- **New constraint**: `homework_topic_messages_body_length` —
  `btrim(body) <> '' and char_length(body) <= 2000`.
- **Revoked grants** (migration 4/4): INSERT/UPDATE/DELETE on the five homework
  content tables, INSERT/UPDATE on `vocab_image_cache` and
  `homework_topic_reads`, INSERT/DELETE on `homework_topic_messages`, INSERT on
  `user_stats`. SELECT is untouched everywhere; no read path changes.
- **No policy, table, column or type is created, altered or dropped.** The one
  data change is the backfill of missing zeroed `user_stats` rows.
- **JSON payload contracts** for the three jsonb parameters, snake_case to match
  the columns: `p_words: { word, transcription, translation, image_url }[]`,
  `p_points: { title, explanation, example }[]`,
  `p_tasks: { task_type, content, order_index? }[]` — `order_index` defaults to
  the array position.

## How to verify

Everything below was run.

- **The migrations apply cleanly.** A throwaway `postgres:16-alpine` container
  was stood up, a 240-line stub of the upstream schema replayed by hand from
  `upstream/supabase/migrations` at `7612da5` (the roles, `auth.uid()`, the
  three enums, the twelve tables, `is_admin` / `is_teacher` /
  `is_group_member` / `available_knowledge_levels`, the role-escalation trigger,
  and all 45 policies and grants), then all four migrations applied with
  `ON_ERROR_STOP=1`. All four exited 0 with no errors.
- **The negative tests pass.** `tests/negative-tests.sql`, with real fixtures
  seeded (a teacher owning a group, a student who is a member of it, a second
  teacher owning nothing, two topics, an `auth.users` row with no profile):
  **61 `PASS`, 0 `FAIL`, 0 errors.** Coverage: a student rejected on all three
  topic RPCs and all four publish/clear RPCs *while being a group member who can
  read the topic* (the F6 case); a non-owning teacher rejected on all seven
  (`AC4`); the student's legitimate Q&A writes succeeding with `author_id` and
  `created_at` set by the function; all eight direct table writes failing on the
  missing grant; the forged `user_stats` insert failing; the owning teacher's
  full create → update → publish → republish → clear → delete flow producing
  exactly the rows the Server Actions produce, including the dropped incomplete
  word and the 0-based ordering; and three mechanical checks that no new
  function leaves EXECUTE open to PUBLIC, that `authenticated` can execute all
  sixteen, and that `search_path` is pinned on all of them.
- **F1 was reproduced, not assumed.** With migration 4/4 rolled back and the
  original grant restored, `insert into user_stats (…, xp, coins, level,
  current_streak, longest_streak) values (…, 999999, 999999, 99, 365, 365)` as
  the row's own owner **succeeded**. That is the live web behaviour the audit
  described, reproduced against the replayed policy and grant.
- **The rollbacks are clean.** Applied in reverse (`004 → 003 → 002 → 001`): all
  seventeen functions gone, the trigger gone, the body CHECK gone, and the
  `authenticated` grant set byte-identical to §5.2 of the audit.
- **The container and every temporary file were removed afterwards.** Nothing
  from the verification run is left on disk or in the working tree.
- **Repository checks.** `npm run lint`, `npm run type-check` and `npm test` all
  report a **pre-existing failure on `main`** that this item did not cause and
  did not touch: `packages/tokens/src/typography.ts` declares `fluidFontSize`
  twice (lines 34 and 178), which breaks the ESLint `import/export` rule, gives
  five `TS2300`/`TS2323`/`TS2393` errors, and makes
  `packages/tokens/src/typography.test.ts` fail to parse.
  `git diff HEAD -- packages/tokens/` is empty and the duplicate is present in
  `git show HEAD:packages/tokens/src/typography.ts`, so it arrived with the
  `main` merge. **185 of 185 tests that run, pass; 17 of 18 test files pass.**
  This item added only SQL and Markdown, so there is nothing here for the
  TypeScript toolchain to check.

To see it working yourself: copy `docs/migrations/wp-2.3/*.sql` into the web
repo's `supabase/migrations/`, fill in the seven fixture ids at the top of
`tests/negative-tests.sql`, and run it — every check prints `PASS`, and the
first failure aborts the transaction rather than being summarised away.

## Limitations and follow-ups

- **`profiles.age` — resolved on `SCN-11-1` (2026-09-30).** Decision: the
  onboarding form's range, 5–99, is canonical; the DB's 7–14 CHECK
  (`20260703000001_add_profile_age.sql`) was the side that had to move,
  because `age` is an optional, self-reported field that is written once at
  onboarding and never read back — no screen, RPC or age-gated rule anywhere
  in this app or upstream references it, so widening it has no downstream
  effect, while narrowing the form would reject a parent onboarding for their
  child or an adult learner. `create_my_profile` still passes `p_age` straight
  through unchanged; the column's own CHECK, now widened to `age is null or
  age between 5 and 99` by
  `docs/migrations/wp-2.3/20260930000005_widen_profile_age_range.sql`
  (rollback: `down/20260930000005_widen_profile_age_range_down.sql`), is the
  single source of truth for the range. No data backfill or cleanup is
  required: no existing row can violate the wider range if it satisfied the
  narrower one. Full reasoning in
  [`docs/changes/SCN-11-1.md`](SCN-11-1.md).
- **W-04, the Storage upload, is not an RPC and cannot be.** An object upload
  cannot run inside a Postgres function. It stays server-side behind the OD-1
  `generate-image` Edge Function ([EDGE-FUNCTIONS-PLAN.md](../EDGE-FUNCTIONS-PLAN.md),
  [UPSTREAM-PR-WP-5.6.md](../UPSTREAM-PR-WP-5.6.md)).
- **Finding F5, cross-teacher exposure, is untouched.** Any teacher can still
  overwrite any entry of the global `vocab_image_cache` and any object under
  `content/homework/`, including another teacher's images. Narrowing either is a
  policy change on a shared resource and a product decision, not part of
  replacing a direct write.
- **The TypeScript thin-caller pass is not done.** The ticket scopes this item to
  SQL ("Work in `supabase/migrations/` and related SQL helper files only in the
  web repo"), so the Server Actions still issue their direct writes. Every call
  is specified argument-for-argument in the PR body's mapping table, and
  `WP-2.3` `AC5` is not met until that lands. **Migration 4/4 must not be
  applied before it is.**
- **A table-level CHECK on `profiles.username`** (audit §6.4) and **a clean-up of
  any already-forged `user_stats` values** (unknown U-3) are both staged as
  follow-ups; the second needs a product call on what counts as implausible.
- **Q&A moderation by the owning teacher is preserved** because the database has
  always allowed it, though the UI has never offered it (unknown U-4). If the
  product decides against it, `tests/negative-tests.sql` §9c is the check that
  changes.
- **Everything is derived from the migration timeline at `7612da5`, not from the
  live database** (unknown U-1). There is one environment and it is production.
  The pre-open checklist in the PR body carries the `pg_policies` and
  `information_schema.role_table_grants` queries that confirm the live project
  matches, and the migration timestamps need renumbering to the day the PR is
  opened.
- **The repository's `main` is currently red** for an unrelated reason
  (`packages/tokens/src/typography.ts` duplicate export, see *How to verify*).
  Worth its own item; deliberately not fixed here.
