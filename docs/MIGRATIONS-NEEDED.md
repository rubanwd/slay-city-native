# Migrations needed — teacher tools RLS audit

> `SCN-6` · analysis only, **no migrations are written by this document**.
> Audited against `rubanwd/slay-city` @ `7612da5` (2026-09-19), 67 migrations
> through `20260919000001_profiles_insert_role_guard.sql`.
> Feeds `WP-2.3` (docs/WORK-PACKAGES.md) and `R1` (docs/RISKS.md).

## 1. Why this audit exists

On the web, every write in these five files runs inside a Next.js Server Action
behind `requireTeacher()` — a check on a server the user does not control. React
Native has no Server Actions. Whatever these files do will be done by the device,
holding the anon key and a user JWT, straight against PostgREST.

So the only question that matters is: **if the `requireTeacher()` line were
deleted, would the database still refuse the write?**

Everything below answers that write by write.

## 2. Verdict

| | |
| --- | --- |
| Table writes audited | **21** (plus 1 Storage object write) |
| Already fully authorised by RLS — **no RPC needed** | **19** |
| **Need a new `SECURITY DEFINER` RPC** | **2** (`onboarding/actions.ts`) |
| 🔴 SECURITY RISK — live on the web today | **2** (§6.1, §6.4) |
| 🟠 SECURITY RISK — introduced by the mobile port | **2** (§6.2, §6.3) |
| 🟡 Hardening / integrity notes | **4** (§7) |

The teacher authoring surface — all 16 writes across `vocabularyActions.ts`,
`grammarActions.ts` and `teacher/actions.ts` — turned out to be **safe without
any new RPC**. Those policies never checked `role = 'teacher'` in the first
place; they check *group ownership*, which is strictly stronger. `requireTeacher()`
was always defence-in-depth and a friendly error message, exactly as its own
docstring claims.

The hole is somewhere else, and it is not a mobile problem:
**`onboarding/actions.ts` can be used to mint XP and coins on the web right
now** (§6.1). Per `WP-2.3`'s instruction ("if this package finds an existing hole
in the *web* app, stop and report it"), that is reported here rather than worked
around.

### A note on the "14 / 9 / 3 / 3 / 2" counts

Those figures (from `docs/MIGRATION-MAP.md` §2 Category B and
`docs/ARCHITECTURE.md` §3) count `.from()` **call sites**, not writes — they
include reads. The real numbers:

| File | `.from()` call sites | Actual write operations |
| --- | --- | --- |
| `teacher/vocabularyActions.ts` | 14 | 7 table + 1 Storage |
| `teacher/grammarActions.ts` | 9 | 6 table |
| `teacher/actions.ts` | 3 | 3 table |
| `homework/qa/actions.ts` | 3 | 3 table |
| `onboarding/actions.ts` | 2 | 2 table |
| **Total** | **31** | **21 table + 1 Storage** |

The docs are not wrong about scope, just about the label. Worth fixing when
those files are next touched so nobody hunts for 14 vocabulary writes.

## 3. The write inventory

`RLS coverage` names the policy actually relied on. `RPC?` answers only the
authorisation question — "could a non-teacher, or a teacher from another group,
perform this write?" Secondary concerns (input validation, atomicity) are in the
`Notes` column and expanded in §6–§7.

### 3.1 `src/features/teacher/vocabularyActions.ts`

| # | Action | Table | Op | Current RLS coverage | RPC? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| V1 | `generateWordImage` | `storage.objects` (`content/homework/…`) | insert | `content_insert_teacher_homework` — `bucket_id='content' AND foldername[1]='homework' AND is_teacher()`; `content_insert_admin` for admins | **No** | Path is `homework/<uuid>.<ext>`, `upsert:false`. Folder-wide, not teacher-scoped → §7.1. Write disappears on mobile: the upload moves into the `generate-image` Edge Function (`WP-5.6`) |
| V2 | `generateWordImage` | `vocab_image_cache` | upsert | `vocab_image_cache_insert` + `vocab_image_cache_update` — both `is_teacher() OR is_admin()` | **No** | `onConflict:"word_key"` needs both policies; both exist. Global library, any teacher may overwrite any word → §7.1 |
| V3 | `publishVocabulary` | `homework_vocab_words` | delete | `homework_vocab_words_delete_teacher` — topic→group ownership | **No** | |
| V4 | `publishVocabulary` | `homework_vocab_tasks` | delete | `homework_vocab_tasks_delete_teacher` — topic→group ownership | **No** | |
| V5 | `publishVocabulary` | `homework_vocab_words` | insert | `homework_vocab_words_insert_teacher` — topic→group ownership | **No** | Four separate round-trips, no transaction → §7.4 |
| V6 | `publishVocabulary` | `homework_vocab_tasks` | insert | `homework_vocab_tasks_insert_teacher` — topic→group ownership | **No** | Same → §7.4 |
| V7 | `clearVocabulary` | `homework_vocab_words` | delete | `homework_vocab_words_delete_teacher` | **No** | |
| V8 | `clearVocabulary` | `homework_vocab_tasks` | delete | `homework_vocab_tasks_delete_teacher` | **No** | |

`generateVocabularyDraft`, `copyVocabularyFromTopic` write nothing — but
`generateVocabularyDraft` and `generateWordImage` spend real money and are
gated **only** by `requireTeacher()` → 🟠 §6.2.

### 3.2 `src/features/teacher/grammarActions.ts`

| # | Action | Table | Op | Current RLS coverage | RPC? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | `publishGrammar` | `homework_grammar_points` | delete | `homework_grammar_points_delete_teacher` — topic→group ownership | **No** | |
| G2 | `publishGrammar` | `homework_grammar_tasks` | delete | `homework_grammar_tasks_delete_teacher` — topic→group ownership | **No** | |
| G3 | `publishGrammar` | `homework_grammar_points` | insert | `homework_grammar_points_insert_teacher` | **No** | → §7.4 |
| G4 | `publishGrammar` | `homework_grammar_tasks` | insert | `homework_grammar_tasks_insert_teacher` | **No** | → §7.4 |
| G5 | `clearGrammar` | `homework_grammar_points` | delete | `homework_grammar_points_delete_teacher` | **No** | |
| G6 | `clearGrammar` | `homework_grammar_tasks` | delete | `homework_grammar_tasks_delete_teacher` | **No** | |

`generateGrammarDraft` writes nothing; same paid-generation exposure → 🟠 §6.2.

### 3.3 `src/features/teacher/actions.ts`

| # | Action | Table | Op | Current RLS coverage | RPC? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | `createHomeworkTopic` | `homework_topics` | insert | `homework_topics_insert_teacher` — `EXISTS (teacher_groups g WHERE g.id = group_id AND g.teacher_id = auth.uid())`; `homework_topics_insert_admin` for admins | **No** | `order_index` / URL validation is action-only → 🟡 §7.2 |
| T2 | `updateHomeworkTopic` | `homework_topics` | update | `homework_topics_update_teacher` — same predicate in both `USING` and `WITH CHECK` | **No** | Does not touch `group_id`, so a topic cannot be moved between groups. Same validation gap → 🟡 §7.2 |
| T3 | `deleteHomeworkTopic` | `homework_topics` | delete | `homework_topics_delete_teacher` — same predicate | **No** | Cascades to words/tasks/points/messages/reads/completions — correct, the caller owns all of it |

### 3.4 `src/features/homework/qa/actions.ts`

| # | Action | Table | Op | Current RLS coverage | RPC? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Q1 | `postTopicMessage` | `homework_topic_messages` | insert | `hw_messages_insert` — `author_id = auth.uid() AND EXISTS (homework_topics t WHERE t.id = topic_id)` | **No** | Deliberately open to students — it is a shared thread. Impersonation impossible. `body` length unbounded in SQL → 🟠 §6.3 |
| Q2 | `markTopicRead` | `homework_topic_reads` | upsert | `hw_reads_insert_own` + `hw_reads_update_own` — both `user_id = auth.uid()` | **No** | `onConflict:"topic_id,user_id"` needs both; both exist |
| Q3 | `deleteTopicMessage` | `homework_topic_messages` | delete | `hw_messages_delete` — `author_id = auth.uid() OR is_admin() OR owning teacher` | **No** | This action already performs **no** application-level check and relies purely on RLS. It is the model the other four files should be read against |

`MIGRATION-MAP.md` lists the risk here as *"posting messages as another
teacher"*. That risk does not exist: `hw_messages_insert` pins `author_id` to
`auth.uid()`, and the teacher badge in the UI comes from
`get_topic_messages()`, which reads `profiles.role` server-side. The real
exposure is message size, not authorship.

### 3.5 `src/features/onboarding/actions.ts`

| # | Action | Table | Op | Current RLS coverage | RPC? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| O1 | `createProfile` | `profiles` | insert | `profiles_insert_own` (`auth.uid() = id`) + `prevent_role_insert_escalation` BEFORE INSERT trigger | **YES — recommended** | Role escalation **is** closed (`20260919000001`). `username`, `age`, `level` are not validated in SQL → 🔴 §6.4, 🟡 §7.3 |
| O2 | `createProfile` | `user_stats` | insert | `user_stats_insert_own` — `auth.uid() = profile_id` **only**. No column predicate, no `CHECK`, no trigger | **YES — required** | 🔴 **SECURITY RISK** — self-minting XP/coins. §6.1 |

## 4. Why the teacher writes are safe — the ownership chain

Every teacher-authoring policy in §3.1–§3.3 reduces to the same predicate:

```sql
EXISTS (
  SELECT 1 FROM public.homework_topics t
  JOIN public.teacher_groups g ON g.id = t.group_id
  WHERE t.id = topic_id AND g.teacher_id = auth.uid()
)
```

Three properties make this hold without any role check:

1. **`teacher_groups` rows are admin-only.** `teacher_groups_insert_admin` /
   `_update_admin` are both `public.is_admin()`. A user cannot create a group,
   cannot assign themselves as its teacher, and cannot re-point an existing
   group at themselves. `teacher_id` is whatever an admin chose.
2. **The subquery is itself under RLS.** Policy expressions are evaluated with
   the caller's privileges, and `authenticated` owns neither table, so
   `teacher_groups_select_own_or_admin` (`teacher_id = auth.uid() OR is_admin()`)
   applies *inside* the `EXISTS`. The predicate is therefore checked twice over.
   None of these policies routes through a `SECURITY DEFINER` bypass — the two
   bypasses that exist (`is_group_member`, `teaches_student`) are used only on
   the read side.
3. **Ownership is narrower than the role.** `role = 'teacher'` would authorise a
   teacher to write to *any* group. Ownership authorises them only for their
   own. Replacing these policies with an `is_teacher()` RPC would be a
   **downgrade**, and `WP-2.3` `AC6` forbids weakening policies.

A `student`-role JWT has no `teacher_groups` row, so the predicate is false for
every topic in the database. `requireTeacher()` can be deleted from these three
files with no change in what the database permits.

Two consequences of this design worth knowing:

- The guarantee is **group ownership, not role**. If an admin ever sets
  `teacher_groups.teacher_id` to a student's profile id, that student gains full
  authoring rights on that group without any role change. That is an admin
  action, not self-service escalation, so it is not a hole — but it means "only
  teachers can author" is enforced by admin discipline, not by SQL.
- The admin **"View as Teacher" cookie is not part of the policy.** The
  `*_admin` policies are plain `is_admin()`. On the web, `requireTeacher()`
  additionally requires an active view-as cookie; on mobile that cookie does not
  exist, so an admin can author for any group with no impersonation state. Since
  admins already sit at the top of the role system this changes no trust
  boundary — but the mobile teacher console should not assume a view-as session
  is required for a write to land.

## 5. RPC inventory

### 5.1 Already in Supabase and reusable

None of the 21 writes currently routes through an RPC — every one is a direct
`.from()` call. The functions relevant to this audit, all `SECURITY DEFINER`
with `search_path` pinned:

| Function | Role in this audit |
| --- | --- |
| `is_admin()` | Used by every `*_admin` policy and by both role-escalation triggers |
| `is_teacher()` | Gate for `vocab_image_cache` and the `content/homework/` Storage policies — the only two places where role, not ownership, is the check |
| `is_group_member(uuid)` | Read-side bypass — lets a student see a topic, hence post Q&A into it |
| `teaches_student(uuid)` | Read-side bypass for teacher dashboards |
| `my_groups()` | Student's group list without direct `teacher_group_members` access |
| `get_topic_messages(uuid)` | Q&A thread with author usernames + teacher flag; re-checks topic visibility |
| `get_unread_topics()` | Unread badges; same visibility check |
| `set_my_knowledge_level(knowledge_level)` | **Precedent for §6.4** — level changes were moved into an RPC precisely so "is this level available?" is enforced in SQL, not the UI |
| `available_knowledge_levels()` | The rule `set_my_knowledge_level` enforces |
| `complete_homework_vocab(uuid)` / `complete_homework_grammar(uuid)` | Student-side completion + XP; already the correct shape |
| `prevent_role_escalation()` / `prevent_role_insert_escalation()` | Triggers that make O1's role column safe |
| `promote_teacher(text)` / `revoke_teacher(uuid)` | Admin-only role management; `revoke_teacher` deletes the teacher's groups, so ownership dies with the role |
| `admin_create_profile(…)` / `admin_set_user_role(uuid,text)` | Admin provisioning — both already insert a **zeroed** `user_stats` row, which is what O2 fails to guarantee |

### 5.2 Must be written

| Proposed function | Replaces | Why |
| --- | --- | --- |
| `create_my_profile(p_username text, p_age smallint, p_level knowledge_level)` | O1 + O2 | Required. Makes the `user_stats` row unforgeable (§6.1), validates username/age/level in SQL (§6.4, §7.3), and makes the two inserts atomic so a failure cannot leave a profile with no stats row. Model it on the provisioning block already inside `admin_create_profile` |

That is the complete list of RPCs this audit finds **necessary**. Two further
functions are worth writing for robustness, not authorisation, and should be
argued on their own merits rather than folded into a security migration:

| Proposed function | Replaces | Why |
| --- | --- | --- |
| `publish_topic_vocabulary(p_topic_id uuid, p_words jsonb, p_tasks jsonb)` | V3–V6 | Optional. Four unsynchronised round-trips become one transaction — see §7.4 |
| `publish_topic_grammar(p_topic_id uuid, p_points jsonb, p_tasks jsonb)` | G1–G4 | Optional. Same |

## 6. 🔴🟠 Security risks

### 6.1 🔴 `user_stats` INSERT is column-blind — XP and coins can be self-minted

**Live on the web today. Not a mobile regression.**

`user_stats_insert_own` is the entire authorisation for O2:

```sql
create policy "user_stats_insert_own" on public.user_stats
  for insert with check (auth.uid() = profile_id);
grant select, insert on public.user_stats to authenticated;
```

It constrains *which row*, never *what is in it*. There is no `CHECK`, no
`BEFORE INSERT` trigger, and no column-level grant. A freshly registered user,
before onboarding has run, can call PostgREST directly with the public anon key
and their own JWT:

```
POST /rest/v1/user_stats
{ "profile_id": "<own uid>", "xp": 999999, "coins": 999999,
  "level": 99, "current_streak": 999, "longest_streak": 999 }
```

`createProfile` then hits `23505` on its own insert and surfaces the error, but
the row is already there and the account is usable.

Impact:

- `purchase_wardrobe_item()` spends `user_stats.coins` and only checks
  `coins >= cost` and `level >= unlock_level` — both attacker-controlled. The
  entire wardrobe economy is bypassed.
- `level` gates wardrobe unlocks and level progression.
- `xp` / streaks feed parent and teacher dashboards, so the numbers a paying
  parent sees become unreliable.

It is one shot per account — `profile_id` is `unique`, there is no UPDATE
policy, and `authenticated` has no DELETE grant on `user_stats` — but accounts
are free to create, and one shot is all it takes.

The comment above the policy says *"XP, coins, streaks … can never be modified
from the browser — only via service-role Edge Functions."* That is true of
UPDATE and false of INSERT, which is the same blind spot
`20260919000001_profiles_insert_role_guard.sql` fixed for `profiles.role`. This
is the identical bug one table over.

**Fix (do not write it in this item):** move O1+O2 into `create_my_profile()`,
insert `user_stats` with server-chosen zeros, and revoke `INSERT` on
`public.user_stats` from `authenticated`. Check first that no other caller
inserts `user_stats` from a user JWT — `admin_create_profile` and
`admin_set_user_role` both do it inside `SECURITY DEFINER` bodies and are
unaffected by the revoke.

**This meets the `WP-2.3` "stop and report" condition. It needs a decision from
the maintainer before mobile work continues.**

### 6.2 🟠 Paid AI generation loses its only gate on mobile

`generateVocabularyDraft`, `generateWordImage` and `generateGrammarDraft` write
nothing, so no RLS policy protects them. Their sole authorisation is
`requireTopicAccess()` → `requireTeacher()`.

The topic check does not help: `homework_topics_select` grants
`is_group_member(group_id)`, so **every student in the group can already see
every one of their teacher's topics**. `requireTeacher()` is the only thing
standing between a student and an OpenRouter bill.

When these move to the `draft-vocabulary` / `draft-grammar` / `generate-image`
Edge Functions (`WP-5.6`, `MIGRATION-MAP.md` Category C), the function **must
re-check the caller's role and topic ownership in SQL before calling
OpenRouter**. Failing the Storage or cache write afterwards is not a mitigation
— the money is spent at the API call.

Requirements for `WP-5.6`:

- Verify the JWT and re-run the `is_teacher() OR is_admin()` + topic-ownership
  predicate inside the function, before any outbound request.
- Rate-limit per teacher. Nothing in the current design bounds how many images
  one authenticated teacher can generate.

### 6.3 🟠 `homework_topic_messages.body` is unbounded in SQL

`MAX_BODY_LENGTH = 2000` lives only in `postTopicMessage`. The column is bare
`text not null`. On mobile, a hostile client posts a multi-megabyte message into
any group thread it can see. The thread is realtime-published
(`alter publication supabase_realtime add table public.homework_topic_messages`),
so every other member of the group receives it, and `get_topic_messages()`
returns it on every load.

The project already has the right pattern one table over —
`feedback_reports.message text not null check (char_length(btrim(message)) between 1 and 4000)`.

**Fix:** a `CHECK (char_length(btrim(body)) between 1 and 2000)` constraint. No
RPC needed; RLS authorisation for Q1 is already correct. Consider a rate limit
too — nothing currently bounds message frequency.

### 6.4 🔴 `profiles.username` has no SQL validation

`checkUsername()` (≤32 characters, letter-containing, trimmed) runs only in the
action. The column is `username text not null unique` with no `CHECK`. As with
§6.1, a direct `POST /rest/v1/profiles` with the user's own id sets any username
the attacker likes — arbitrary length, control characters, markup.

That username is rendered to other users: in `get_topic_messages()` bubbles, in
teacher group rosters, in parent dashboards. It is the one attacker-controlled
string in this audit that crosses a user boundary.

Lower severity than §6.1 (no economic effect, and the app escapes on render),
but it is live on the web today and fixed by the same `create_my_profile()` RPC
plus a `CHECK` constraint on the column.

## 7. 🟡 Hardening and integrity notes

Not authorisation failures — nothing here lets a non-teacher write. Recorded so
they are decided deliberately rather than inherited.

### 7.1 Teacher-wide, not teacher-scoped: `vocab_image_cache` and `content/homework/`

Both are gated on `is_teacher()` alone, with no ownership dimension:

- `vocab_image_cache` is a **global** library keyed on the normalised word.
  Any teacher may `upsert` any `word_key` with any `image_url` string. Setting
  `cat` to an arbitrary URL poisons every other teacher's future "cat" card
  across every group — and `publishVocabulary` copies the URL onto
  `homework_vocab_words`, so it reaches students.
- `content_update_teacher_homework` / `content_delete_teacher_homework` are
  folder-wide. Any teacher may overwrite or delete **any** object under
  `content/homework/`, including images another teacher generated that are
  referenced by other groups' published words.

Both are documented as deliberate ("same trust level the admin write policies on
this bucket already use"). Teachers are admin-promoted, so the blast radius is
bounded by admin vetting rather than by SQL. If mobile widens who holds a
teacher role, revisit: the cache write is a natural candidate for a
`cache_word_image(p_word_key text, p_image_url text)` RPC that refuses to
overwrite an existing key.

### 7.2 Topic field validation is action-only

`parseNonNegativeInt` and `parseOptionalUrl` (http/https only) exist solely in
`teacher/actions.ts`. `homework_topics.order_index` is `integer not null default 0`
and `note_link_url` / `note_image_url` are bare `text`. Off-server, a teacher can
store a negative `order_index` or a `note_link_url` with any scheme — and that
link is rendered to students on the topic intro screen.

Scope is the teacher's own group, and the reader-side should be treating these as
untrusted anyway, so this is hardening rather than a hole. Cheapest fix is
`CHECK` constraints (`order_index >= 0`, `note_link_url ~ '^https?://'`), which
keeps T1–T3 as plain writes. Whatever is decided, the mobile client must not be
the only place the rule lives.

### 7.3 `profiles.age` — the DB is stricter than the action, and they disagree

`20260703000001_add_profile_age.sql` declares
`age smallint check (age is null or age between 7 and 14)`. No later migration
relaxes it. `onboarding/actions.ts` accepts `MIN_AGE = 5` to `MAX_AGE = 99` and
shows that range to the user.

So a user entering 5, 6, or anything from 15 up passes the action's validation
and then hits `23514`, surfaced as a raw Postgres constraint message. This is a
**pre-existing web bug**, not a security issue, but it sits on one of the two
writes that needs an RPC anyway — settle the intended range while writing
`create_my_profile()` rather than encoding the disagreement into it.

### 7.4 `publishVocabulary` / `publishGrammar` are not atomic

Each publish is four independent PostgREST round-trips (delete words, delete
tasks, insert words, insert tasks) with no transaction. A failure between them
leaves the topic in a state no code produces: words with no test, or nothing at
all. On a browser that is rare. On a phone — backgrounded app, tunnel, carrier
handover — it is routine, and the topic is live to students the moment the first
delete lands.

`publish_topic_vocabulary()` / `publish_topic_grammar()` (§5.2) fix this by
doing the whole replace in one statement batch. Note this is a **robustness**
argument, not a security one: keep it out of the security migration so the
`WP-2.3` diff stays reviewable as an authorisation change.

## 8. What this audit does not cover

- **`teacher/viewAsActions.ts`** — the sixth Category B file (1 `.from()` call
  site). Out of scope for `SCN-6`; it is cookie-based and becomes in-memory
  state on mobile, which is a separate design question.
- **Read paths.** Only writes were audited. `homework_topics_select` granting
  students visibility of every topic in their group is load-bearing for §6.2 and
  was verified for that purpose, but the read surface as a whole was not.
- **Live-database verification.** Every statement here is read from the
  migration timeline at `7612da5`. Policies added through the Supabase dashboard
  rather than a migration would not appear. Before acting on §6.1, confirm
  against the live project that no out-of-band `CHECK` or trigger exists on
  `user_stats`.
- **Storage bucket policies beyond `content`.** Only the `content` bucket is
  touched by these five files.

## 9. Negative tests to write in `WP-2.3` (`AC3`, `AC4`)

Direct API calls with a raw JWT, not UI flows. Each must fail with `42501` (or
the constraint's own code) rather than succeed:

1. `student` JWT → insert/delete on `homework_vocab_words`, `homework_vocab_tasks`,
   `homework_grammar_points`, `homework_grammar_tasks` for a topic in a group
   they belong to. Covers V3–V8, G1–G6 — the group-membership case is the
   strongest, because the student *can* read the topic.
2. `student` JWT → insert/update/delete on `homework_topics` for their own
   group. Covers T1–T3.
3. `student` JWT → insert/update on `vocab_image_cache`; insert into
   `content/homework/`. Covers V1–V2.
4. `teacher` JWT → every write in 1 and 2 against a group owned by a **different**
   teacher (`AC4`).
5. `student` JWT → insert into `homework_topic_messages` with `author_id` set to
   the teacher's uid (must fail), and for a topic in a group they are **not** a
   member of (must fail). Covers Q1.
6. `student` JWT → upsert `homework_topic_reads` with another user's `user_id`.
   Covers Q2.
7. **Regression for §6.1:** fresh account → `POST /rest/v1/user_stats` with
   non-zero `xp` / `coins` / `level`. Must fail once the fix lands. Also assert
   `user_stats` INSERT is no longer granted to `authenticated`.
8. **Regression for §6.4 and §6.3:** `POST /rest/v1/profiles` with an
   over-length username; `POST /rest/v1/homework_topic_messages` with a
   `body` over 2 000 characters. Both must fail.

## 10. Recommended order of work

1. **Decide on §6.1** with the maintainer. It is live, it is economic, and it is
   independent of the mobile port. Everything else can wait; this should not.
2. `create_my_profile()` migration + revoke `INSERT` on `user_stats` from
   `authenticated` + `CHECK` constraints on `profiles.username` and
   `homework_topic_messages.body`, with the negative tests from §9.7–§9.8.
   Upstream PR against `rubanwd/slay-city`.
3. Negative tests §9.1–§9.6 proving the 19 existing-RLS verdicts. These add no
   migrations and can be written immediately — they are what turns §4 from an
   argument into evidence.
4. `WP-5.6` Edge Functions, carrying the §6.2 role check and rate limit as
   acceptance criteria rather than as an afterthought.
5. Hardening §7.1–§7.2 and the atomic publish RPCs §7.4, each on its own merits.

Only step 2 is required before the mobile teacher console can ship. The teacher
authoring surface itself needs **no new RPC** — which is the useful finding of
this audit, and the opposite of what `R1` assumed.
