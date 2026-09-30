-- Rollback for 20260930000004_revoke_direct_write_grants.sql
--
-- Restores every grant to exactly what the migration that created each table
-- issued, so the pre-WP-2.3 write paths work again. This is the rollback to
-- reach for first if the RPC deploy has to be backed out: it puts the direct
-- writes back without touching a single function, and the RLS policies were
-- never changed, so the boundary returns to what it was.
--
-- Sources for each grant:
--   homework_topics                 20260720000009_homework.sql
--   homework_vocab_words / _tasks   20260721000002_homework_vocabulary.sql
--   homework_grammar_points/_tasks  20260721000005_homework_grammar.sql
--   vocab_image_cache               20260721000004_vocab_image_cache.sql
--   homework_topic_messages         20260722000002_homework_qa.sql
--   homework_topic_reads            20260722000003_homework_topic_reads.sql
--   user_stats                      20260701000001_initial_schema.sql

grant select, insert, update, delete on public.homework_topics to authenticated;
grant select, insert, update, delete on public.homework_vocab_words to authenticated;
grant select, insert, update, delete on public.homework_vocab_tasks to authenticated;
grant select, insert, update, delete on public.homework_grammar_points to authenticated;
grant select, insert, update, delete on public.homework_grammar_tasks to authenticated;

grant select, insert, update on public.vocab_image_cache to authenticated;

grant select, insert, delete on public.homework_topic_messages to authenticated;
grant select, insert, update on public.homework_topic_reads to authenticated;

grant select, insert on public.user_stats to authenticated;
