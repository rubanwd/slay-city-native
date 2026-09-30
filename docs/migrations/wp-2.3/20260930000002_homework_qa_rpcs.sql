-- SLAY CITY — WP-2.3 (2/4): SECURITY DEFINER RPCs for the topic Q&A thread
--
-- Replaces the three direct writes in `features/homework/qa/actions.ts`
-- (operations W-18 … W-20 of `docs/native-app/DIRECT-WRITES.md`). Unlike the
-- teacher writes, these are student-writable **by design**: a group member may
-- post into their own group's thread, and delete their own message. Nothing
-- here narrows that.
--
-- What it does close is what the TypeScript layer was holding shut:
--
--   * `author_id` and `created_at` were both client-settable through
--     PostgREST. `hw_messages_insert` pins the author but says nothing about
--     the timestamp, so a caller could back-date a message and land it above
--     someone else's in a thread ordered by `created_at`. The RPC sets both.
--   * `homework_topic_reads.last_read_at` came from the Next.js server clock
--     and could be any value the caller chose, for any topic id that exists —
--     RLS never checked topic visibility on this table. The RPC uses `now()`
--     and checks visibility.
--   * `body` has no SQL length limit; the 2 000-character rule lived only in
--     the action. This migration adds it as a CHECK so it holds for every
--     client, RPC or not.
--
-- Additive: no policy dropped, no grant revoked. Migration 4/4 does the
-- lockdown. Rollback is `down/20260930000002_homework_qa_rpcs_down.sql`.
--
-- Realtime keeps working unchanged: these functions INSERT and DELETE on
-- `homework_topic_messages`, which is in the `supabase_realtime` publication,
-- so subscribers see the same row events they see today.

-- =========================================================================
-- Helper: may the caller see this topic?
--
-- The same predicate `get_topic_messages()` and `get_unread_topics()` already
-- use — admin, group member, or the owning teacher. This is topic
-- *visibility*, which for the Q&A thread is the correct check; it is
-- deliberately not the ownership check used by the authoring RPCs in 1/4.
-- =========================================================================

create or replace function public.can_see_topic(p_topic_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.homework_topics t
    where t.id = p_topic_id
      and (
        public.is_admin()
        or public.is_group_member(t.group_id)
        or exists (
          select 1
          from public.teacher_groups g
          where g.id = t.group_id and g.teacher_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.can_see_topic(uuid) from public;
grant execute on function public.can_see_topic(uuid) to authenticated;

comment on function public.can_see_topic(uuid) is
  'WP-2.3: topic visibility (admin / group member / owning teacher), matching get_topic_messages. Visibility, not authoring rights — see can_author_topic.';

-- =========================================================================
-- Message length, in SQL
--
-- MAX_BODY_LENGTH in features/homework/qa/actions.ts. Blank bodies are
-- rejected here too: the action already trims and refuses empty, and a blank
-- bubble is not a message. Added NOT VALID then validated, so if any legacy
-- row ever violated it the failure names the validation step rather than
-- rewriting history.
-- =========================================================================

alter table public.homework_topic_messages
  add constraint homework_topic_messages_body_length
  check (btrim(body) <> '' and char_length(body) <= 2000) not valid;

alter table public.homework_topic_messages
  validate constraint homework_topic_messages_body_length;

-- =========================================================================
-- W-18 · postTopicMessage (features/homework/qa/actions.ts)
--
-- Returns the new message id. The action returns `{ ok: true }` and does not
-- use it; the native client wants it for optimistic-list reconciliation.
-- =========================================================================

create or replace function public.post_topic_message(
  p_topic_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_author uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_message_id uuid;
begin
  if v_author is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;

  if p_topic_id is null then
    raise exception 'Missing topic.' using errcode = '22023';
  end if;

  if v_body = '' then
    raise exception 'Message can''t be empty.' using errcode = '22023';
  end if;

  if char_length(v_body) > 2000 then
    raise exception 'Message must be 2000 characters or fewer.' using errcode = '22023';
  end if;

  if not public.can_see_topic(p_topic_id) then
    raise exception 'Topic not found.' using errcode = '42501';
  end if;

  insert into public.homework_topic_messages (topic_id, author_id, body, created_at)
  values (p_topic_id, v_author, v_body, now())
  returning id into v_message_id;

  return v_message_id;
end;
$$;

revoke all on function public.post_topic_message(uuid, text) from public;
grant execute on function public.post_topic_message(uuid, text) to authenticated;

comment on function public.post_topic_message(uuid, text) is
  'WP-2.3 W-18: replaces the direct insert in postTopicMessage. author_id and created_at are set here, so neither can be forged or back-dated.';

-- =========================================================================
-- W-19 · markTopicRead (features/homework/qa/actions.ts)
--
-- Fire-and-forget from the client, so it stays silent: no session, no topic, a
-- topic the caller cannot see — all return without raising, exactly as the
-- action's ignored-error path behaves today. The badge is the caller's own and
-- nothing else reads the row.
-- =========================================================================

create or replace function public.mark_topic_read(p_topic_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or p_topic_id is null then
    return;
  end if;

  if not public.can_see_topic(p_topic_id) then
    return;
  end if;

  insert into public.homework_topic_reads (topic_id, user_id, last_read_at)
  values (p_topic_id, v_user, now())
  on conflict (topic_id, user_id) do update
    set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_topic_read(uuid) from public;
grant execute on function public.mark_topic_read(uuid) to authenticated;

comment on function public.mark_topic_read(uuid) is
  'WP-2.3 W-19: replaces the direct upsert in markTopicRead. Timestamp is now(), the row is always the caller''s, and the topic must be visible.';

-- =========================================================================
-- W-20 · deleteTopicMessage (features/homework/qa/actions.ts)
--
-- Keeps the `hw_messages_delete` rule exactly: the author, an admin, or the
-- owning teacher. The teacher/admin branch is moderation the database has
-- always allowed and the UI has never offered (unknown U-4) — preserving it is
-- parity; removing it would be a product decision.
--
-- A delete the caller may not perform currently returns `{ ok: true }` and
-- changes nothing. Here it raises `42501`. No successful flow changes: the UI
-- only renders the button on the caller's own messages.
-- =========================================================================

create or replace function public.delete_topic_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_author uuid;
  v_topic_id uuid;
begin
  if v_user is null then
    raise exception 'You must be signed in.' using errcode = '28000';
  end if;

  if p_message_id is null then
    raise exception 'Missing message.' using errcode = '22023';
  end if;

  select m.author_id, m.topic_id
    into v_author, v_topic_id
  from public.homework_topic_messages m
  where m.id = p_message_id;

  -- Already gone. The action reports success for this, and so do we — a
  -- double-tap on the delete button is not an error.
  if not found then
    return;
  end if;

  if not (
    v_author = v_user
    or public.is_admin()
    or exists (
      select 1
      from public.homework_topics t
      join public.teacher_groups g on g.id = t.group_id
      where t.id = v_topic_id and g.teacher_id = auth.uid()
    )
  ) then
    raise exception 'That message is not yours to delete.' using errcode = '42501';
  end if;

  delete from public.homework_topic_messages where id = p_message_id;
end;
$$;

revoke all on function public.delete_topic_message(uuid) from public;
grant execute on function public.delete_topic_message(uuid) to authenticated;

comment on function public.delete_topic_message(uuid) is
  'WP-2.3 W-20: replaces the direct delete in deleteTopicMessage. Author, admin, or owning teacher — the hw_messages_delete rule, enforced in the function.';
