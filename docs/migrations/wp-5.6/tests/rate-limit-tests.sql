-- SLAY CITY — WP-5.6 rate-limit and ledger tests
--
-- Proves the SQL half of `OD-1` from SQL: that `public.ai_generation_events` is
-- unreachable from any PostgREST role, that `public.claim_ai_generation` is
-- callable only by `service_role`, and that the budgets in
-- `docs/EDGE-FUNCTIONS-PLAN.md` §6.4 actually bind.
--
-- HOW TO RUN — locally
--
--   1. Stand up a database with the migration timeline applied: the bootstrap in
--      `../../wp-2.3/tests/bootstrap.sql` (generic to the whole timeline, not
--      WP-2.3-specific), then every file in `supabase/migrations/` in order,
--      then `../20260930000010_ai_generation_rate_limit.sql`.
--   2. `psql -v ON_ERROR_STOP=1 -f rate-limit-tests.sql`. It pulls in
--      `fixtures.sql` itself via `\ir` (resolved relative to this file, not the
--      caller's working directory), so there is nothing to fill in by hand.
--   3. Every check prints `PASS …`. The first failure raises and aborts the
--      transaction; there is no "some tests failed" summary to misread.
--
-- One transaction, ending in `ROLLBACK` — including every ledger row the budget
-- sections insert, so a run leaves no spend history behind.
--
-- NOT covered here, because one `psql` session cannot: the concurrency property
-- (N parallel claims against a budget of M grant exactly M). That needs real
-- parallel connections and is driven from the shell — see "Concurrency" in
-- `../README.md`, which records the command and its result.

begin;

\ir fixtures.sql

-- =========================================================================
-- Section 1 — the ledger is unreachable from every PostgREST role
--
-- Asserted structurally, from the catalog, because this is a grant-level
-- property: if `has_table_privilege` says the privilege is absent, no policy,
-- no BYPASSRLS and no clever request can produce it.
-- =========================================================================

do $$
declare
  r text;
  p text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    foreach p in array array['select', 'insert', 'update', 'delete'] loop
      if has_table_privilege(r, 'public.ai_generation_events', p) then
        raise exception 'FAIL 1a: % still has % on ai_generation_events', r, p;
      end if;
    end loop;
  end loop;
  raise notice 'PASS 1a: ai_generation_events grants anon/authenticated/service_role = none';
end;
$$;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.ai_generation_events'::regclass) then
    raise exception 'FAIL 1b: RLS is not enabled on ai_generation_events';
  end if;
  raise notice 'PASS 1b: RLS enabled on ai_generation_events';
end;
$$;

do $$
declare
  v_policies int;
begin
  select count(*) into v_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'ai_generation_events';

  -- Zero is the intended configuration, not an unfinished migration: with no
  -- grants there is nothing for a policy to refine, and a policy would imply
  -- the table is meant to be reachable.
  if v_policies <> 0 then
    raise exception 'FAIL 1c: expected no policies on ai_generation_events, found %', v_policies;
  end if;
  raise notice 'PASS 1c: ai_generation_events has no RLS policies, as designed';
end;
$$;

do $$
begin
  if has_sequence_privilege('authenticated', 'public.ai_generation_events_id_seq', 'usage') then
    raise exception 'FAIL 1d: authenticated still has usage on the ledger sequence';
  end if;
  raise notice 'PASS 1d: ledger sequence not granted to authenticated';
end;
$$;

-- =========================================================================
-- Section 2 — the claim is service_role-only
-- =========================================================================

do $$
declare
  v_sig text := 'public.claim_ai_generation(uuid,uuid,text,uuid)';
begin
  if has_function_privilege('public', v_sig, 'execute') then
    raise exception 'FAIL 2a: PUBLIC still has execute on claim_ai_generation';
  end if;
  if has_function_privilege('anon', v_sig, 'execute') then
    raise exception 'FAIL 2b: anon still has execute on claim_ai_generation';
  end if;
  if has_function_privilege('authenticated', v_sig, 'execute') then
    raise exception 'FAIL 2c: authenticated still has execute on claim_ai_generation — a client could drain or skip its own quota';
  end if;
  if not has_function_privilege('service_role', v_sig, 'execute') then
    raise exception 'FAIL 2d: service_role cannot execute claim_ai_generation — the Edge Function would 500 on every call';
  end if;
  raise notice 'PASS 2: claim_ai_generation execute = service_role only';
end;
$$;

do $$
begin
  if has_function_privilege('authenticated', 'public.ai_window_retry_after(uuid,text,interval)', 'execute') then
    raise exception 'FAIL 2e: authenticated can execute ai_window_retry_after';
  end if;
  raise notice 'PASS 2e: ai_window_retry_after not callable by authenticated';
end;
$$;

do $$
declare
  v_config text[];
begin
  select proconfig into v_config
  from pg_proc
  where oid = to_regprocedure('public.claim_ai_generation(uuid,uuid,text,uuid)');

  if v_config is null or not (v_config @> array['search_path=public, pg_temp']) then
    raise exception 'FAIL 2f: claim_ai_generation does not pin search_path (got %)', v_config;
  end if;
  raise notice 'PASS 2f: claim_ai_generation pins search_path';
end;
$$;

-- =========================================================================
-- Section 3 — an authenticated client is refused at the boundary
--
-- Section 2 proves the grant is missing; this proves what a real request meets.
-- `set local role authenticated` plus `request.jwt.claims` is what PostgREST
-- does for a signed-in call.
-- =========================================================================

do $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('wp56.teacher_id'), 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  begin
    perform public.claim_ai_generation(
      current_setting('wp56.teacher_id')::uuid,
      current_setting('wp56.teacher_id')::uuid,
      'draft_vocabulary',
      current_setting('wp56.topic_id')::uuid
    );
    raise exception 'FAIL 3a: a teacher JWT could call claim_ai_generation directly';
  exception
    when insufficient_privilege then
      raise notice 'PASS 3a: authenticated cannot call claim_ai_generation (42501)';
  end;

  begin
    perform 1 from public.ai_generation_events;
    raise exception 'FAIL 3b: a teacher JWT could read the ledger';
  exception
    when insufficient_privilege then
      raise notice 'PASS 3b: authenticated cannot read ai_generation_events (42501)';
  end;

  begin
    insert into public.ai_generation_events (user_id, teacher_id, kind)
    values (
      current_setting('wp56.teacher_id')::uuid,
      current_setting('wp56.teacher_id')::uuid,
      'draft_vocabulary'
    );
    raise exception 'FAIL 3c: a teacher JWT could pad the ledger';
  exception
    when insufficient_privilege then
      raise notice 'PASS 3c: authenticated cannot insert into ai_generation_events (42501)';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

do $$
begin
  set local role anon;
  begin
    perform 1 from public.ai_generation_events;
    raise exception 'FAIL 3d: anon could read the ledger';
  exception
    when insufficient_privilege then
      raise notice 'PASS 3d: anon cannot read ai_generation_events (42501)';
  end;
  reset role;
end;
$$;

-- =========================================================================
-- Section 4 — the per-minute budget binds, and the claim is a claim
-- =========================================================================

do $$
declare
  v_allowed boolean;
  v_retry   int;
  v_left    int;
  i         int;
begin
  for i in 1..5 loop
    select allowed, retry_after_seconds, remaining_today
    into v_allowed, v_retry, v_left
    from public.claim_ai_generation(
      current_setting('wp56.teacher_id')::uuid,
      current_setting('wp56.teacher_id')::uuid,
      'draft_vocabulary',
      current_setting('wp56.topic_id')::uuid
    );

    if not v_allowed then
      raise exception 'FAIL 4a: claim % of 5 was refused (retry %)', i, v_retry;
    end if;
    -- The daily budget is 200, so each grant must be visible in what is left.
    if v_left <> 200 - i then
      raise exception 'FAIL 4b: after claim % remaining_today was % (expected %)', i, v_left, 200 - i;
    end if;
  end loop;
  raise notice 'PASS 4a: five draft_vocabulary claims in a minute are granted';
  raise notice 'PASS 4b: remaining_today decrements with each grant';

  -- Each grant inserted exactly one row; nothing was counted without being
  -- recorded, which is what makes two concurrent requests unable to both pass.
  if (select count(*) from public.ai_generation_events
      where teacher_id = current_setting('wp56.teacher_id')::uuid
        and kind = 'draft_vocabulary') <> 5 then
    raise exception 'FAIL 4c: expected exactly 5 ledger rows, found %',
      (select count(*) from public.ai_generation_events);
  end if;
  raise notice 'PASS 4c: five grants wrote five ledger rows';

  select allowed, retry_after_seconds into v_allowed, v_retry
  from public.claim_ai_generation(
    current_setting('wp56.teacher_id')::uuid,
    current_setting('wp56.teacher_id')::uuid,
    'draft_vocabulary',
    current_setting('wp56.topic_id')::uuid
  );

  if v_allowed then
    raise exception 'FAIL 4d: the sixth claim in a minute was granted';
  end if;
  raise notice 'PASS 4d: the sixth claim in a minute is refused';

  -- A 429 has to name a real wait. The minute window is what refused, so the
  -- answer must be inside it and never zero.
  if v_retry < 1 or v_retry > 60 then
    raise exception 'FAIL 4e: retry_after_seconds was % for an exhausted minute window', v_retry;
  end if;
  raise notice 'PASS 4e: retry_after_seconds (%) is inside the exhausted window', v_retry;

  -- A refusal must not record anything — it spent nothing.
  if (select count(*) from public.ai_generation_events) <> 5 then
    raise exception 'FAIL 4f: a refused claim wrote a ledger row';
  end if;
  raise notice 'PASS 4f: a refused claim records nothing';
end;
$$;

-- =========================================================================
-- Section 5 — budgets are scoped per kind and per teacher
--
-- Shares a transaction with section 4, so `teacher_id`'s draft_vocabulary minute
-- is already spent. Both claims below must still be granted.
-- =========================================================================

do $$
declare
  v_allowed boolean;
begin
  select allowed into v_allowed
  from public.claim_ai_generation(
    current_setting('wp56.teacher_id')::uuid,
    current_setting('wp56.teacher_id')::uuid,
    'draft_grammar',
    current_setting('wp56.topic_id')::uuid
  );
  if not v_allowed then
    raise exception 'FAIL 5a: draft_grammar was refused because draft_vocabulary was exhausted';
  end if;
  raise notice 'PASS 5a: a spent draft_vocabulary budget does not block draft_grammar';

  select allowed into v_allowed
  from public.claim_ai_generation(
    current_setting('wp56.other_teacher')::uuid,
    current_setting('wp56.other_teacher')::uuid,
    'draft_vocabulary',
    null
  );
  if not v_allowed then
    raise exception 'FAIL 5b: one teacher exhausting a budget blocked another teacher';
  end if;
  raise notice 'PASS 5b: budgets are per teacher, not global';
end;
$$;

-- =========================================================================
-- Section 6 — the image budget is the one the auto-image flow needs
--
-- `handleGenerateDraft()` with auto images on fires up to 20 `generate-image`
-- calls immediately after a draft, at IMAGE_CONCURRENCY = 3. A per-minute limit
-- under ~20 would break shipped behaviour and look like a flaky model, so the
-- budget is 25 and this is the regression test for that number.
-- =========================================================================

do $$
declare
  v_allowed boolean;
  i int;
begin
  for i in 1..20 loop
    select allowed into v_allowed
    from public.claim_ai_generation(
      current_setting('wp56.other_teacher')::uuid,
      current_setting('wp56.other_teacher')::uuid,
      'generate_image',
      null
    );
    if not v_allowed then
      raise exception 'FAIL 6a: image claim % of 20 refused — the auto-image flow would break', i;
    end if;
  end loop;
  raise notice 'PASS 6a: a 20-image auto-generate batch fits inside the per-minute budget';
end;
$$;

-- =========================================================================
-- Section 7 — the hour window binds independently of the minute window
--
-- Backdated rows, so the minute window is empty while the hour window is full.
-- `retry_after_seconds` must then point into the hour, not the minute.
-- =========================================================================

do $$
declare
  v_allowed boolean;
  v_retry   int;
begin
  insert into public.ai_generation_events (user_id, teacher_id, kind, created_at)
  select
    current_setting('wp56.student_id')::uuid,
    current_setting('wp56.student_id')::uuid,
    'draft_grammar',
    now() - interval '50 minutes' + (g * interval '1 second')
  from generate_series(1, 40) g;

  select allowed, retry_after_seconds into v_allowed, v_retry
  from public.claim_ai_generation(
    current_setting('wp56.student_id')::uuid,
    current_setting('wp56.student_id')::uuid,
    'draft_grammar',
    null
  );

  if v_allowed then
    raise exception 'FAIL 7a: the 41st call in an hour was granted';
  end if;
  raise notice 'PASS 7a: the hourly budget binds with an empty minute window';

  -- Oldest row is 50 minutes old, so the hour frees a slot in ~10 minutes.
  if v_retry < 540 or v_retry > 660 then
    raise exception 'FAIL 7b: retry_after_seconds was % for an hour window whose oldest row is 50 minutes old', v_retry;
  end if;
  raise notice 'PASS 7b: retry_after_seconds (%) points into the hour window', v_retry;
end;
$$;

-- =========================================================================
-- Section 8 — the window really is a sliding window
--
-- Rows older than the window must stop counting, or a budget would be a
-- lifetime cap rather than a rate.
-- =========================================================================

do $$
declare
  v_allowed boolean;
begin
  update public.ai_generation_events
  set created_at = now() - interval '2 days'
  where teacher_id = current_setting('wp56.student_id')::uuid;

  select allowed into v_allowed
  from public.claim_ai_generation(
    current_setting('wp56.student_id')::uuid,
    current_setting('wp56.student_id')::uuid,
    'draft_grammar',
    null
  );
  if not v_allowed then
    raise exception 'FAIL 8a: spend older than a day still counted against the budget';
  end if;
  raise notice 'PASS 8a: the windows slide — spend older than a day no longer counts';
end;
$$;

-- =========================================================================
-- Section 9 — input validation
-- =========================================================================

do $$
begin
  begin
    perform public.claim_ai_generation(
      current_setting('wp56.teacher_id')::uuid,
      current_setting('wp56.teacher_id')::uuid,
      'draft_everything',
      null
    );
    raise exception 'FAIL 9a: an unknown kind was accepted';
  exception
    when invalid_parameter_value then
      raise notice 'PASS 9a: an unknown kind raises 22023';
  end;

  begin
    perform public.claim_ai_generation(
      null,
      current_setting('wp56.teacher_id')::uuid,
      'draft_vocabulary',
      null
    );
    raise exception 'FAIL 9b: a null user_id was accepted';
  exception
    when invalid_parameter_value then
      raise notice 'PASS 9b: a null user_id raises 22023';
  end;
end;
$$;

do $$
begin
  -- The CHECK is the second line of defence: even an owner-level insert cannot
  -- record a kind the budget table does not know about.
  begin
    insert into public.ai_generation_events (user_id, teacher_id, kind)
    values (
      current_setting('wp56.teacher_id')::uuid,
      current_setting('wp56.teacher_id')::uuid,
      'something_else'
    );
    raise exception 'FAIL 9c: the kind CHECK constraint did not fire';
  exception
    when check_violation then
      raise notice 'PASS 9c: ai_generation_events.kind CHECK rejects an unknown kind';
  end;
end;
$$;

-- =========================================================================
-- Section 10 — deleting a topic must not erase spend history
-- =========================================================================

do $$
declare
  v_rows int;
  v_null int;
begin
  select count(*) into v_rows
  from public.ai_generation_events
  where topic_id = current_setting('wp56.topic_id')::uuid;
  if v_rows = 0 then
    raise exception 'FAIL 10a: no fixture ledger rows reference the topic';
  end if;

  delete from public.homework_topics where id = current_setting('wp56.topic_id')::uuid;

  select count(*) into v_null
  from public.ai_generation_events
  where topic_id is null;
  if v_null < v_rows then
    raise exception 'FAIL 10a: deleting a topic removed % ledger rows', v_rows - v_null;
  end if;
  raise notice 'PASS 10a: deleting a topic nulls topic_id and keeps the spend history';
end;
$$;

rollback;
