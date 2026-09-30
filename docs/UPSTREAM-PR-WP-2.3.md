# Upstream PR placeholder — `WP-2.3` teacher-write RPC migrations

> **Status: NOT OPENED.** This is a staged pull-request description for
> [rubanwd/slay-city](https://github.com/rubanwd/slay-city), written by
> `SCN-11`. Unlike [UPSTREAM-PR-WP-5.6.md](UPSTREAM-PR-WP-5.6.md), the SQL it
> describes **is written** and lives in
> [`docs/migrations/wp-2.3/`](migrations/wp-2.3/README.md) — five migrations, five
> rollbacks and a negative-test harness, ready to copy into
> `supabase/migrations/` on a branch.
>
> Audit that specified it: [MIGRATIONS-NEEDED.md](MIGRATIONS-NEEDED.md) and the
> operation-by-operation reference
> [`.atlas/assets/direct-writes-4nzmc9.md`](../.atlas/assets/direct-writes-4nzmc9.md)
> (`docs/native-app/DIRECT-WRITES.md` upstream).
> Target branch: `main` · Base read at `7612da5`.

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
| `…0005_widen_profile_age_range.sql` | nothing — widens the `profiles.age` CHECK from 7–14 to 5–99 (`SCN-11-1`) |

Every write in the audit is covered:

| Audit ops | Action replaced | Function |
| --- | --- | --- |
| W-01 | `createHomeworkTopic` | `create_homework_topic` |
| W-02 | `updateHomeworkTopic` | `update_homework_topic` |
| W-03 | `deleteHomeworkTopic` | `delete_homework_topic` |
| W-04 | `generateWordImage` → Storage upload | **not an RPC** — see *Out of scope* |
| W-05 | `generateWordImage` → cache upsert | `cache_vocab_image` |
| W-06 … W-09 | `publishVocabulary` | `publish_homework_vocabulary` |
| W-10 … W-11 | `clearVocabulary` | `clear_homework_vocabulary` |
| W-12 … W-15 | `publishGrammar` | `publish_homework_grammar` |
| W-16 … W-17 | `clearGrammar` | `clear_homework_grammar` |
| W-18 | `postTopicMessage` | `post_topic_message` |
| W-19 | `markTopicRead` | `mark_topic_read` |
| W-20 | `deleteTopicMessage` | `delete_topic_message` |
| W-21 + W-22 | `createProfile` | `create_my_profile` |

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

### Decision — `profiles.age` (finding F2, unknown U-6) — resolved on `SCN-11-1`

`20260703000001_add_profile_age.sql` declares
`age smallint check (age is null or age between 7 and 14)`. The onboarding
action accepts 5–99 (commit `32247f5`, #91) and shows that range to the user.
Ages 5, 6 and 15–99 therefore pass validation and fail the insert with a raw
`23514`.

`create_my_profile` **does not pick a side**: it passes `p_age` through and
lets the column's CHECK decide, which is exactly today's behaviour. The audit's
§4.6 is explicit that the RPC must not silently choose one, and doing so would
make either the column or the form quietly wrong.

**Decision: the form's range (5–99) is canonical; the column widens to match.**
`age` is an optional, self-reported field collected once at onboarding and
never read back — no screen, RPC, mission gate or knowledge-level check in
either this repository or upstream references `profiles.age` outside the
onboarding form, its Server Action and the generated `types/database.ts` row
type. Narrowing the form to 7–14 would reject a parent completing onboarding
for their child, or an adult learner, for a value that gates nothing today.
Widening the column is the change with no downstream risk, and is now written
as `…0005_widen_profile_age_range.sql`:

```sql
alter table public.profiles
  drop constraint profiles_age_check,
  add constraint profiles_age_check check (age is null or age between 5 and 99);
```

No existing row can violate the wider range if it satisfied the old one, so no
backfill or cleanup is needed before applying it.

### Test plan

- [ ] `tests/negative-tests.sql` run in full against a branch database with 1/4–5/5 applied: every check prints `PASS`, nothing prints `FAIL`. (With 5/5 held back, §11 prints `SKIP 11` and the rest still passes.)
- [ ] §5a run against **production before** the migration, to confirm finding F1 is real and not an artefact of the migration timeline (unknown U-1): the forged `user_stats` insert is expected to *succeed* there.
- [ ] `select count(*) from public.homework_topic_messages where btrim(body) = '' or char_length(body) > 2000;` returns `0` before applying 2/4 — the `validate constraint` step will fail loudly otherwise.
- [ ] `select p.id from public.profiles p left join public.user_stats s on s.profile_id = p.id where s.id is null and p.role in ('student','parent');` recorded before and after 3/4, so the backfill's effect is a number and not a hope.
- [ ] `npm run lint`, `npm run type-check`, `npm test` in the web app.
- [ ] Manual, as a teacher: create a topic with and without note URLs, edit it, reorder it, publish 20 words with images, regenerate the test, clear it, publish grammar, clear it, delete the topic. Every message identical to `main`.
- [ ] Manual, as a **second** teacher: the same actions against the first teacher's topic. Each now fails with an error instead of reporting success and doing nothing.
- [ ] Manual, as an admin viewing-as a teacher: the full authoring flow still works (the `is_admin()` branch).
- [ ] Manual, as a student: open a topic, post a question, delete it, see the teacher's reply, and confirm the unread badge clears.
- [ ] Manual: complete onboarding on a fresh account and confirm `user_stats` is `0 / 0 / 1 / 0`; then sign up as a parent and confirm the parent dashboard still finds its stats row.

### Deployment

1. Apply 1/4, 2/4, 3/4. Nothing breaks — they are additive and nothing calls them yet.
2. Merge and deploy the web app with the thin callers.
3. Verify the manual list above in production.
4. Apply 4/4. **This is the point of no return for the old write paths**; until it runs, a client can still bypass every function here.
5. Re-run `tests/negative-tests.sql` §4 and §5 against production.

Rollback: `down/…_revoke_direct_write_grants_down.sql` first, which restores
every grant exactly as the base migrations created it and puts the direct
writes back without touching a function. Then revert the web app. Then the
other three `down/` files if the functions are to go too. No RLS policy was
changed, so the boundary returns to precisely what it was.

### Downstream

Unblocks all of M5 in
[rubanwd/slay-city-native](https://github.com/rubanwd/slay-city-native) —
`WP-5.2` (homework topic authoring), `WP-5.3` (`VocabularyManager`), `WP-5.4`
(`GrammarManager`) and `WP-5.5` (Q&A messaging) all write through these
functions rather than reimplementing a guard the phone cannot be trusted to
run.

## PR body — end

---

## Checklist before opening this

- [x] `profiles.age` answered (F2 / U-6) — resolved on `SCN-11-1`: widen to 5–99, `…0005_widen_profile_age_range.sql`
- [ ] Live database compared against the migration timeline (U-1): `select * from pg_policies where tablename in ('homework_topics','homework_vocab_words','homework_vocab_tasks','homework_grammar_points','homework_grammar_tasks','vocab_image_cache','homework_topic_messages','homework_topic_reads','profiles','user_stats');` and `select grantee, privilege_type from information_schema.role_table_grants where table_name = 'user_stats';`
- [ ] Q&A moderation by the owning teacher confirmed as intended (U-4) — it is preserved here, and `tests/negative-tests.sql` §9c is the check that changes if it is not
- [ ] Forged `user_stats` values audited (U-3) and a clean-up decided
- [ ] Migration timestamps renumbered to the day the PR is opened
- [ ] Upstream re-fetched and the base commit re-read; `7612da5` will be stale by then
