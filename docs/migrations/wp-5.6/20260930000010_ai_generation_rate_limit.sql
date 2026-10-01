-- SLAY CITY — WP-5.6 (1/1): AI generation ledger + rate-limit claim
--
-- The database half of `OD-1`: OpenRouter drafting moves out of Next.js Server
-- Actions into the Supabase Edge Functions `draft-vocabulary` and
-- `draft-grammar` (see `docs/EDGE-FUNCTIONS-PLAN.md` §6 in the native repo).
-- Those functions spend money before they write anything, so no RLS policy is
-- ever in their path, and nothing in this timeline bounds the spend today:
-- `grep -rl rate_limit supabase/migrations/` returns nothing. The only limit is
-- that a teacher has to click, and a client holding a valid teacher JWT can
-- click as fast as the endpoint responds.
--
-- This migration adds:
--
--   * `public.ai_generation_events` — an append-only ledger of billed calls.
--   * `public.ai_window_retry_after(...)` — a small helper the claim uses to
--     turn an exhausted window into a real number of seconds.
--   * `public.claim_ai_generation(...)` — the gate the Edge Function calls
--     *before* its outbound request. Grants or refuses one unit of quota and
--     records it in the same transaction.
--
-- It is purely additive. Nothing reads or writes either object until the
-- functions are deployed, so it can be applied at any time, including before
-- the web app is redeployed. Rollback is
-- `down/20260930000010_ai_generation_rate_limit_down.sql`.
--
-- Independent of `docs/migrations/wp-2.3/2026093000000[1-5]_*.sql`. The `000010`
-- suffix only keeps it lexically after them; it depends on none of them and
-- none of them depends on it.

-- =========================================================================
-- The ledger
--
-- RLS is enabled and *no policy is written*, and no table grant is issued to
-- any PostgREST role — not `anon`, not `authenticated`, and deliberately not
-- `service_role` either. That is the finished state, not an unfinished
-- migration:
--
--   * a client with the anon key cannot read the ledger, pad it with fake rows
--     to look rate-limited, or delete rows to reset its own budget;
--   * a *leaked service key* cannot either, which is why `service_role` is
--     revoked as well. `service_role` has BYPASSRLS, so an RLS policy would
--     never have stopped it; only the missing grant does.
--
-- Every access goes through `claim_ai_generation` below, which is SECURITY
-- DEFINER and therefore runs as the table owner regardless of the caller.
-- =========================================================================

create table if not exists public.ai_generation_events (
  id         bigserial primary key,
  -- The signed-in caller. An admin "viewing as" a teacher is recorded here as
  -- themselves, while `teacher_id` holds whose budget was spent.
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Whose budget this call counts against: the topic's owning teacher.
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('draft_vocabulary', 'draft_grammar', 'generate_image')),
  -- Nullable, ON DELETE SET NULL: deleting a topic must not erase the spend
  -- history that topic caused.
  topic_id   uuid references public.homework_topics (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Budgets are per teacher per kind, so this is the index every window count in
-- `claim_ai_generation` uses. (EDGE-FUNCTIONS-PLAN.md §6.2 sketched it on
-- `user_id`; the budgets it specifies in §6.4 are per *teacher*, and an admin
-- viewing-as makes those two different columns.)
create index if not exists ai_generation_events_teacher_kind_created_idx
  on public.ai_generation_events (teacher_id, kind, created_at desc);

-- The project-wide daily ceiling in §6.5 counts across every teacher and kind.
create index if not exists ai_generation_events_created_idx
  on public.ai_generation_events (created_at desc);

alter table public.ai_generation_events enable row level security;

revoke all on public.ai_generation_events from anon, authenticated, service_role;
revoke all on sequence public.ai_generation_events_id_seq from anon, authenticated, service_role;

comment on table public.ai_generation_events is
  'WP-5.6: append-only ledger of billed OpenRouter calls. RLS on with no policies and no grants to any PostgREST role, by design - reachable only through claim_ai_generation().';

-- =========================================================================
-- Retry-after for one exhausted window
--
-- How long until the oldest event inside `p_window` ages out of it. That is the
-- first moment a slot frees, so it is what the 429 should say. Clamped to at
-- least one second so a client never gets `Retry-After: 0` and retries in a
-- tight loop.
-- =========================================================================

create or replace function public.ai_window_retry_after(
  p_teacher_id uuid,
  p_kind       text,
  p_window     interval
)
returns integer
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select greatest(
    1,
    coalesce(
      ceil(extract(epoch from (min(created_at) + p_window) - now()))::integer,
      1
    )
  )
  from public.ai_generation_events
  where teacher_id = p_teacher_id
    and kind = p_kind
    and created_at > now() - p_window;
$$;

revoke all on function public.ai_window_retry_after(uuid, text, interval) from public;

comment on function public.ai_window_retry_after(uuid, text, interval) is
  'WP-5.6: seconds until the oldest ai_generation_events row in this window ages out of it. Helper for claim_ai_generation; not granted to any PostgREST role.';

-- =========================================================================
-- The claim
--
-- Returns exactly one row. `allowed = true` means one unit of quota was granted
-- *and recorded*, so the caller may make its outbound request. `allowed =
-- false` means it must not, and `retry_after_seconds` says when the tightest
-- exhausted window frees a slot.
--
-- Concurrency. EDGE-FUNCTIONS-PLAN.md §6.3 asks for "count and insert in one
-- statement, not count-then-insert", because two concurrent requests both pass
-- a separate SELECT count(*). One statement is necessary but not sufficient:
-- under READ COMMITTED each transaction's snapshot still excludes the other's
-- uncommitted insert, so a single `insert ... select ... where count < limit`
-- races in exactly the same way. The serialization has to be explicit, so this
-- function takes a transaction-scoped advisory lock keyed on
-- (teacher_id, kind) first. Concurrent claims against the *same* budget queue
-- behind it — which is the point, since that is the only case that can
-- over-grant — while claims for different teachers or kinds never contend. The
-- lock is released when the RPC's own transaction ends microseconds later;
-- nothing slow (least of all the OpenRouter call) happens inside it.
--
-- Callable only by `service_role`, i.e. only from inside an Edge Function.
-- Granted to `authenticated` it would be a self-service quota counter a client
-- could drain deliberately, or simply decline to call.
-- =========================================================================

create or replace function public.claim_ai_generation(
  p_user_id    uuid,
  p_teacher_id uuid,
  p_kind       text,
  p_topic_id   uuid
)
returns table (allowed boolean, retry_after_seconds integer, remaining_today integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Opening budgets from EDGE-FUNCTIONS-PLAN.md §6.4: numbers to tune from the
  -- ledger after a month of real use, not constants to defend. `generate_image`
  -- is 25/minute because handleGenerateDraft() with auto images on fires up to
  -- 20 image calls immediately after a draft; anything below ~20 breaks shipped
  -- behaviour and the failure looks like a flaky model rather than a limit.
  v_per_minute integer;
  v_per_hour   integer;
  v_per_day    integer;

  -- Circuit breaker (§6.5). Per-teacher limits bound one compromised account,
  -- not the bill. Set well above plausible legitimate use.
  c_global_per_day constant integer := 5000;

  v_minute_used integer;
  v_hour_used   integer;
  v_day_used    integer;
  v_global_used integer;

  v_retry    integer;
  v_inserted boolean := false;
begin
  if p_user_id is null or p_teacher_id is null or p_kind is null then
    raise exception 'claim_ai_generation requires user_id, teacher_id and kind'
      using errcode = '22023';
  end if;

  case p_kind
    when 'draft_vocabulary' then v_per_minute := 5;  v_per_hour := 40;  v_per_day := 200;
    when 'draft_grammar'    then v_per_minute := 5;  v_per_hour := 40;  v_per_day := 200;
    when 'generate_image'   then v_per_minute := 25; v_per_hour := 200; v_per_day := 600;
    else raise exception 'unknown ai generation kind: %', p_kind using errcode = '22023';
  end case;

  -- Serialize concurrent claims against this one budget. See the header note.
  perform pg_advisory_xact_lock(
    hashtextextended(p_teacher_id::text || ':' || p_kind, 0)
  );

  select
    count(*) filter (where created_at > now() - interval '1 minute'),
    count(*) filter (where created_at > now() - interval '1 hour'),
    count(*)
  into v_minute_used, v_hour_used, v_day_used
  from public.ai_generation_events
  where teacher_id = p_teacher_id
    and kind = p_kind
    and created_at > now() - interval '1 day';

  if v_minute_used < v_per_minute
     and v_hour_used < v_per_hour
     and v_day_used < v_per_day
  then
    -- The global brake is checked last, so it costs one extra count only on
    -- calls that would otherwise have been allowed.
    select count(*) into v_global_used
    from public.ai_generation_events
    where created_at > now() - interval '1 day';

    if v_global_used >= c_global_per_day then
      raise log 'ai_generation global daily ceiling reached: % of % in the last 24h (teacher %, kind %)',
        v_global_used, c_global_per_day, p_teacher_id, p_kind;
      v_retry := 3600;
    else
      insert into public.ai_generation_events (user_id, teacher_id, kind, topic_id)
      values (p_user_id, p_teacher_id, p_kind, p_topic_id);
      v_inserted := true;
      v_day_used := v_day_used + 1;
    end if;
  end if;

  if v_inserted then
    return query select true, 0, greatest(0, v_per_day - v_day_used);
    return;
  end if;

  -- Refused. `retry_after_seconds` is how long until the oldest event in the
  -- tightest exhausted window ages out of it, so the 429 can name a real wait
  -- instead of "try again later". Already set when the global ceiling refused.
  if v_retry is null then
    if v_minute_used >= v_per_minute then
      v_retry := public.ai_window_retry_after(p_teacher_id, p_kind, interval '1 minute');
    elsif v_hour_used >= v_per_hour then
      v_retry := public.ai_window_retry_after(p_teacher_id, p_kind, interval '1 hour');
    else
      v_retry := public.ai_window_retry_after(p_teacher_id, p_kind, interval '1 day');
    end if;
  end if;

  return query select false, v_retry, greatest(0, v_per_day - v_day_used);
end;
$$;

revoke all on function public.claim_ai_generation(uuid, uuid, text, uuid) from public;
grant execute on function public.claim_ai_generation(uuid, uuid, text, uuid) to service_role;

comment on function public.claim_ai_generation(uuid, uuid, text, uuid) is
  'WP-5.6: grant-or-refuse one unit of AI generation quota for a teacher and kind, recording it in ai_generation_events. Serialized per budget with an advisory lock. service_role only - an Edge Function calls it before spending money.';
