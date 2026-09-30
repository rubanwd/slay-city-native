-- SLAY CITY — WP-2.3 negative tests
--
-- Proves the authorization boundary of the RPCs in this directory from SQL,
-- with the caller's JWT claims faked rather than the UI driven — WP-2.3 `AC3`
-- ("a student-role JWT cannot perform each teacher-only write, via direct API
-- calls, not through the UI") and `AC4` ("a teacher cannot write to a group
-- they do not own").
--
-- HOW TO RUN
--
--   1. Apply migrations 1/4 … 4/4. Sections 6 and 9 need 4/4 (the revokes);
--      everything else passes without it.
--   2. Fill in the ids in the first block from the target database. They must
--      be real rows: `auth.uid()` comes from the faked claims, but every scope
--      check joins real data.
--   3. Run the whole file. It is one transaction ending in ROLLBACK, so it
--      leaves nothing behind — including the rows the parity section creates.
--   4. Every check prints `PASS …`. The first failure raises and aborts the
--      transaction; there is no "some tests failed" summary to misread.
--
-- The caller is switched with top-level `set local role authenticated` plus
-- `request.jwt.claims`, which is what PostgREST does for a signed-in request:
-- the table grants and RLS under test are the ones a real client meets. Role
-- switching stays at the top level on purpose — a `SET ROLE` buried in a
-- function is the kind of thing that quietly does not do what it looks like.

begin;

-- =========================================================================
-- Fixture ids — FILL THESE IN
--
--   student_id      a profile with role 'student', a member of owned_group_id
--   teacher_id      the profile that owns owned_group_id
--   other_teacher   a profile with role 'teacher' that owns neither
--                   owned_group_id nor topic_id — the AC4 subject
--   owned_group_id  a teacher_groups row owned by teacher_id
--   topic_id        a homework_topics row in owned_group_id
--   foreign_topic   a homework_topics row in a group student_id is NOT in
--   fresh_user_id   an auth.users row with no profile, for section 10.
--                   Leave it all-zero to skip that section.
-- =========================================================================

select set_config('wp23.student_id',     '00000000-0000-0000-0000-000000000000', true);
select set_config('wp23.teacher_id',     '00000000-0000-0000-0000-000000000000', true);
select set_config('wp23.other_teacher',  '00000000-0000-0000-0000-000000000000', true);
select set_config('wp23.owned_group_id', '00000000-0000-0000-0000-000000000000', true);
select set_config('wp23.topic_id',       '00000000-0000-0000-0000-000000000000', true);
select set_config('wp23.foreign_topic',  '00000000-0000-0000-0000-000000000000', true);
select set_config('wp23.fresh_user_id',  '00000000-0000-0000-0000-000000000000', true);

-- =========================================================================
-- 1. A student cannot author topics — W-01, W-02, W-03
-- =========================================================================

select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('wp23.student_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
begin
  begin
    perform public.create_homework_topic(
      current_setting('wp23.owned_group_id')::uuid, 'Injected topic'
    );
    raise exception 'FAIL 1a: a student created a topic in their own group';
  exception when insufficient_privilege then
    raise notice 'PASS 1a: create_homework_topic rejected a student';
  end;

  begin
    perform public.update_homework_topic(current_setting('wp23.topic_id')::uuid, 'Injected title');
    raise exception 'FAIL 1b: a student updated a topic';
  exception when insufficient_privilege then
    raise notice 'PASS 1b: update_homework_topic rejected a student';
  end;

  begin
    perform public.delete_homework_topic(current_setting('wp23.topic_id')::uuid);
    raise exception 'FAIL 1c: a student deleted a topic';
  exception when insufficient_privilege then
    raise notice 'PASS 1c: delete_homework_topic rejected a student';
  end;
end;
$$;

-- =========================================================================
-- 2. A student cannot publish or clear content — W-05 … W-17
--
-- The strongest case in the suite: this student IS a member of the group, so
-- `homework_topics_select` lets them read the topic. Visibility must not be
-- mistaken for authoring rights (finding F6). Still the student's session.
-- =========================================================================

do $$
begin
  begin
    perform public.publish_homework_vocabulary(
      current_setting('wp23.topic_id')::uuid,
      '[{"word":"cat","translation":"кіт"}]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'FAIL 2a: a student published vocabulary';
  exception when insufficient_privilege then
    raise notice 'PASS 2a: publish_homework_vocabulary rejected a group member';
  end;

  begin
    perform public.clear_homework_vocabulary(current_setting('wp23.topic_id')::uuid);
    raise exception 'FAIL 2b: a student cleared vocabulary';
  exception when insufficient_privilege then
    raise notice 'PASS 2b: clear_homework_vocabulary rejected a group member';
  end;

  begin
    perform public.publish_homework_grammar(
      current_setting('wp23.topic_id')::uuid,
      '[{"title":"Plurals","explanation":"Add -s"}]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'FAIL 2c: a student published grammar';
  exception when insufficient_privilege then
    raise notice 'PASS 2c: publish_homework_grammar rejected a group member';
  end;

  begin
    perform public.clear_homework_grammar(current_setting('wp23.topic_id')::uuid);
    raise exception 'FAIL 2d: a student cleared grammar';
  exception when insufficient_privilege then
    raise notice 'PASS 2d: clear_homework_grammar rejected a group member';
  end;

  begin
    perform public.cache_vocab_image('cat', 'https://example.com/evil.png');
    raise exception 'FAIL 2e: a student wrote the shared image cache';
  exception when insufficient_privilege then
    raise notice 'PASS 2e: cache_vocab_image rejected a student';
  end;
end;
$$;

-- =========================================================================
-- 3. Q&A — a student may post into their own group's topic and nowhere else
--
-- Still the student's session. These are the writes a student is *supposed* to
-- have, so the first check is a success, not a rejection.
-- =========================================================================

do $$
declare
  v_message_id uuid;
  v_author uuid;
  v_created timestamptz;
begin
  v_message_id := public.post_topic_message(
    current_setting('wp23.topic_id')::uuid, '  Is this homework due Friday?  '
  );

  select author_id, created_at into v_author, v_created
  from public.homework_topic_messages where id = v_message_id;

  if v_author <> current_setting('wp23.student_id')::uuid then
    raise exception 'FAIL 3a: author_id was % not the caller', v_author;
  end if;
  if v_created < now() - interval '1 minute' then
    raise exception 'FAIL 3a: created_at was back-dated to %', v_created;
  end if;
  raise notice 'PASS 3a: a group member posted; author_id is the caller and created_at is now()';

  if (select body from public.homework_topic_messages where id = v_message_id) <>
     'Is this homework due Friday?' then
    raise exception 'FAIL 3b: the body was not trimmed the way the action trims it';
  end if;
  raise notice 'PASS 3b: the body is trimmed, matching postTopicMessage';

  begin
    perform public.post_topic_message(
      current_setting('wp23.foreign_topic')::uuid, 'Hello other group'
    );
    raise exception 'FAIL 3c: a student posted into a topic they cannot see';
  exception when insufficient_privilege then
    raise notice 'PASS 3c: post_topic_message rejected a non-member';
  end;

  begin
    perform public.post_topic_message(current_setting('wp23.topic_id')::uuid, repeat('x', 2001));
    raise exception 'FAIL 3d: a 2001-character message was accepted';
  exception when invalid_parameter_value then
    raise notice 'PASS 3d: post_topic_message enforces the 2000-character limit';
  end;

  begin
    perform public.post_topic_message(current_setting('wp23.topic_id')::uuid, '   ');
    raise exception 'FAIL 3e: a blank message was accepted';
  exception when invalid_parameter_value then
    raise notice 'PASS 3e: a blank message is rejected';
  end;

  -- Read markers are the caller's own row, for a topic they can see.
  perform public.mark_topic_read(current_setting('wp23.topic_id')::uuid);
  if not exists (
    select 1 from public.homework_topic_reads
    where topic_id = current_setting('wp23.topic_id')::uuid
      and user_id = current_setting('wp23.student_id')::uuid
  ) then
    raise exception 'FAIL 3f: mark_topic_read did not create the caller''s row';
  end if;
  raise notice 'PASS 3f: mark_topic_read wrote the caller''s own row';

  -- A topic the caller cannot see is a silent no-op, matching the
  -- fire-and-forget action.
  perform public.mark_topic_read(current_setting('wp23.foreign_topic')::uuid);
  if exists (
    select 1 from public.homework_topic_reads
    where topic_id = current_setting('wp23.foreign_topic')::uuid
      and user_id = current_setting('wp23.student_id')::uuid
  ) then
    raise exception 'FAIL 3g: a read marker was created for an invisible topic';
  end if;
  raise notice 'PASS 3g: mark_topic_read ignored an invisible topic, without raising';
end;
$$;

-- =========================================================================
-- 4. The direct table writes are gone — needs 4/4
--
-- The same writes aimed straight at the tables, as a client holding the public
-- anon key would issue them. Each must fail on the missing grant. Still the
-- student's session.
-- =========================================================================

do $$
begin
  begin
    insert into public.homework_topics (group_id, title)
    values (current_setting('wp23.owned_group_id')::uuid, 'Direct insert');
    raise exception 'FAIL 4a: INSERT on homework_topics still granted';
  exception when insufficient_privilege then
    raise notice 'PASS 4a: no INSERT on homework_topics';
  end;

  begin
    insert into public.homework_vocab_words (topic_id, word, translation)
    values (current_setting('wp23.topic_id')::uuid, 'cat', 'кіт');
    raise exception 'FAIL 4b: INSERT on homework_vocab_words still granted';
  exception when insufficient_privilege then
    raise notice 'PASS 4b: no INSERT on homework_vocab_words';
  end;

  begin
    delete from public.homework_vocab_tasks
    where topic_id = current_setting('wp23.topic_id')::uuid;
    raise exception 'FAIL 4c: DELETE on homework_vocab_tasks still granted';
  exception when insufficient_privilege then
    raise notice 'PASS 4c: no DELETE on homework_vocab_tasks';
  end;

  begin
    delete from public.homework_grammar_points
    where topic_id = current_setting('wp23.topic_id')::uuid;
    raise exception 'FAIL 4d: DELETE on homework_grammar_points still granted';
  exception when insufficient_privilege then
    raise notice 'PASS 4d: no DELETE on homework_grammar_points';
  end;

  begin
    insert into public.homework_grammar_tasks (topic_id, task_type, content)
    values (current_setting('wp23.topic_id')::uuid, 'quiz', '{}'::jsonb);
    raise exception 'FAIL 4e: INSERT on homework_grammar_tasks still granted';
  exception when insufficient_privilege then
    raise notice 'PASS 4e: no INSERT on homework_grammar_tasks';
  end;

  begin
    insert into public.vocab_image_cache (word_key, image_url)
    values ('cat', 'https://example.com/evil.png');
    raise exception 'FAIL 4f: INSERT on vocab_image_cache still granted';
  exception when insufficient_privilege then
    raise notice 'PASS 4f: no INSERT on vocab_image_cache';
  end;

  begin
    insert into public.homework_topic_messages (topic_id, author_id, body, created_at)
    values (
      current_setting('wp23.topic_id')::uuid,
      current_setting('wp23.teacher_id')::uuid,
      'Posted as the teacher',
      '2020-01-01'
    );
    raise exception 'FAIL 4g: INSERT on homework_topic_messages still granted';
  exception when insufficient_privilege then
    raise notice 'PASS 4g: no INSERT on homework_topic_messages — no forged author, no back-dating';
  end;

  begin
    insert into public.homework_topic_reads (topic_id, user_id, last_read_at)
    values (
      current_setting('wp23.topic_id')::uuid,
      current_setting('wp23.teacher_id')::uuid,
      now()
    );
    raise exception 'FAIL 4h: INSERT on homework_topic_reads still granted';
  exception when insufficient_privilege then
    raise notice 'PASS 4h: no INSERT on homework_topic_reads';
  end;
end;
$$;

-- =========================================================================
-- 5. Finding F1 — XP and coins can no longer be self-minted. Needs 4/4.
--
-- The regression test for the one hole that is live today. Run 5a against
-- production BEFORE the migration as well: there it is expected to *succeed*,
-- and that success is the finding.
-- =========================================================================

do $$
begin
  begin
    insert into public.user_stats (profile_id, xp, coins, level, current_streak, longest_streak)
    values (current_setting('wp23.student_id')::uuid, 999999, 999999, 99, 365, 365);
    raise exception 'FAIL 5a: a user inserted their own user_stats row with forged counters';
  exception when insufficient_privilege then
    raise notice 'PASS 5a: no INSERT on user_stats';
  end;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'user_stats'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'FAIL 5b: authenticated still holds a write grant on user_stats';
  end if;
  raise notice 'PASS 5b: authenticated has no write grant on user_stats at all';
end;
$$;

-- Every function this package adds must be executable by `authenticated` and
-- by nobody else. PostgreSQL grants EXECUTE on a new function to PUBLIC by
-- default, which would hand `anon` — the public key anyone can read out of the
-- app bundle — the whole authoring surface. `proacl is null` means the default
-- is still in place; grantee 0 in the ACL is PUBLIC.
do $$
declare
  v_leaky text;
begin
  select string_agg(p.proname, ', ')
    into v_leaky
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'can_author_group', 'can_author_topic', 'assert_optional_http_url',
      'create_homework_topic', 'update_homework_topic', 'delete_homework_topic',
      'cache_vocab_image', 'publish_homework_vocabulary', 'clear_homework_vocabulary',
      'publish_homework_grammar', 'clear_homework_grammar',
      'can_see_topic', 'post_topic_message', 'mark_topic_read', 'delete_topic_message',
      'create_my_profile'
    )
    and (
      p.proacl is null
      or exists (
        select 1 from aclexplode(p.proacl) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      )
    );

  if v_leaky is not null then
    raise exception 'FAIL 5c: EXECUTE is still open to PUBLIC on: %', v_leaky;
  end if;
  raise notice 'PASS 5c: no new function leaves EXECUTE open to PUBLIC';
end;
$$;

do $$
declare
  v_missing text;
begin
  select string_agg(p.proname, ', ')
    into v_missing
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'can_author_group', 'can_author_topic', 'assert_optional_http_url',
      'create_homework_topic', 'update_homework_topic', 'delete_homework_topic',
      'cache_vocab_image', 'publish_homework_vocabulary', 'clear_homework_vocabulary',
      'publish_homework_grammar', 'clear_homework_grammar',
      'can_see_topic', 'post_topic_message', 'mark_topic_read', 'delete_topic_message',
      'create_my_profile'
    )
    and not has_function_privilege('authenticated', p.oid, 'execute');

  if v_missing is not null then
    raise exception 'FAIL 5d: authenticated cannot execute: %', v_missing;
  end if;
  raise notice 'PASS 5d: authenticated can execute every new function';
end;
$$;

-- Every new function must pin its search_path, or a caller-controlled path
-- turns a SECURITY DEFINER function into an escalation. `proconfig` carries
-- the SET clause.
do $$
declare
  v_unpinned text;
begin
  select string_agg(p.proname, ', ')
    into v_unpinned
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'can_author_group', 'can_author_topic', 'assert_optional_http_url',
      'create_homework_topic', 'update_homework_topic', 'delete_homework_topic',
      'cache_vocab_image', 'publish_homework_vocabulary', 'clear_homework_vocabulary',
      'publish_homework_grammar', 'clear_homework_grammar',
      'can_see_topic', 'post_topic_message', 'mark_topic_read', 'delete_topic_message',
      'create_my_profile', 'create_user_stats_for_new_profile'
    )
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, array[]::text[])) as c(setting)
      where c.setting like 'search\_path=%'
    );

  if v_unpinned is not null then
    raise exception 'FAIL 5e: search_path is not pinned on: %', v_unpinned;
  end if;
  raise notice 'PASS 5e: search_path is pinned on every new SECURITY DEFINER function';
end;
$$;

-- =========================================================================
-- 6. AC4 — a teacher cannot write into a group they do not own
-- =========================================================================

select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('wp23.other_teacher'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
begin
  begin
    perform public.create_homework_topic(
      current_setting('wp23.owned_group_id')::uuid, 'Not my group'
    );
    raise exception 'FAIL 6a: a non-owning teacher created a topic';
  exception when insufficient_privilege then
    raise notice 'PASS 6a: create_homework_topic rejected a non-owning teacher';
  end;

  begin
    perform public.update_homework_topic(current_setting('wp23.topic_id')::uuid, 'Not my topic');
    raise exception 'FAIL 6b: a non-owning teacher updated a topic (finding F4 regression)';
  exception when insufficient_privilege then
    raise notice 'PASS 6b: update_homework_topic rejected a non-owning teacher, loudly';
  end;

  begin
    perform public.delete_homework_topic(current_setting('wp23.topic_id')::uuid);
    raise exception 'FAIL 6c: a non-owning teacher deleted a topic';
  exception when insufficient_privilege then
    raise notice 'PASS 6c: delete_homework_topic rejected a non-owning teacher';
  end;

  begin
    perform public.publish_homework_vocabulary(
      current_setting('wp23.topic_id')::uuid,
      '[{"word":"cat","translation":"кіт"}]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'FAIL 6d: a non-owning teacher published vocabulary';
  exception when insufficient_privilege then
    raise notice 'PASS 6d: publish_homework_vocabulary rejected a non-owning teacher';
  end;

  begin
    perform public.clear_homework_vocabulary(current_setting('wp23.topic_id')::uuid);
    raise exception 'FAIL 6e: a non-owning teacher cleared vocabulary';
  exception when insufficient_privilege then
    raise notice 'PASS 6e: clear_homework_vocabulary rejected a non-owning teacher';
  end;

  begin
    perform public.publish_homework_grammar(
      current_setting('wp23.topic_id')::uuid,
      '[{"title":"Plurals","explanation":"Add -s"}]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'FAIL 6f: a non-owning teacher published grammar';
  exception when insufficient_privilege then
    raise notice 'PASS 6f: publish_homework_grammar rejected a non-owning teacher';
  end;

  begin
    perform public.clear_homework_grammar(current_setting('wp23.topic_id')::uuid);
    raise exception 'FAIL 6g: a non-owning teacher cleared grammar';
  exception when insufficient_privilege then
    raise notice 'PASS 6g: clear_homework_grammar rejected a non-owning teacher';
  end;
end;
$$;

reset role;

-- =========================================================================
-- 7. The owning teacher's flows still work, and still work the same way
--
-- The point of the package is that this section is boring. It also pins the
-- parity details that are easy to get wrong in SQL: trimming, empty-to-NULL,
-- dropping incomplete entries, and 0-based `order_index`.
-- =========================================================================

select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('wp23.teacher_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_topic_id uuid;
  v_words integer;
  v_tasks integer;
  v_points integer;
begin
  v_topic_id := public.create_homework_topic(
    current_setting('wp23.owned_group_id')::uuid,
    '  WP-2.3 parity check  ',
    '   ',
    3,
    'https://example.com/notes',
    null
  );

  if not exists (
    select 1 from public.homework_topics
    where id = v_topic_id
      and title = 'WP-2.3 parity check'
      and description is null
      and order_index = 3
      and note_image_url is null
  ) then
    raise exception 'FAIL 7a: create did not trim / empty-to-NULL the way the action does';
  end if;
  raise notice 'PASS 7a: the owning teacher created a topic, parsed like the action parses it';

  perform public.update_homework_topic(v_topic_id, 'WP-2.3 parity check (edited)', null, 0);
  if not exists (
    select 1 from public.homework_topics
    where id = v_topic_id and title = 'WP-2.3 parity check (edited)' and order_index = 0
  ) then
    raise exception 'FAIL 7b: update did not apply';
  end if;
  raise notice 'PASS 7b: the owning teacher updated it';

  perform public.publish_homework_vocabulary(
    v_topic_id,
    '[{"word":" cat ","transcription":"kæt","translation":"кіт","image_url":""},
      {"word":"","translation":"dropped, no word"},
      {"word":"dog","translation":"пес"}]'::jsonb,
    '[{"task_type":"quiz","content":{"prompt":"cat"},"order_index":0}]'::jsonb
  );

  select count(*) into v_words from public.homework_vocab_words where topic_id = v_topic_id;
  select count(*) into v_tasks from public.homework_vocab_tasks where topic_id = v_topic_id;

  if v_words <> 2 or v_tasks <> 1 then
    raise exception 'FAIL 7c: published % words and % tasks, expected 2 and 1', v_words, v_tasks;
  end if;
  raise notice 'PASS 7c: publish dropped the incomplete word and inserted 2 words + 1 task';

  if not exists (
    select 1 from public.homework_vocab_words
    where topic_id = v_topic_id and word = 'cat' and image_url is null and order_index = 0
  ) or not exists (
    select 1 from public.homework_vocab_words
    where topic_id = v_topic_id and word = 'dog' and order_index = 1
  ) then
    raise exception 'FAIL 7d: trimming, empty-to-NULL or 0-based ordering does not match the action';
  end if;
  raise notice 'PASS 7d: trimming, empty-to-NULL and 0-based ordering match the action';

  -- Republishing replaces rather than appends, in one transaction.
  perform public.publish_homework_vocabulary(
    v_topic_id, '[{"word":"bird","translation":"птах"}]'::jsonb, '[]'::jsonb
  );
  select count(*) into v_words from public.homework_vocab_words where topic_id = v_topic_id;
  select count(*) into v_tasks from public.homework_vocab_tasks where topic_id = v_topic_id;
  if v_words <> 1 or v_tasks <> 0 then
    raise exception 'FAIL 7e: republish left % words and % tasks, expected 1 and 0', v_words, v_tasks;
  end if;
  raise notice 'PASS 7e: republish replaced the whole set';

  perform public.publish_homework_grammar(
    v_topic_id,
    '[{"title":" Plurals ","explanation":"Add -s","example":""},
      {"title":"","explanation":"dropped, no title"}]'::jsonb,
    '[{"task_type":"quiz","content":{"prompt":"cats"}}]'::jsonb
  );
  select count(*) into v_points from public.homework_grammar_points where topic_id = v_topic_id;
  if v_points <> 1 or not exists (
    select 1 from public.homework_grammar_points
    where topic_id = v_topic_id and title = 'Plurals' and example is null and order_index = 0
  ) then
    raise exception 'FAIL 7f: grammar publish did not match the action, % points', v_points;
  end if;
  raise notice 'PASS 7f: grammar publish dropped the incomplete point and parsed the rest';

  -- `order_index` falls back to the array position when the element omits it,
  -- which is how publishGrammar sends its tasks.
  if not exists (
    select 1 from public.homework_grammar_tasks
    where topic_id = v_topic_id and order_index = 0
  ) then
    raise exception 'FAIL 7g: a task with no order_index did not fall back to its position';
  end if;
  raise notice 'PASS 7g: order_index falls back to the array position';

  perform public.clear_homework_vocabulary(v_topic_id);
  perform public.clear_homework_grammar(v_topic_id);
  if exists (select 1 from public.homework_vocab_words where topic_id = v_topic_id)
     or exists (select 1 from public.homework_grammar_points where topic_id = v_topic_id) then
    raise exception 'FAIL 7h: clear left content behind';
  end if;
  raise notice 'PASS 7h: clear removed words, tasks and points';

  perform public.cache_vocab_image('  CAT  ', 'https://example.com/cat.png');
  raise notice 'PASS 7i: the teacher wrote the shared image cache';

  perform public.delete_homework_topic(v_topic_id);
  if exists (select 1 from public.homework_topics where id = v_topic_id) then
    raise exception 'FAIL 7j: delete left the topic behind';
  end if;
  raise notice 'PASS 7j: the owning teacher deleted the topic';
end;
$$;

-- =========================================================================
-- 8. Validation lives in SQL, not only in TypeScript
--
-- Still the owning teacher: these are rejections of bad input, not of the
-- caller.
-- =========================================================================

do $$
begin
  begin
    perform public.create_homework_topic(
      current_setting('wp23.owned_group_id')::uuid, 'Bad link', null, 0, 'javascript:alert(1)'
    );
    raise exception 'FAIL 8a: a javascript: URL was accepted as a note link';
  exception when invalid_parameter_value then
    raise notice 'PASS 8a: note_link_url must be an http(s) URL';
  end;

  begin
    perform public.create_homework_topic(
      current_setting('wp23.owned_group_id')::uuid, '   '
    );
    raise exception 'FAIL 8b: a blank title was accepted';
  exception when invalid_parameter_value then
    raise notice 'PASS 8b: title is required';
  end;

  begin
    perform public.create_homework_topic(
      current_setting('wp23.owned_group_id')::uuid, 'Negative order', null, -1
    );
    raise exception 'FAIL 8c: a negative order_index was accepted';
  exception when invalid_parameter_value then
    raise notice 'PASS 8c: order_index must be non-negative';
  end;

  begin
    perform public.publish_homework_vocabulary(
      current_setting('wp23.topic_id')::uuid, '[]'::jsonb, '[]'::jsonb
    );
    raise exception 'FAIL 8d: an empty word list was published';
  exception when invalid_parameter_value then
    raise notice 'PASS 8d: publishing needs at least one complete word';
  end;

  begin
    perform public.publish_homework_grammar(
      current_setting('wp23.topic_id')::uuid,
      '[{"title":"no explanation"}]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'FAIL 8e: a point with no explanation was published';
  exception when invalid_parameter_value then
    raise notice 'PASS 8e: publishing needs at least one complete grammar point';
  end;

  begin
    perform public.publish_homework_vocabulary(
      current_setting('wp23.topic_id')::uuid,
      '[{"word":"cat","translation":"кіт"}]'::jsonb,
      (select jsonb_agg(jsonb_build_object('task_type', 'quiz', 'content', '{}'::jsonb))
       from generate_series(1, 21))
    );
    raise exception 'FAIL 8f: a 21-task test was accepted';
  exception when invalid_parameter_value then
    raise notice 'PASS 8f: a test is capped at 20 tasks, and over-long is rejected not truncated';
  end;

  begin
    perform public.cache_vocab_image('cat', 'not-a-url');
    raise exception 'FAIL 8g: a non-URL was cached as an image';
  exception when invalid_parameter_value then
    raise notice 'PASS 8g: a cached image URL must be http(s)';
  end;
end;
$$;

-- =========================================================================
-- 9. Q&A moderation, and an author deleting their own message
-- =========================================================================

do $$
declare
  v_teacher_message uuid;
begin
  v_teacher_message := public.post_topic_message(
    current_setting('wp23.topic_id')::uuid, 'Yes, Friday.'
  );
  perform set_config('wp23.teacher_message', v_teacher_message::text, true);
  raise notice 'PASS 9a: the owning teacher posted into their own topic';
end;
$$;

reset role;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('wp23.student_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
begin
  begin
    perform public.delete_topic_message(current_setting('wp23.teacher_message')::uuid);
    raise exception 'FAIL 9b: a student deleted the teacher''s message';
  exception when insufficient_privilege then
    raise notice 'PASS 9b: delete_topic_message rejected a non-author';
  end;
end;
$$;

reset role;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('wp23.teacher_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
begin
  -- Moderation by the owning teacher is existing database behaviour
  -- (`hw_messages_delete`, unknown U-4) and is preserved on purpose. If the
  -- product decides against it, this is the check that has to change.
  perform public.delete_topic_message(current_setting('wp23.teacher_message')::uuid);
  if exists (
    select 1 from public.homework_topic_messages
    where id = current_setting('wp23.teacher_message')::uuid
  ) then
    raise exception 'FAIL 9c: the message survived its own author''s delete';
  end if;
  raise notice 'PASS 9c: the author/owning teacher can delete a message in their topic';

  -- A second delete of the same id is a no-op, not an error: the action
  -- returns ok for this and a double-tap must not surface a failure.
  perform public.delete_topic_message(current_setting('wp23.teacher_message')::uuid);
  raise notice 'PASS 9d: deleting an already-deleted message is a silent no-op';
end;
$$;

reset role;

-- =========================================================================
-- 10. Onboarding through the RPC creates both rows, with zeroed counters
--
-- Needs an `auth.users` row with no profile. Skipped with a notice if
-- `wp23.fresh_user_id` is still all-zero, rather than failing on a foreign key.
-- =========================================================================

select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('wp23.fresh_user_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_fresh uuid := current_setting('wp23.fresh_user_id')::uuid;
  v_level public.knowledge_level;
  v_xp integer;
  v_coins integer;
  v_level_no integer;
  v_streak integer;
begin
  if v_fresh = '00000000-0000-0000-0000-000000000000'::uuid then
    raise notice 'SKIP 10: set wp23.fresh_user_id to an auth.users row with no profile';
    return;
  end if;

  select lvl into v_level from public.available_knowledge_levels() as lvl limit 1;

  perform public.create_my_profile('Test Player', null::smallint, v_level);

  if not exists (
    select 1 from public.profiles where id = v_fresh and role = 'student' and username = 'Test Player'
  ) then
    raise exception 'FAIL 10a: create_my_profile did not create a student profile';
  end if;
  raise notice 'PASS 10a: the profile exists, with role student';

  select xp, coins, level, current_streak into v_xp, v_coins, v_level_no, v_streak
  from public.user_stats where profile_id = v_fresh;

  if v_xp is null then
    raise exception 'FAIL 10b: no user_stats row was created';
  end if;
  if v_xp <> 0 or v_coins <> 0 or v_level_no <> 1 or v_streak <> 0 then
    raise exception 'FAIL 10b: counters were % / % / % / %, expected 0 / 0 / 1 / 0',
      v_xp, v_coins, v_level_no, v_streak;
  end if;
  raise notice 'PASS 10b: the user_stats row exists with zeroed counters';

  begin
    perform public.create_my_profile('Test Player Again', null::smallint, v_level);
    raise exception 'FAIL 10c: create_my_profile ran twice for the same user';
  exception when unique_violation then
    raise notice 'PASS 10c: a second call raises 23505, the code the action already maps';
  end;
end;
$$;

reset role;

-- The role escalation the function makes impossible by construction: `role` is
-- not a parameter, so there is nothing to test but the shape of the signature.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_my_profile'
      and 'role' = any (p.proargnames)
  ) then
    raise exception 'FAIL 10d: create_my_profile accepts a role parameter';
  end if;
  raise notice 'PASS 10d: create_my_profile has no role parameter — student is hard-coded';
end;
$$;

rollback;
