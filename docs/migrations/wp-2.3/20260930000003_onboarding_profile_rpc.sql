-- SLAY CITY — WP-2.3 (3/4): create_my_profile() and an unforgeable user_stats row
--
-- Replaces the two direct writes in `features/onboarding/actions.ts`
-- (operations W-21 and W-22 of `docs/native-app/DIRECT-WRITES.md`) with one
-- atomic SECURITY DEFINER function, and makes the `user_stats` row impossible
-- to author.
--
-- This is the one genuinely exposed hole the audit found, and it is live on the
-- web today — it is not a mobile regression (finding F1):
--
--     create policy "user_stats_insert_own" on public.user_stats
--       for insert with check (auth.uid() = profile_id);
--     grant select, insert on public.user_stats to authenticated;
--
-- That constrains *which row*, never *what is in it*. There is no CHECK, no
-- INSERT trigger and no column-level grant, so any user who has a profile but
-- no stats row can `POST /rest/v1/user_stats` with any `xp`, `coins`, `level`,
-- `current_streak`, `longest_streak` and `last_activity_date` they like. That
-- state is reachable on purpose (create the profile through PostgREST instead
-- of the onboarding form) and by accident (W-22 failing after W-21 succeeded,
-- which the two non-transactional inserts make possible). It violates the
-- AGENTS.md rule that XP, coins and streaks are only ever written
-- server-side.
--
-- Three parts:
--
--   1. `create_user_stats_for_new_profile` — an AFTER INSERT trigger on
--      `profiles` that creates the zeroed row for every new student/parent.
--      This is the answer to unknown U-5: the parent path in
--      `features/auth/roleRouting.ts` (`ensureRoleProfile`) inserts
--      `user_stats (profile_id)` with the caller's JWT, and revoking the grant
--      in 4/4 would break parent sign-up. A trigger fixes that path without
--      changing a line of it, and covers every future writer of `profiles`
--      too — which an RPC would not.
--   2. `create_my_profile(...)` — the onboarding write, both rows, one
--      transaction, counters fixed in SQL.
--   3. A backfill for accounts that already have a profile and no stats row
--      (unknown U-3), so the revoke in 4/4 cannot strand them.
--
-- Additive: no policy dropped, no grant revoked. 4/4 does the lockdown, and
-- until then the direct inserts keep working. Rollback is
-- `down/20260930000003_onboarding_profile_rpc_down.sql`.
--
-- `profiles.age` (finding F2, unknown U-6) — DECIDED, see SCN-11-1. The form's
-- range (5–99) is canonical; `20260930000005_widen_profile_age_range.sql`
-- widens the column's CHECK to match. This function still passes `p_age`
-- through unchanged rather than re-validating the range itself — the column
-- CHECK is the single source of truth for it, so there is nothing for this
-- function to duplicate.

-- =========================================================================
-- 1. Every new student/parent profile gets a zeroed stats row
--
-- `on conflict do nothing` so it composes with the callers that already
-- create the row themselves — `admin_create_profile` and `admin_set_user_role`
-- (20260810000001_admin_user_management.sql) both do, and neither needs
-- changing.
--
-- Teachers and admins are skipped: no screen they can reach reads
-- `user_stats`, and that is the same rule `admin_create_profile` applies.
-- =========================================================================

create or replace function public.create_user_stats_for_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role in ('student', 'parent') then
    insert into public.user_stats (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

comment on function public.create_user_stats_for_new_profile() is
  'WP-2.3: creates the zeroed user_stats row for every new student/parent profile, so no client ever needs INSERT on user_stats (finding F1, unknown U-5).';

drop trigger if exists profiles_create_user_stats on public.profiles;
create trigger profiles_create_user_stats
  after insert on public.profiles
  for each row execute function public.create_user_stats_for_new_profile();

-- =========================================================================
-- 2. create_my_profile() — the end of onboarding, in one transaction
--
-- `id` and `role` are set here, never accepted: the onboarding path only ever
-- creates a `student`. (`profiles_prevent_role_insert_escalation` already
-- blocks a self-selected `admin`/`teacher`; this removes the parameter
-- altogether.)
--
-- Username rules mirror `checkUsername` in features/profile/username.ts —
-- normalize whitespace, 2–32 code points, no control characters, none of the
-- symbols that could impersonate another player or break a layout, at least
-- one letter or digit. The web action still validates first and its messages
-- are unchanged; this is the copy that holds for a client that never runs it.
-- The character rule is a deliberate superset of the TypeScript regex (which
-- is an allow-list of Unicode letters, marks, digits and `_ - ' ’ .`): a
-- denylist cannot reject a legitimate name written in a script we did not
-- think of, and the abuse it needs to stop is the symbol set below.
--
-- Level is re-checked against `available_knowledge_levels()`, the rule
-- `set_my_knowledge_level` was created to enforce in SQL rather than the UI.
--
-- Uniqueness is left to the constraints, so a resubmit still raises `23505`
-- and the action's existing "That username is already taken." mapping keeps
-- working byte for byte — including for a user who already has a profile,
-- which is today's behaviour.
-- =========================================================================

create or replace function public.create_my_profile(
  p_username text,
  p_age smallint default null,
  p_level public.knowledge_level default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_username text := btrim(regexp_replace(coalesce(p_username, ''), '\s+', ' ', 'g'));
  v_length integer;
begin
  if v_uid is null then
    raise exception 'Your session expired. Please log in again.' using errcode = '28000';
  end if;

  v_length := char_length(v_username);

  if v_length < 2 then
    raise exception 'Username must be at least 2 characters.' using errcode = '22023';
  end if;

  if v_length > 32 then
    raise exception 'Username must be 32 characters or fewer.' using errcode = '22023';
  end if;

  if v_username ~ '[[:cntrl:]]' or v_username ~ '[@/\\<>"]' then
    raise exception 'Username can only contain letters, numbers, spaces, and _ - '' .'
      using errcode = '22023';
  end if;

  if v_username !~ '[[:alnum:]]' then
    raise exception 'Username must contain at least one letter or number.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.available_knowledge_levels()) then
    raise exception 'No levels are open yet. Please try again later.' using errcode = '22023';
  end if;

  if p_level is null then
    raise exception 'Choose your level.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.available_knowledge_levels() as lvl where lvl = p_level
  ) then
    raise exception 'Level % has no content yet', p_level using errcode = '22023';
  end if;

  -- No avatar_url: a player's avatar is their mascot in the equipped wardrobe
  -- item, so there is nothing to pick at signup. `age` is passed through to the
  -- column's own CHECK — widened to 5–99 by
  -- `20260930000005_widen_profile_age_range.sql`, see the note at the top of
  -- this file.
  insert into public.profiles (id, username, age, level, role)
  values (v_uid, v_username, p_age, p_level, 'student');

  -- The trigger above has already created this row. Kept explicit so the
  -- counters this function guarantees are visible at the call site, and so the
  -- function stands on its own if the trigger is ever reworked.
  insert into public.user_stats (profile_id, xp, coins, level, current_streak, longest_streak)
  values (v_uid, 0, 0, 1, 0, 0)
  on conflict (profile_id) do nothing;
end;
$$;

revoke all on function public.create_my_profile(text, smallint, public.knowledge_level) from public;
grant execute on function public.create_my_profile(text, smallint, public.knowledge_level) to authenticated;

comment on function public.create_my_profile(text, smallint, public.knowledge_level) is
  'WP-2.3 W-21+W-22: replaces the two direct inserts in createProfile. One transaction, role fixed to student, counters fixed at zero (finding F1).';

-- =========================================================================
-- 3. Backfill — profiles stranded without a stats row
--
-- A W-22 that failed after W-21 succeeded leaves an account that cannot rerun
-- onboarding (W-21 then hits `23505`) and has no stats row. Those accounts are
-- the ones that can still self-mint XP today, and once 4/4 revokes the grant
-- they would have no way to get a row at all. Give them the zeroed one.
--
-- This only inserts what is missing; it never touches an existing row, so it
-- cannot overwrite legitimate progress. It also does not clean up values that
-- were already forged — unknown U-3 in the audit, which needs a product call
-- on what counts as implausible.
-- =========================================================================

insert into public.user_stats (profile_id)
select p.id
from public.profiles p
left join public.user_stats s on s.profile_id = p.id
where s.id is null
  and p.role in ('student', 'parent')
on conflict (profile_id) do nothing;
