-- Rollback for 20260930000003_onboarding_profile_rpc.sql
--
-- Run 4/4's rollback first if it is applied: without the trigger AND without
-- the INSERT grant on `user_stats`, a new student or parent profile gets no
-- stats row and every gameplay screen reads a missing row.
--
-- The backfilled `user_stats` rows are NOT removed. They are zeroed rows that
-- the accounts should have had all along, they are indistinguishable from a
-- row created by onboarding, and deleting them would strand those accounts
-- again. A rollback that loses data is worse than one that leaves it.

drop trigger if exists profiles_create_user_stats on public.profiles;
drop function if exists public.create_user_stats_for_new_profile();
drop function if exists public.create_my_profile(text, smallint, public.knowledge_level);
