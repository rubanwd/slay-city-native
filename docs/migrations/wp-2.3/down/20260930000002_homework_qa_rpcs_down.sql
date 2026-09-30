-- Rollback for 20260930000002_homework_qa_rpcs.sql
--
-- Run 4/4's rollback first if it is applied, or the Q&A thread has no write
-- path. `can_see_topic` is dropped last because the three functions use it.
--
-- The body CHECK is dropped too, so the rollback leaves the table exactly as
-- it was. It only ever rejected what the action already rejected, so nothing
-- depends on it.

drop function if exists public.delete_topic_message(uuid);
drop function if exists public.mark_topic_read(uuid);
drop function if exists public.post_topic_message(uuid, text);
drop function if exists public.can_see_topic(uuid);

alter table public.homework_topic_messages
  drop constraint if exists homework_topic_messages_body_length;
