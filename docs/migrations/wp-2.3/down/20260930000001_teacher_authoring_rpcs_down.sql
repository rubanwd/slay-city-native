-- Rollback for 20260930000001_teacher_authoring_rpcs.sql
--
-- Safe to run whenever 4/4 is not applied, or has already been rolled back:
-- the functions are additive, so dropping them only removes the new write
-- path. If 4/4 IS applied, run its rollback first or teacher authoring has no
-- write path at all.

drop function if exists public.clear_homework_grammar(uuid);
drop function if exists public.publish_homework_grammar(uuid, jsonb, jsonb);
drop function if exists public.clear_homework_vocabulary(uuid);
drop function if exists public.publish_homework_vocabulary(uuid, jsonb, jsonb);
drop function if exists public.cache_vocab_image(text, text);
drop function if exists public.delete_homework_topic(uuid);
drop function if exists public.update_homework_topic(uuid, text, text, integer, text, text);
drop function if exists public.create_homework_topic(uuid, text, text, integer, text, text);
drop function if exists public.assert_optional_http_url(text, text);
drop function if exists public.can_author_topic(uuid);
drop function if exists public.can_author_group(uuid);
