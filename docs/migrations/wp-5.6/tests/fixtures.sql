-- SLAY CITY — WP-5.6 test fixtures
--
-- Creates the rows `rate-limit-tests.sql` needs and points its `wp56.*` config
-- vars at them, so the suite runs unattended with one `psql` invocation. Same
-- shape and same reasoning as `../../wp-2.3/tests/fixtures.sql`: fixed literal
-- uuids so a failing assertion is readable, and everything runs inside the
-- caller's `begin; … rollback;` so nothing survives a run.
--
-- Must run as the connecting superuser, before any `set local role`, so the
-- inserts bypass RLS and `prevent_role_insert_escalation` (which only checks
-- `request.jwt.claims`, unset at this point) trusts a `role` of `teacher`.

insert into auth.users (id, email) values
  ('a1111111-1111-4111-8111-111111111111', 'wp56-teacher@test.invalid'),
  ('a2222222-2222-4222-8222-222222222222', 'wp56-other-teacher@test.invalid'),
  ('a3333333-3333-4333-8333-333333333333', 'wp56-student@test.invalid');

insert into public.profiles (id, username, role) values
  ('a1111111-1111-4111-8111-111111111111', 'wp56_teacher', 'teacher'),
  ('a2222222-2222-4222-8222-222222222222', 'wp56_other_teacher', 'teacher'),
  ('a3333333-3333-4333-8333-333333333333', 'wp56_student', 'student');

insert into public.teacher_groups (id, teacher_id, name) values
  ('a4444444-4444-4444-8444-444444444444', 'a1111111-1111-4111-8111-111111111111', 'WP-5.6 group');

insert into public.homework_topics (id, group_id, title, description) values
  ('a5555555-5555-4555-8555-555555555555',
   'a4444444-4444-4444-8444-444444444444',
   'WP-5.6 fixture topic',
   'Used by the ownership and ledger tests');

select set_config('wp56.teacher_id',    'a1111111-1111-4111-8111-111111111111', true);
select set_config('wp56.other_teacher', 'a2222222-2222-4222-8222-222222222222', true);
select set_config('wp56.student_id',    'a3333333-3333-4333-8333-333333333333', true);
select set_config('wp56.group_id',      'a4444444-4444-4444-8444-444444444444', true);
select set_config('wp56.topic_id',      'a5555555-5555-4555-8555-555555555555', true);
