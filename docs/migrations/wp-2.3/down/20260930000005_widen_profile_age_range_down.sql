-- Rollback for 20260930000005_widen_profile_age_range.sql
--
-- Restores the original 7–14 CHECK. Not silent: if any row was inserted or
-- updated with an age outside 7–14 while the wider constraint was in force,
-- this `alter table` fails with `23514` rather than corrupting or discarding
-- data. Resolve those rows first — either null out `age` or edit the value —
-- then re-run.

alter table public.profiles
  drop constraint profiles_age_check,
  add constraint profiles_age_check check (age is null or age between 7 and 14);
