# Upstream PR — `WP-2.3` teacher-write RPC migrations

> **Status: additive half OPENED, not merged —
> [rubanwd/slay-city#115](https://github.com/rubanwd/slay-city/pull/115)**
> (2026-10-09, `SCN-61`). It carries migrations 1/4–3/4, the five thin
> callers, the regenerated `src/types/database.ts` entries and the 1/4–3/4
> rollbacks (upstream keeps those in `supabase/rollbacks/wp-2.3/`, outside
> `migrations/`, so `db push` never applies them). Migration 4/4 and
> `ci-database-tests.yml` are the second PR, still to open — see
> [Deployment](#deployment--this-must-ship-as-two-pull-requests). Two things
> changed on the way in: the optional RPC arguments are passed as
> `?? undefined` rather than `null` (the regenerated types make them
> `string | undefined`; every one is `default null` in SQL, so the database
> sees the same `NULL`), and the PR documents a one-to-two-minute deploy
> window in which onboarding and teacher writes can fail while Vercel and
> `migrate` land in either order.
>
> What follows is the staged description as it was written before opening.
> This is a staged pull-request description for
> [rubanwd/slay-city](https://github.com/rubanwd/slay-city), written by
> `SCN-11`. Unlike [UPSTREAM-PR-WP-5.6.md](UPSTREAM-PR-WP-5.6.md), the SQL it
> describes **is written** and lives in
> [`docs/migrations/wp-2.3/`](migrations/wp-2.3/README.md) — four migrations, four
> rollbacks and a negative-test harness, ready to copy into
> `supabase/migrations/` on a branch. `SCN-12` added the other half: the ported
> Server Actions themselves, staged in
> [`docs/migrations/wp-2.3/thin-callers/`](migrations/wp-2.3/thin-callers/README.md),
> ready to copy over the matching paths in the web repo's `src/`. `AC5` is met
> once both are on the same branch. `SCN-13` hardened the negative-test
> harness itself: `tests/fixtures.sql` replaces the old "fill in these ids by
> hand" block, an `anon`-role section was added alongside the existing
> student/non-owning-teacher/owning-teacher ones, and
> [`ci-database-tests.yml`](migrations/wp-2.3/ci-database-tests.yml) stages the
> job to merge into the web repo's CI so the suite runs on every push instead
> of only when someone remembers to run it by hand.
>
> `SCN-61` rebased the whole package onto upstream `02630a3` and re-derived the
> write inventory and the RLS evidence against it — see
> [Rebase onto `02630a3`](#rebase-onto-02630a3) for what changed, and
> [Evidence: what RLS does and does not stop](#evidence-what-rls-does-and-does-not-stop)
> for the per-write policy reading this PR description is supposed to carry. It
> also added the native-side wrappers (`packages/data/src/guardedWrites.ts`),
> which are deliberately unused until this merges.
>
> Audit that specified it: [MIGRATIONS-NEEDED.md](MIGRATIONS-NEEDED.md) and the
> operation-by-operation reference
> [`.atlas/assets/direct-writes-4nzmc9.md`](../.atlas/assets/direct-writes-4nzmc9.md)
> (`docs/native-app/DIRECT-WRITES.md` upstream).
> Target branch: `main` · Base re-read at `02630a3` (was `7612da5`).

## Why this file exists here

This repository has no `supabase/` directory and never will
([AGENTS.md](../AGENTS.md), "Migrations belong upstream"). The web repository
owns the migration timeline. `ROADMAP.md` lists `WP-2.3` as one of three work
packages whose output is a pull request against the live product rather than a
commit here.

So the SQL is authored here and lands there. Paste the sections below into the
PR body when it is opened, and replace this banner with a link to it.

---

## PR title

```
feat(security): route teacher, Q&A and onboarding writes through guarded RPCs (WP-2.3)
```

## PR body — paste from here

### What

Twenty-one direct table writes issued from Server Actions with the caller's own
JWT become twelve `SECURITY DEFINER` functions that re-check the caller's role
and the record's ownership in SQL, plus one migration that removes the table
grants those writes used.

| Migration | Adds |
| --- | --- |
| `…0001_teacher_authoring_rpcs.sql` | `can_author_group`, `can_author_topic`, `assert_optional_http_url`, `create_homework_topic`, `update_homework_topic`, `delete_homework_topic`, `cache_vocab_image`, `publish_homework_vocabulary`, `clear_homework_vocabulary`, `publish_homework_grammar`, `clear_homework_grammar` |
| `…0002_homework_qa_rpcs.sql` | `can_see_topic`, `post_topic_message`, `mark_topic_read`, `delete_topic_message`, and a CHECK on `homework_topic_messages.body` |
| `…0003_onboarding_profile_rpc.sql` | `create_my_profile`, the `profiles_create_user_stats` trigger, a backfill for profiles with no stats row |
| `…0004_revoke_direct_write_grants.sql` | nothing — revokes `authenticated`'s INSERT/UPDATE/DELETE on the eight audited tables |

Every write in the audit is covered. Line numbers are at `02630a3`, re-derived
for this PR rather than copied from the audit:

| Audit ops | Direct write at `02630a3` | Action replaced | Function |
| --- | --- | --- | --- |
| W-01 | `teacher/actions.ts:67` — `homework_topics` insert | `createHomeworkTopic` | `create_homework_topic` |
| W-02 | `teacher/actions.ts:105` — `homework_topics` update | `updateHomeworkTopic` | `update_homework_topic` |
| W-03 | `teacher/actions.ts:130` — `homework_topics` delete | `deleteHomeworkTopic` | `delete_homework_topic` |
| W-04 | `teacher/vocabularyActions.ts:143` — Storage upload to `content/homework/` | `generateWordImage` | **not an RPC** — see *Out of scope* |
| W-05 | `teacher/vocabularyActions.ts:195` — `vocab_image_cache` upsert | `generateWordImage` | `cache_vocab_image` |
| W-06 … W-09 | `teacher/vocabularyActions.ts:247,253,258,278` — `homework_vocab_words`/`_tasks` delete ×2 then insert ×2 | `publishVocabulary` | `publish_homework_vocabulary` |
| W-10 … W-11 | `teacher/vocabularyActions.ts:299,301` — `homework_vocab_words`/`_tasks` delete | `clearVocabulary` | `clear_homework_vocabulary` |
| W-12 … W-15 | `teacher/grammarActions.ts:133,139,144,157` — `homework_grammar_points`/`_tasks` delete ×2 then insert ×2 | `publishGrammar` | `publish_homework_grammar` |
| W-16 … W-17 | `teacher/grammarActions.ts:178,180` — `homework_grammar_points`/`_tasks` delete | `clearGrammar` | `clear_homework_grammar` |
| W-18 | `homework/qa/actions.ts:34` — `homework_topic_messages` insert | `postTopicMessage` | `post_topic_message` |
| W-19 | `homework/qa/actions.ts:56` — `homework_topic_reads` upsert | `markTopicRead` | `mark_topic_read` |
| W-20 | `homework/qa/actions.ts:68` — `homework_topic_messages` delete | `deleteTopicMessage` | `delete_topic_message` |
| W-21 + W-22 | `onboarding/actions.ts:61,76` — `profiles` then `user_stats` insert | `createProfile` | `create_my_profile` |

That is 22 writes across the five files, and the inventory is unchanged from
the audit: re-running the sweep at `02630a3` found the same 22 and no new ones
in those files. The only direct writes upstream has *added* since the audit are
the four on `placement_test_questions` in
`src/features/admin/placementActions.ts` (`02630a3`), and they are out of scope
here for the reason the audit scoped itself the way it did — they are
admin-only, the admin console stays web-only, and no native screen will ever
issue them.

### Why

SLAY CITY is getting a native iOS/Android build with the same teacher console.
Every write above is authorized today by two things: a TypeScript guard
(`requireTeacher`, `requireTopicAccess`, or a signed-in check) that exists only
on the Next.js server, and RLS. The native app talks to PostgREST directly with
the public anon key. It never runs the first one. Whatever the guard was adding
has to move into the database or it stops existing.

For most of the teacher surface the audit's answer was reassuring: RLS already
carries the boundary on its own, and a `student` JWT cannot perform a single
teacher-side write (finding F7). This PR is therefore mostly about making the
same boundary explicit and reviewable in one place, rather than closing holes.

Three real problems come with it:

- **Finding F1, live today.** `user_stats_insert_own` constrains *which row* a
  caller may insert and never *what is in it*. There is no CHECK, no INSERT
  trigger, no column-level grant. Any user who has a profile and no stats row
  can `POST /rest/v1/user_stats` with whatever `xp`, `coins`, `level` and
  streaks they like. That state is reachable on purpose (create the profile
  through PostgREST instead of the onboarding form) and by accident (the two
  onboarding inserts are not transactional, so a failure on the second leaves
  exactly that). It breaks the `AGENTS.md` rule that XP, coins and streaks only
  ever move server-side.
- **Finding F3.** `publishVocabulary`, `publishGrammar` and both clears run
  2–4 statements with no transaction. A failure after the deletes leaves a live
  topic empty for the group. On a browser that is rare; on a phone —
  backgrounded app, tunnel, carrier handover — it is routine. A function is
  atomic by nature, so the failure mode becomes "nothing changed".
- **Forgeable columns on the Q&A thread.** `hw_messages_insert` pins
  `author_id` but says nothing about `created_at`, and `homework_topic_reads`
  is not visibility-checked at all. Both columns were client-settable. The
  functions set them.

### Evidence: what RLS does and does not stop

Read against `supabase/migrations/` at `02630a3`, per write, answering one
question: **could a signed-in `student` perform this write directly through
PostgREST today, with no Next.js server involved?** This is the reading that
decides whether a function is closing a hole or making an existing boundary
explicit, and all of it is reproducible from the migration files named.

| Writes | Governing policy | Could a student do it? | Verdict |
| --- | --- | --- | --- |
| W-01 … W-03 (`homework_topics`) | `homework_topics_insert_teacher` / `_update_teacher` / `_delete_teacher` — `exists (select 1 from teacher_groups g where g.id = group_id and g.teacher_id = auth.uid())` (`20260720000009_homework.sql:127–154`) | **No.** A student never owns a `teacher_groups` row, so the predicate is false for every group. | RLS already carries it. Note the predicate checks *group ownership only, never the role* — a student who somehow became a `teacher_groups.teacher_id` would pass. `can_author_group` adds the `is_teacher()` conjunct. |
| W-06 … W-17 (`homework_vocab_words`/`_tasks`, `homework_grammar_points`/`_tasks`) | `*_insert_teacher` / `_update_teacher` / `_delete_teacher` — the same `homework_topics ⋈ teacher_groups` join on `topic_id` (`20260721000002_homework_vocabulary.sql:80–155`, `20260721000005_homework_grammar.sql:72–148`) | **No**, for the same reason. | RLS already carries it. |
| W-05 (`vocab_image_cache`) | `vocab_image_cache_insert` / `_update` — `is_teacher() or is_admin()` (`20260721000004_vocab_image_cache.sql:33–37`) | **No.** The role check is in the policy itself. | RLS already carries it — but teacher-*wide*, not teacher-scoped: any teacher can overwrite any other teacher's cache entry. Deliberately not narrowed here (finding F5, *Out of scope*). |
| W-18 (`homework_topic_messages` insert) | `hw_messages_insert` — `author_id = auth.uid() and exists (select 1 from homework_topics t where t.id = topic_id)` (`20260722000002_homework_qa.sql:39–45`) | **Yes, by design** — a group member asking a question is the point. | `author_id` is pinned; `created_at` is not, so it was client-settable. The function sets both from the database. |
| W-19 (`homework_topic_reads` upsert) | `hw_reads_insert_own` / `_update_own` — `user_id = auth.uid()` **and nothing else** (`20260722000003_homework_topic_reads.sql:23–27`) | **Yes, and further than intended.** `topic_id` is unconstrained: any signed-in user can create a read marker for any topic, including topics in groups they have no connection to. | Real gap. `mark_topic_read` adds the `can_see_topic` check and takes `last_read_at` from the database clock. |
| W-20 (`homework_topic_messages` delete) | `hw_messages_delete` — `author_id = auth.uid() or is_admin() or <owning teacher>` (`20260722000002_homework_qa.sql:47–57`) | **Own messages only.** | RLS already carries it. **This closes U-4:** the owning-teacher branch is not incidental — the migration's own comment at line 46 describes it as "light moderation without a separate role check", so it is intended and is preserved. |
| W-21 (`profiles` insert) | `profiles_insert_own` (`20260701000001_initial_schema.sql:279`) plus the role guard in `20260919000001_profiles_insert_role_guard.sql` | **Yes** — their own row, which is correct. | RLS already carries it. |
| W-22 (`user_stats` insert) | `user_stats_insert_own` — `with check (auth.uid() = profile_id)` (`20260701000001_initial_schema.sql:296`) | **Yes, with arbitrary contents.** | **Live hole (finding F1).** See below. |

W-22 is the one that matters, and it is worth stating precisely because it is a
production bug independent of the native app. `user_stats_insert_own`
constrains *which row* a caller may insert and never *what is in it*. There is
no CHECK on the table, no INSERT trigger, and no column-level grant —
`20260701000001_initial_schema.sql` grants `select, insert` on `user_stats` to
`authenticated` wholesale (line 384). So any user who has a profile and no stats row can
`POST /rest/v1/user_stats` with whatever `xp`, `coins`, `level` and streaks
they like, and that state is reachable both on purpose (create the profile
through PostgREST instead of the onboarding form) and by accident (W-21 and
W-22 are not transactional, so a failure on the second leaves exactly that).
It breaks the `AGENTS.md` rule that XP, coins and streaks only ever move
server-side. There is also no `user_stats` UPDATE policy at all, so the forged
value is then immutable from the client — which is why the fix is a guarded
INSERT path plus a trigger, not a tightened UPDATE.

`tests/negative-tests.sql` §5a is this read turned into an executable check,
and it is the one section worth running against **production before** the
migration, where it is expected to *succeed*. That success is the finding.

### Behaviour: what is identical and what changes

Every **successful** flow is unchanged, which is the main thing to check in
review. Same rows, same columns, same trimming, same empty-string-to-`NULL`,
same dropping of incomplete words and points, same 0-based `order_index`, same
preservation of `homework_vocab_completions` and `homework_grammar_completions`
across a publish or clear. `tests/negative-tests.sql` §7 pins all of that.

Failure behaviour changes in four places, all deliberate:

| Before | After | Why |
| --- | --- | --- |
| An UPDATE/DELETE that RLS filtered to zero rows returned success. A non-owning teacher saw `Topic "…" updated.` and nothing changed (finding F4). | `42501`. | A guarded RPC that reports success for a write it refused is not a guard. |
| A partial publish could leave a topic with no words (finding F3). | Nothing changes. | One transaction. |
| `deleteTopicMessage` returned `{ ok: true }` for a message the caller may not delete. | `42501`. | Same reason as F4. The UI only offers the button on the caller's own messages, so no user-visible flow changes. |
| An over-long task list was silently clamped to 20. | `22023`. | Publishing a test the teacher did not review is worse than refusing. |

Also new, and intentional: `note_link_url` / `note_image_url` must be http(s)
in SQL (it was a TypeScript-only rule), `vocab_image_cache.image_url` must be
http(s), `homework_topic_messages.body` has its 2 000-character limit as a
CHECK, and `updated_at` / `created_at` / `last_read_at` now come from the
database clock instead of the Next.js server's. `homework_topics.updated_at` is
still not touched on update — no trigger maintains it and changing that would
be a new behaviour on a column the UI reads.

### Authorization model

`can_author_group(uuid)` and `can_author_topic(uuid)` are the whole boundary
for the teacher surface:

```sql
is_admin() or (is_teacher() and <the group's teacher_id = auth.uid()>)
```

Three details a reviewer should check:

1. **Both branches are spelled out.** `is_teacher()` is `role = 'teacher'` and
   excludes admins, who are authorized today by the separate `*_admin` policies
   from `20260721000001_admin_view_as_teacher.sql`.
2. **Ownership, not visibility.** The functions deliberately do not reuse the
   `homework_topics_select` predicate, which also admits group members
   (finding F6 — `requireTopicAccess` treats "the topic is visible" as "the
   caller owns it", which is not the same thing).
3. **An admin is not restricted to the teacher they are viewing as.** That is
   parity: today an admin's writes run with the admin's JWT and `is_admin()`
   matches any topic. Narrowing it would be a new rule (unknown U-7).

`can_see_topic(uuid)` is the Q&A counterpart and *is* the visibility predicate
— the same one `get_topic_messages()` and `get_unread_topics()` already use —
because a group member posting into their own group's thread is the point.

Every function is `SECURITY DEFINER` with `set search_path = public, pg_temp`,
matching the 48 of 49 existing functions. Every one is also explicitly
`revoke all … from public` before `grant execute … to authenticated`: Postgres
grants EXECUTE to PUBLIC by default, which would have handed `anon` the whole
authoring surface. `tests/negative-tests.sql` §5c–§5e assert all three
properties mechanically, so a future function added without them fails a test
rather than shipping.

**No RLS policy is created, dropped, altered or disabled anywhere in this diff**
(`AC6`). A revoked grant and a policy are independent controls; keeping both
means restoring a grant by mistake cannot on its own open a hole.

### Thin callers — the TypeScript side

**Written on `SCN-12`, staged in
[`docs/migrations/wp-2.3/thin-callers/`](migrations/wp-2.3/thin-callers/README.md).**
The Server Actions keep their exported names, parameters and return types and
become `supabase.rpc(...)` calls. The mapping, argument for argument:

| Action | Call |
| --- | --- |
| `createHomeworkTopic` | `rpc("create_homework_topic", { p_group_id, p_title, p_description, p_order_index, p_note_link_url, p_note_image_url })` → `uuid` |
| `updateHomeworkTopic` | `rpc("update_homework_topic", { p_topic_id, p_title, p_description, p_order_index, p_note_link_url, p_note_image_url })` |
| `deleteHomeworkTopic` | `rpc("delete_homework_topic", { p_topic_id })` |
| `generateWordImage` (cache write) | `rpc("cache_vocab_image", { p_word_key, p_image_url })` — stays non-fatal: log and still return the image |
| `publishVocabulary` | `rpc("publish_homework_vocabulary", { p_topic_id, p_words, p_tasks })` |
| `clearVocabulary` | `rpc("clear_homework_vocabulary", { p_topic_id })` |
| `publishGrammar` | `rpc("publish_homework_grammar", { p_topic_id, p_points, p_tasks })` |
| `clearGrammar` | `rpc("clear_homework_grammar", { p_topic_id })` |
| `postTopicMessage` | `rpc("post_topic_message", { p_topic_id, p_body })` → `uuid` |
| `markTopicRead` | `rpc("mark_topic_read", { p_topic_id })` |
| `deleteTopicMessage` | `rpc("delete_topic_message", { p_message_id })` |
| `createProfile` | `rpc("create_my_profile", { p_username, p_age, p_level })` |

`p_words`, `p_points` and `p_tasks` are JSON arrays in **snake_case**, matching
the columns:

```ts
p_words:  { word, transcription, translation, image_url }[]
p_points: { title, explanation, example }[]
p_tasks:  { task_type, content, order_index? }[]   // order_index defaults to the array position
```

The vocabulary test is still built in TypeScript. `buildVocabTest` in
`features/homework/vocabulary.ts` is a pure, seeded generator shared with the
native app; reimplementing it in SQL would be two sources of truth for the same
test. The caller passes the finished tasks and the function validates the count
and the task type.

The actions keep their own validation and their own error strings — the
messages users see do not change. The functions raise the same strings with
`22023` / `42501` / `28000` so a client that never runs the TypeScript still
gets something sensible, and `create_my_profile` lets the unique violations
propagate as `23505` so the existing "That username is already taken." mapping
keeps working byte for byte.

Three call sites need no change at all: `ensureRoleProfile` in
`features/auth/roleRouting.ts` keeps its `profiles` insert (the trigger now
creates the `user_stats` row it used to insert itself — this is the answer to
unknown U-5), and `admin_create_profile` / `admin_set_user_role` already use
`on conflict (profile_id) do nothing`, so the trigger composes with both.

### The native side — nothing for this repository to merge

`rubanwd/slay-city-native` carries a twelfth-for-twelve set of typed wrappers
in `packages/data/src/guardedWrites.ts` (`SCN-61`), behind the same injected
`SupabaseClient` every other function in that package takes. **They are
deliberately unused, and will not work until this PR merges** — the functions
do not exist in any database yet, so a call returns `PGRST202`. They are
written now so the wire contract is reviewed next to the SQL it calls rather
than months later, and because the argument shapes are the half the type
checker cannot catch on its own: `p_words`, `p_points` and `p_tasks` cross into
`jsonb` and are read back with `->>`, so their keys are column names, not a
naming preference. `guardedWrites.test.ts` pins each call's exact function name
and argument object for that reason.

One thing a reviewer of *this* PR may want to know: the wrappers cannot be
typed off the generated `Database` type until this merges and upstream
regenerates `src/types/database.ts`, because that file is a tracked copy in the
native repository and hand-editing it would register as upstream drift. They
narrow a single untyped `rpc()` call against a locally declared contract
instead, and that indirection is marked for deletion the day the regenerated
types land.

### Out of scope, on purpose

- **W-04, the Storage upload.** An object upload cannot run inside a Postgres
  function. It stays on the server behind the OD-1 `generate-image` Edge
  Function ([EDGE-FUNCTIONS-PLAN.md](EDGE-FUNCTIONS-PLAN.md),
  [UPSTREAM-PR-WP-5.6.md](UPSTREAM-PR-WP-5.6.md)).
- **Finding F5, cross-teacher exposure.** Any teacher can overwrite any entry
  of the global `vocab_image_cache` and any object under `content/homework/`,
  including another teacher's images. Narrowing either is a policy change on a
  shared resource and a product decision, not part of replacing a direct write.
- **A CHECK on `profiles.username`** (audit §6.4). The rules are enforced in
  `create_my_profile`, which is the write this package owns. A table-level
  constraint also applies to UPDATEs of existing rows, and
  `admin_create_profile` has never enforced a minimum or maximum length — so it
  needs a data audit and a clean-up pass first. Staged as a follow-up.
- **Cleaning up already-forged `user_stats` values** (unknown U-3). The
  migration backfills *missing* rows and never touches an existing one. What
  counts as an implausible `xp` or `coins` is a product call.

### `profiles.age` (finding F2, unknown U-6) — closed upstream, nothing to review here

This package used to carry a fifth migration for it. It no longer does, and
that is the only thing a reviewer needs from this section.

The finding: `20260703000001_add_profile_age.sql` declared
`age smallint check (age is null or age between 7 and 14)` while the onboarding
form validated and displayed a wider range, so the ages in between passed
validation and failed the insert with a raw `23514`. `SCN-11-1` decided the
form's range was canonical and staged a widening migration to match.

Since then `main` fixed it independently, in
`20261001000001_widen_profile_age_range.sql`, choosing **5–90** and extracting
`MIN_AGE`/`MAX_AGE` into `features/onboarding/age.ts` so the two cannot drift
again. That is the same decision with a different upper bound, and it is now
the established one — so the staged migration was dropped rather than rebased.
Re-applying it would have re-widened the column to 99 and put it back out of
step with `age.ts`, which is precisely the bug F2 described.

`create_my_profile` is unaffected: it passes `p_age` straight through to the
column's own CHECK rather than re-validating the range, which was the audit
§4.6 requirement and which is what lets upstream own the bounds alone.
`tests/negative-tests.sql` §11 was repointed to assert 5–90 and now guards
upstream's choice against a future narrowing.

### Rebase onto `02630a3`

The package was written against `7612da5`. `SCN-61` re-fetched upstream, found
it nine commits ahead, and rebased. Four things changed; nothing else did.

1. **Timestamps renumbered `20260930…` → `20261008…`** (1/4 through 4/4 and
   their four `down/` counterparts). This is not cosmetic: upstream merged
   `20261001000001`, `20261003000001` and `20261004000001` in the meantime, so
   the old numbers now sorted *before* three migrations already applied to
   production. Renumber again if this PR sits unopened past another merge.
2. **The fifth migration was dropped** — see the section above.
3. **`tests/negative-tests.sql` §11 repointed** from the dropped 5/5 (5–99) to
   upstream's `20261001000001_widen_profile_age_range.sql` (5–90). Its `SKIP`
   guard now reads the constraint for `90`, and the boundary cases became
   "90 accepted, 91 rejected".
4. **The staged `onboarding/actions.ts` thin caller was rebased** onto the
   `parseAge` helper upstream extracted into `features/onboarding/age.ts`. The
   staged copy still carried its own inline `MIN_AGE`/`MAX_AGE` constants and
   range check; copying it over `main` would have silently reverted that
   refactor.

Re-verified unchanged by the rebase: the 22-write inventory (table above), all
twelve function signatures, every RLS predicate the authorization model depends
on, and the exported surface of the other four thin callers —
`vocabularyActions.ts`, `grammarActions.ts`, `teacher/actions.ts` and
`homework/qa/actions.ts` each still export exactly the names the staged copies
export, including `copyVocabularyFromTopic` and `copyGrammarFromTopic`.
Upstream's own CI at `02630a3` still has no database test step (`ci` and
`migrate` jobs only), so `ci-database-tests.yml` still applies as written.

### Test plan

- [ ] `tests/negative-tests.sql` run in full against a branch database with 1/4–4/4 applied: every check prints `PASS`, nothing prints `FAIL`. As of `SCN-13` this needs no manual fixture setup — it includes `tests/fixtures.sql` itself — and the same run is wired into CI via `ci-database-tests.yml`, so this box is really "confirm the new CI job is green," not a manual run. §11 needs no file from this package and prints `SKIP 11` only against a timeline older than upstream's own `20261001000001_widen_profile_age_range.sql`.
- [ ] §5a run against **production before** the migration, to confirm finding F1 is real and not an artefact of the migration timeline (unknown U-1): the forged `user_stats` insert is expected to *succeed* there.
- [ ] `select count(*) from public.homework_topic_messages where btrim(body) = '' or char_length(body) > 2000;` returns `0` before applying 2/4 — the `validate constraint` step will fail loudly otherwise.
- [ ] `select p.id from public.profiles p left join public.user_stats s on s.profile_id = p.id where s.id is null and p.role in ('student','parent');` recorded before and after 3/4, so the backfill's effect is a number and not a hope.
- [ ] `npm run lint`, `npm run type-check`, `npm test` in the web app.
- [ ] Manual, as a teacher: create a topic with and without note URLs, edit it, reorder it, publish 20 words with images, regenerate the test, clear it, publish grammar, clear it, delete the topic. Every message identical to `main`.
- [ ] Manual, as a **second** teacher: the same actions against the first teacher's topic. Each now fails with an error instead of reporting success and doing nothing.
- [ ] Manual, as an admin viewing-as a teacher: the full authoring flow still works (the `is_admin()` branch).
- [ ] Manual, as a student: open a topic, post a question, delete it, see the teacher's reply, and confirm the unread badge clears.
- [ ] Manual: complete onboarding on a fresh account and confirm `user_stats` is `0 / 0 / 1 / 0`; then sign up as a parent and confirm the parent dashboard still finds its stats row.

### Deployment — this must ship as **two** pull requests

The staged plan below assumes someone applies migrations by hand, in order,
with a verification pass in between. `.github/workflows/ci.yml` does not work
that way: the `migrate` job runs `supabase db push` on **every push to `main`**,
so merging a single PR containing all four migrations applies all four at once,
and 4/4 — the revoke — lands at the same moment as, or before, Vercel finishes
deploying the thin callers that depend on it. In that window teacher authoring,
the Q&A thread and onboarding are all broken. Step 3 ("verify in production
before the point of no return") is unreachable if 4/4 rides along with 1/4.

So split it:

**PR #1 — additive.** Migrations 1/4, 2/4, 3/4 plus all five thin callers.
Every migration here adds functions, one CHECK and one trigger; none drops a
policy or revokes a grant, so the old direct writes keep working throughout and
the deploy order does not matter. Safe for `migrate` to auto-apply.

**PR #2 — the lockdown.** Migration 4/4 alone, opened only after the manual
list above has been verified against production on PR #1's deploy. This is the
point of no return for the old write paths; until it merges, a client can still
bypass every function here. U-1 (the live policy/grant diff) gates *this* PR,
not PR #1.

Then, on PR #2's deploy:

1. Re-run `tests/negative-tests.sql` §4 and §5 against production.
2. Re-run §5a specifically and confirm the forged `user_stats` insert now
   **fails** — before the migration it succeeds, and that success is finding F1.

The alternative — one PR, with `migrate` temporarily disabled and all four
applied by hand — is worse: it needs a CI change and leaves `main` in a state
where a later push applies migrations nobody re-checked.

Rollback: `down/…_revoke_direct_write_grants_down.sql` first, which restores
every grant exactly as the base migrations created it and puts the direct
writes back without touching a function. Then revert the web app. Then the
other three `down/` files if the functions are to go too. No RLS policy was
changed, so the boundary returns to precisely what it was.

### Downstream

Unblocks all of P8 in
[rubanwd/slay-city-native](https://github.com/rubanwd/slay-city-native) —
`WP-5.2` (homework topic authoring), `WP-5.3` (`VocabularyManager`), `WP-5.4`
(`GrammarManager`) and `WP-5.5` (Q&A messaging) all write through these
functions rather than reimplementing a guard the phone cannot be trusted to
run.

## PR body — end

---

## Checklist before opening this

- [x] `profiles.age` answered (F2 / U-6) — **closed upstream**, not by this package: `20261001000001_widen_profile_age_range.sql` widened the column to 5–90 and `features/onboarding/age.ts` holds the matching constants. The staged 5/5 was dropped on `SCN-61`.
- [x] Thin callers written (`AC5`) — `SCN-12`, staged in `docs/migrations/wp-2.3/thin-callers/`; `onboarding/actions.ts` rebased onto upstream's `parseAge` on `SCN-61`. Still not run against the web repo's own `vitest` (see that directory's `README.md`).
- [x] Negative tests hardened and CI-wired (`SCN-13`) — `tests/fixtures.sql` replaces manual id fill-in, an `anon`-role section (§0) was added, and `ci-database-tests.yml` stages the job for `.github/workflows/ci.yml`; not yet merged into the web repo's own CI (see `docs/migrations/wp-2.3/README.md#ci`)
- [x] Q&A moderation by the owning teacher confirmed as intended (U-4) — **resolved on `SCN-61` from the schema itself.** `20260722000002_homework_qa.sql:45–46` documents the `hw_messages_delete` policy as "light moderation without a separate role check", so the owning-teacher branch is deliberate, not incidental. It is preserved; `tests/negative-tests.sql` §9c is the check that changes if a maintainer ever reverses that.
- [x] Migration timestamps renumbered — `20261008…` on `SCN-61`, which also moved them back *after* upstream's `20261001`–`20261004`. Renumber again if another upstream migration merges before this PR opens.
- [x] Upstream re-fetched and the base commit re-read — `SCN-61`: `7612da5` → `02630a3`, nine commits. See [Rebase onto `02630a3`](#rebase-onto-02630a3).
- [x] Native-side wrappers written — `SCN-61`: `packages/data/src/guardedWrites.ts` in `rubanwd/slay-city-native`, unused until this merges.
- [ ] **Live database compared against the migration timeline (U-1).** Needs production database access, which no agent in the native repository has. The reading in [Evidence](#evidence-what-rls-does-and-does-not-stop) is from `supabase/migrations/` at `02630a3` and is only as good as the assumption that production matches the replayed timeline. Confirm with: `select * from pg_policies where tablename in ('homework_topics','homework_vocab_words','homework_vocab_tasks','homework_grammar_points','homework_grammar_tasks','vocab_image_cache','homework_topic_messages','homework_topic_reads','profiles','user_stats');` and `select grantee, privilege_type from information_schema.role_table_grants where table_name = 'user_stats';`
- [x] **Split into PR #1 (additive) and PR #2 (the revoke)** — PR #1 opened as [rubanwd/slay-city#115](https://github.com/rubanwd/slay-city/pull/115) on `SCN-61`. — see [Deployment](#deployment--this-must-ship-as-two-pull-requests). Found on `SCN-61`: upstream's `migrate` job auto-applies migrations on every push to `main`, so a single PR cannot stage 4/4 behind a production verification pass.
- [ ] **Forged `user_stats` values audited (U-3) and a clean-up decided.** A product call on what counts as an implausible `xp`/`coins`, and it needs the production data to make. The migration backfills only *missing* rows and never touches an existing one, so opening this PR does not depend on the answer — but `MIGRATIONS-NEEDED.md` §10 step 1 asks for finding F1 to be decided explicitly rather than merged silently, because it is live today.
