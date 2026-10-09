-- SLAY CITY — WP-2.3 (1/4): SECURITY DEFINER RPCs for teacher homework authoring
--
-- Replaces the direct PostgREST writes in `features/teacher/actions.ts`,
-- `features/teacher/vocabularyActions.ts` and `features/teacher/grammarActions.ts`
-- with functions that re-check the caller's role and the topic's ownership in
-- SQL. Today those writes are authorized by RLS plus a TypeScript guard
-- (`requireTeacher` / `requireTopicAccess`) that only exists on the Next.js
-- server; the native app calls PostgREST directly and never runs it. The rules
-- have to live in the database.
--
-- Covers operations W-01 … W-03 and W-05 … W-17 of
-- `docs/native-app/DIRECT-WRITES.md` (mirrored in the native repo as
-- `.atlas/assets/direct-writes-4nzmc9.md`). W-04 is the Storage upload, which
-- cannot run inside a Postgres function — it stays on the server behind the
-- OD-1 Edge Function.
--
-- This migration is purely additive: no policy is dropped, no grant is revoked,
-- and every existing direct write keeps working. The lockdown (revoking the
-- table grants that let a client bypass these functions) is migration 4/4, so
-- it can be applied only after the web app has been deployed against the RPCs.
-- Rollback for this file is `down/20261008000001_teacher_authoring_rpcs_down.sql`.
--
-- Authorization model, unchanged from the policies it mirrors:
--
--   * a `teacher` may only touch topics in groups where
--     `teacher_groups.teacher_id = auth.uid()`;
--   * an `admin` may touch any topic — that is what the `*_admin` policies
--     added in 20260721000001_admin_view_as_teacher.sql already allow, and
--     what "View as Teacher" relies on. Restricting an admin to the
--     impersonated teacher's groups would be a new rule, not parity (U-7).
--   * every other role, `student` included, is rejected with `42501`.
--
-- Failure behaviour deliberately differs from the direct writes in one way: an
-- UPDATE or DELETE that RLS filtered to zero rows currently returns success
-- (finding F4 — a non-owning teacher is told "Topic updated." and nothing
-- changed). These functions raise `42501` instead. No successful flow changes.

-- =========================================================================
-- Helpers
--
-- Two predicates, so every function below states its scope check once and the
-- reviewer can check the boundary in one place. SECURITY DEFINER and `stable`
-- for the same reason `is_admin()` is: they read `profiles` and
-- `teacher_groups`, which a caller cannot necessarily see in full.
--
-- `is_teacher()` is role = 'teacher' only and excludes admins, so both
-- branches are spelled out — matching how the `*_teacher` and `*_admin`
-- policies stack today.
-- =========================================================================

create or replace function public.can_author_group(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    auth.uid() is not null
    and (
      public.is_admin()
      or (
        public.is_teacher()
        and exists (
          select 1
          from public.teacher_groups g
          where g.id = p_group_id and g.teacher_id = auth.uid()
        )
      )
    );
$$;

revoke all on function public.can_author_group(uuid) from public;
grant execute on function public.can_author_group(uuid) to authenticated;

comment on function public.can_author_group(uuid) is
  'WP-2.3: may the caller author homework in this teacher group? Admin, or the owning teacher. Ownership, never visibility.';

create or replace function public.can_author_topic(p_topic_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    auth.uid() is not null
    and (
      public.is_admin()
      or (
        public.is_teacher()
        and exists (
          select 1
          from public.homework_topics t
          join public.teacher_groups g on g.id = t.group_id
          where t.id = p_topic_id and g.teacher_id = auth.uid()
        )
      )
    );
$$;

revoke all on function public.can_author_topic(uuid) from public;
grant execute on function public.can_author_topic(uuid) to authenticated;

comment on function public.can_author_topic(uuid) is
  'WP-2.3: may the caller author content on this homework topic? Deliberately NOT the homework_topics_select predicate, which also admits group members (finding F6).';

-- Validation shared by create_homework_topic and update_homework_topic. The
-- URL rule was TypeScript-only (`parseOptionalUrl`); an RPC has to repeat it or
-- the native client becomes the only place it lives.
create or replace function public.assert_optional_http_url(p_url text, p_message text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if v_url is null then
    return null;
  end if;

  if v_url !~* '^https?://[^[:space:]]+$' then
    raise exception '%', p_message using errcode = '22023';
  end if;

  return v_url;
end;
$$;

revoke all on function public.assert_optional_http_url(text, text) from public;
grant execute on function public.assert_optional_http_url(text, text) to authenticated;

comment on function public.assert_optional_http_url(text, text) is
  'WP-2.3: empty -> NULL, an http(s) URL -> itself, anything else -> 22023 with the caller''s message. Mirrors parseOptionalUrl in features/teacher/actions.ts.';

-- =========================================================================
-- W-01 · createHomeworkTopic (features/teacher/actions.ts)
--
-- Returns the new topic id, which the direct insert did not — the action
-- builds its own `Topic "<title>" added.` message and does not need it, but the
-- native client wants to navigate straight to the topic it just created.
-- `note_text` is not accepted, matching the action: the column exists but no
-- caller writes it.
-- =========================================================================

create or replace function public.create_homework_topic(
  p_group_id uuid,
  p_title text,
  p_description text default null,
  p_order_index integer default 0,
  p_note_link_url text default null,
  p_note_image_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_order_index integer := coalesce(p_order_index, 0);
  v_topic_id uuid;
begin
  if p_group_id is null then
    raise exception 'A group is required.' using errcode = '22023';
  end if;

  if not public.can_author_group(p_group_id) then
    raise exception 'Only teachers can manage homework.' using errcode = '42501';
  end if;

  if v_title = '' then
    raise exception 'Title is required.' using errcode = '22023';
  end if;

  if v_order_index < 0 then
    raise exception 'Order must be a non-negative whole number.' using errcode = '22023';
  end if;

  insert into public.homework_topics (
    group_id, title, description, order_index, note_link_url, note_image_url
  )
  values (
    p_group_id,
    v_title,
    v_description,
    v_order_index,
    public.assert_optional_http_url(p_note_link_url, 'Link must be a valid http(s) URL.'),
    public.assert_optional_http_url(p_note_image_url, 'Image URL must be valid.')
  )
  returning id into v_topic_id;

  return v_topic_id;
end;
$$;

revoke all on function public.create_homework_topic(uuid, text, text, integer, text, text) from public;
grant execute on function public.create_homework_topic(uuid, text, text, integer, text, text) to authenticated;

comment on function public.create_homework_topic(uuid, text, text, integer, text, text) is
  'WP-2.3 W-01: replaces the direct insert in createHomeworkTopic (features/teacher/actions.ts).';

-- =========================================================================
-- W-02 · updateHomeworkTopic (features/teacher/actions.ts)
--
-- `group_id` is intentionally not a parameter. Through PostgREST an owning
-- teacher can currently move a topic into another of their groups by sending
-- it; the action never does, and this function makes that impossible.
--
-- `updated_at` is left alone, as today: no trigger maintains it on this table
-- and touching it here would be a new behaviour on a column the UI reads.
-- =========================================================================

create or replace function public.update_homework_topic(
  p_topic_id uuid,
  p_title text,
  p_description text default null,
  p_order_index integer default 0,
  p_note_link_url text default null,
  p_note_image_url text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_order_index integer := coalesce(p_order_index, 0);
begin
  if p_topic_id is null then
    raise exception 'A topic is required.' using errcode = '22023';
  end if;

  if not public.can_author_topic(p_topic_id) then
    raise exception 'Topic not found or not yours to edit.' using errcode = '42501';
  end if;

  if v_title = '' then
    raise exception 'Title is required.' using errcode = '22023';
  end if;

  if v_order_index < 0 then
    raise exception 'Order must be a non-negative whole number.' using errcode = '22023';
  end if;

  update public.homework_topics
  set
    title = v_title,
    description = v_description,
    order_index = v_order_index,
    note_link_url = public.assert_optional_http_url(p_note_link_url, 'Link must be a valid http(s) URL.'),
    note_image_url = public.assert_optional_http_url(p_note_image_url, 'Image URL must be valid.')
  where id = p_topic_id;
end;
$$;

revoke all on function public.update_homework_topic(uuid, text, text, integer, text, text) from public;
grant execute on function public.update_homework_topic(uuid, text, text, integer, text, text) to authenticated;

comment on function public.update_homework_topic(uuid, text, text, integer, text, text) is
  'WP-2.3 W-02: replaces the direct update in updateHomeworkTopic. Raises 42501 instead of silently matching zero rows (finding F4). group_id is not accepted.';

-- =========================================================================
-- W-03 · deleteHomeworkTopic (features/teacher/actions.ts)
--
-- One statement, so the eight ON DELETE CASCADE children go with it exactly as
-- they do today: vocab words/tasks/completions, grammar points/tasks/
-- completions, topic messages and read markers. Students' completion records
-- for the topic are destroyed — that is existing behaviour, not a change.
-- =========================================================================

create or replace function public.delete_homework_topic(p_topic_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_topic_id is null then
    raise exception 'A topic is required.' using errcode = '22023';
  end if;

  if not public.can_author_topic(p_topic_id) then
    raise exception 'Topic not found or not yours to edit.' using errcode = '42501';
  end if;

  delete from public.homework_topics where id = p_topic_id;
end;
$$;

revoke all on function public.delete_homework_topic(uuid) from public;
grant execute on function public.delete_homework_topic(uuid) to authenticated;

comment on function public.delete_homework_topic(uuid) is
  'WP-2.3 W-03: replaces the direct delete in deleteHomeworkTopic. The caller still discards the result; the cascade is unchanged.';

-- =========================================================================
-- W-05 · generateWordImage's cache write (features/teacher/vocabularyActions.ts)
--
-- The cache is global by design — one image per normalized word, shared across
-- every teacher and topic — so the scope check is the role check, matching
-- `vocab_image_cache_insert` / `_update`. The one thing added over the direct
-- upsert is that `p_image_url` must be an http(s) URL: the column accepts any
-- string today, and the only real caller passes a Supabase public URL.
--
-- Narrowing the cache so a teacher can only overwrite their own entries
-- (finding F5) is a product decision and is deliberately NOT made here.
--
-- `updated_at` moves from the Next.js server clock to `now()`. Same meaning,
-- database clock, and the column is only ever read for diagnostics.
-- =========================================================================

create or replace function public.cache_vocab_image(
  p_word_key text,
  p_image_url text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := nullif(btrim(coalesce(p_word_key, '')), '');
  v_url text := nullif(btrim(coalesce(p_image_url, '')), '');
begin
  -- An empty key is skipped, exactly as the action skips the upsert.
  if v_key is null then
    return;
  end if;

  if not (public.is_teacher() or public.is_admin()) then
    raise exception 'Only teachers can manage homework.' using errcode = '42501';
  end if;

  if v_url is null or v_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'A cached image URL must be an http(s) URL.' using errcode = '22023';
  end if;

  insert into public.vocab_image_cache (word_key, image_url, updated_at)
  values (v_key, v_url, now())
  on conflict (word_key) do update
    set image_url = excluded.image_url,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.cache_vocab_image(text, text) from public;
grant execute on function public.cache_vocab_image(text, text) to authenticated;

comment on function public.cache_vocab_image(text, text) is
  'WP-2.3 W-05: replaces the direct upsert on vocab_image_cache in generateWordImage. Still non-fatal for the caller — a failure must not lose the teacher their image.';

-- =========================================================================
-- W-06 … W-09 · publishVocabulary (features/teacher/vocabularyActions.ts)
--
-- The four round-trips (delete words, delete tasks, insert words, insert tasks)
-- become one function, so the replace is atomic. That closes finding F3: a
-- failure halfway through currently leaves a live topic with no words, because
-- the deletes have already committed. The failure mode becomes "nothing
-- changed".
--
-- The test itself is still built in TypeScript — `buildVocabTest` in
-- features/homework/vocabulary.ts is a pure, seeded generator shared with the
-- native app and has no business being reimplemented in SQL. The caller passes
-- the finished tasks; this function validates the count and the task type.
--
-- `p_words`: jsonb array of { word, transcription, translation, image_url }.
--   Entries missing `word` or `translation` are dropped before the insert, as
--   the action drops them, and `order_index` is the position in the filtered
--   list. Any `topic_id` inside an element is ignored — the row's topic is
--   always `p_topic_id`.
-- `p_tasks`: jsonb array of { task_type, content, order_index }. `order_index`
--   falls back to the array position when absent.
--
-- `homework_vocab_completions` is untouched: a student who already passed the
-- words stays passed.
-- =========================================================================

create or replace function public.publish_homework_vocabulary(
  p_topic_id uuid,
  p_words jsonb,
  p_tasks jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_word_count integer;
  v_task_count integer;
begin
  if p_topic_id is null then
    raise exception 'A topic is required.' using errcode = '22023';
  end if;

  if not public.can_author_topic(p_topic_id) then
    raise exception 'Topic not found or not yours to edit.' using errcode = '42501';
  end if;

  if p_words is null or jsonb_typeof(p_words) <> 'array' then
    raise exception 'Add at least one word with a translation before publishing.' using errcode = '22023';
  end if;

  if p_tasks is not null and jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'Tasks must be a JSON array.' using errcode = '22023';
  end if;

  -- Same filter the action applies, so the "is there anything to publish?"
  -- check sees the same list and fires before anything is deleted.
  select count(*)
    into v_word_count
  from jsonb_array_elements(p_words) as w(value)
  where btrim(coalesce(w.value ->> 'word', '')) <> ''
    and btrim(coalesce(w.value ->> 'translation', '')) <> '';

  if v_word_count = 0 then
    raise exception 'Add at least one word with a translation before publishing.' using errcode = '22023';
  end if;

  -- MAX_TASK_COUNT in features/teacher/vocabularyActions.ts. The action clamps;
  -- here an over-long list is a rejected request, because a silent truncation
  -- would publish a test the teacher did not review.
  select count(*) into v_task_count from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb));
  if v_task_count > 20 then
    raise exception 'A vocabulary test may have at most 20 tasks.' using errcode = '22023';
  end if;

  delete from public.homework_vocab_words where topic_id = p_topic_id;
  delete from public.homework_vocab_tasks where topic_id = p_topic_id;

  insert into public.homework_vocab_words (
    topic_id, word, transcription, translation, image_url, order_index
  )
  select
    p_topic_id,
    btrim(w.value ->> 'word'),
    nullif(btrim(coalesce(w.value ->> 'transcription', '')), ''),
    btrim(w.value ->> 'translation'),
    nullif(btrim(coalesce(w.value ->> 'image_url', '')), ''),
    (row_number() over (order by w.ordinality) - 1)::integer
  from jsonb_array_elements(p_words) with ordinality as w(value, ordinality)
  where btrim(coalesce(w.value ->> 'word', '')) <> ''
    and btrim(coalesce(w.value ->> 'translation', '')) <> '';

  insert into public.homework_vocab_tasks (topic_id, task_type, content, order_index)
  select
    p_topic_id,
    (t.value ->> 'task_type')::public.mission_task_type,
    coalesce(t.value -> 'content', '{}'::jsonb),
    coalesce((t.value ->> 'order_index')::integer, (t.ordinality - 1)::integer)
  from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) with ordinality as t(value, ordinality);
end;
$$;

revoke all on function public.publish_homework_vocabulary(uuid, jsonb, jsonb) from public;
grant execute on function public.publish_homework_vocabulary(uuid, jsonb, jsonb) to authenticated;

comment on function public.publish_homework_vocabulary(uuid, jsonb, jsonb) is
  'WP-2.3 W-06..W-09: replaces the four direct writes in publishVocabulary with one atomic replace (finding F3). Completions are preserved.';

-- =========================================================================
-- W-10 … W-11 · clearVocabulary (features/teacher/vocabularyActions.ts)
-- =========================================================================

create or replace function public.clear_homework_vocabulary(p_topic_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_topic_id is null then
    raise exception 'A topic is required.' using errcode = '22023';
  end if;

  if not public.can_author_topic(p_topic_id) then
    raise exception 'Topic not found or not yours to edit.' using errcode = '42501';
  end if;

  delete from public.homework_vocab_words where topic_id = p_topic_id;
  delete from public.homework_vocab_tasks where topic_id = p_topic_id;
end;
$$;

revoke all on function public.clear_homework_vocabulary(uuid) from public;
grant execute on function public.clear_homework_vocabulary(uuid) to authenticated;

comment on function public.clear_homework_vocabulary(uuid) is
  'WP-2.3 W-10..W-11: replaces the two direct deletes in clearVocabulary. Completions are preserved.';

-- =========================================================================
-- W-12 … W-15 · publishGrammar (features/teacher/grammarActions.ts)
--
-- Same shape as the vocabulary publish. The one difference is inherited from
-- the action: a grammar test cannot be generated deterministically, so the
-- tasks are the reviewed AI draft and are stored as sent, truncated to
-- MAX_GRAMMAR_TASKS (20) by the caller. As above, an over-long list is
-- rejected rather than silently cut.
--
-- `p_points`: jsonb array of { title, explanation, example }; entries missing
--   `title` or `explanation` are dropped, `order_index` is the position.
-- `p_tasks`: jsonb array of { task_type, content }; `order_index` is the
--   position unless the element carries one.
-- =========================================================================

create or replace function public.publish_homework_grammar(
  p_topic_id uuid,
  p_points jsonb,
  p_tasks jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_point_count integer;
  v_task_count integer;
begin
  if p_topic_id is null then
    raise exception 'A topic is required.' using errcode = '22023';
  end if;

  if not public.can_author_topic(p_topic_id) then
    raise exception 'Topic not found or not yours to edit.' using errcode = '42501';
  end if;

  if p_points is null or jsonb_typeof(p_points) <> 'array' then
    raise exception 'Add at least one grammar point with an explanation before publishing.' using errcode = '22023';
  end if;

  if p_tasks is not null and jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'Tasks must be a JSON array.' using errcode = '22023';
  end if;

  select count(*)
    into v_point_count
  from jsonb_array_elements(p_points) as p(value)
  where btrim(coalesce(p.value ->> 'title', '')) <> ''
    and btrim(coalesce(p.value ->> 'explanation', '')) <> '';

  if v_point_count = 0 then
    raise exception 'Add at least one grammar point with an explanation before publishing.' using errcode = '22023';
  end if;

  select count(*) into v_task_count from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb));
  if v_task_count > 20 then
    raise exception 'A grammar test may have at most 20 tasks.' using errcode = '22023';
  end if;

  delete from public.homework_grammar_points where topic_id = p_topic_id;
  delete from public.homework_grammar_tasks where topic_id = p_topic_id;

  insert into public.homework_grammar_points (
    topic_id, title, explanation, example, order_index
  )
  select
    p_topic_id,
    btrim(p.value ->> 'title'),
    btrim(p.value ->> 'explanation'),
    nullif(btrim(coalesce(p.value ->> 'example', '')), ''),
    (row_number() over (order by p.ordinality) - 1)::integer
  from jsonb_array_elements(p_points) with ordinality as p(value, ordinality)
  where btrim(coalesce(p.value ->> 'title', '')) <> ''
    and btrim(coalesce(p.value ->> 'explanation', '')) <> '';

  insert into public.homework_grammar_tasks (topic_id, task_type, content, order_index)
  select
    p_topic_id,
    (t.value ->> 'task_type')::public.mission_task_type,
    coalesce(t.value -> 'content', '{}'::jsonb),
    coalesce((t.value ->> 'order_index')::integer, (t.ordinality - 1)::integer)
  from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) with ordinality as t(value, ordinality);
end;
$$;

revoke all on function public.publish_homework_grammar(uuid, jsonb, jsonb) from public;
grant execute on function public.publish_homework_grammar(uuid, jsonb, jsonb) to authenticated;

comment on function public.publish_homework_grammar(uuid, jsonb, jsonb) is
  'WP-2.3 W-12..W-15: replaces the four direct writes in publishGrammar with one atomic replace (finding F3). Completions are preserved.';

-- =========================================================================
-- W-16 … W-17 · clearGrammar (features/teacher/grammarActions.ts)
-- =========================================================================

create or replace function public.clear_homework_grammar(p_topic_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_topic_id is null then
    raise exception 'A topic is required.' using errcode = '22023';
  end if;

  if not public.can_author_topic(p_topic_id) then
    raise exception 'Topic not found or not yours to edit.' using errcode = '42501';
  end if;

  delete from public.homework_grammar_points where topic_id = p_topic_id;
  delete from public.homework_grammar_tasks where topic_id = p_topic_id;
end;
$$;

revoke all on function public.clear_homework_grammar(uuid) from public;
grant execute on function public.clear_homework_grammar(uuid) to authenticated;

comment on function public.clear_homework_grammar(uuid) is
  'WP-2.3 W-16..W-17: replaces the two direct deletes in clearGrammar. Completions are preserved.';
