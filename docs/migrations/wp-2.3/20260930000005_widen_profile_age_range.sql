-- SLAY CITY — WP-2.3 (5/5): widen profiles.age to the onboarding form's range
--
-- Resolves the OPEN DECISION left in
-- `20260930000003_onboarding_profile_rpc.sql` (finding F2, unknown U-6):
-- `20260703000001_add_profile_age.sql` constrained the column to
-- `age is null or age between 7 and 14`, but `features/onboarding/actions.ts`
-- has validated and displayed `MIN_AGE = 5` / `MAX_AGE = 99` since commit
-- `32247f5` (#91). Ages 5, 6 and 15–99 pass the form and fail the insert with
-- a raw `23514`.
--
-- Decision (recorded on SCN-11 / SCN-11-1): the form's range is canonical —
-- 5 to 99 inclusive, still nullable. `age` is an optional, self-reported,
-- write-only field: it is stored on `profiles` and never read back by any
-- screen, RPC or mission/knowledge-level gate in either the upstream app or
-- this one (checked — no `\bage\b` reference outside the onboarding form,
-- its action and `types/database.ts`). Narrowing the form to 7–14 instead
-- would reject a parent completing onboarding on their child's behalf or an
-- adult learner, for a value the product does not currently act on. Widening
-- the column is therefore the change with no downstream risk.
--
-- The constraint is unnamed in `20260703000001_add_profile_age.sql`, so
-- Postgres gave it the default name for a single-column CHECK:
-- `profiles_age_check`.
--
-- Additive in effect (no row can violate the new, wider range if it satisfied
-- the old one), but written as drop-then-add because Postgres has no
-- "alter constraint" for a CHECK's expression. Safe to apply independently of
-- 1/4–4/4; does not need to precede or follow any of them.

alter table public.profiles
  drop constraint profiles_age_check,
  add constraint profiles_age_check check (age is null or age between 5 and 99);
