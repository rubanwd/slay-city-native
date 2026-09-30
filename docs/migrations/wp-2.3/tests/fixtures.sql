-- SLAY CITY — WP-2.3 test fixtures
--
-- Creates the rows `negative-tests.sql` needs and points its `wp23.*` config
-- vars at them, so the suite runs unattended — no manual id lookup, which is
-- what made the original version unsuitable for CI (`SCN-13`).
--
-- Must run inside the same transaction as `negative-tests.sql`, before its
-- first `set local role authenticated` — every insert here runs as the
-- connecting superuser, which is both how it bypasses RLS and how
-- `prevent_role_insert_escalation` trusts a `role` of `teacher`/`admin`: the
-- trigger only checks `request.jwt.claims`, which is unset until section 1
-- calls `set_config('request.jwt.claims', ...)`.
--
-- Ids are fixed literals, not `gen_random_uuid()`, purely so a failing
-- assertion is reproducible to read rather than for any idempotency need —
-- the whole file runs inside `negative-tests.sql`'s `begin; … rollback;` and
-- leaves nothing behind either way.

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'wp23-student@test.invalid'),
  ('22222222-2222-2222-2222-222222222222', 'wp23-teacher@test.invalid'),
  ('33333333-3333-3333-3333-333333333333', 'wp23-other-teacher@test.invalid'),
  ('77777777-7777-7777-7777-777777777777', 'wp23-fresh-user@test.invalid');

insert into public.profiles (id, username, role) values
  ('11111111-1111-1111-1111-111111111111', 'wp23_student', 'student'),
  ('22222222-2222-2222-2222-222222222222', 'wp23_teacher', 'teacher'),
  ('33333333-3333-3333-3333-333333333333', 'wp23_other_teacher', 'teacher');
-- fresh_user_id (777…) deliberately gets no profile — section 10 needs an
-- auth.users row that has not onboarded yet.
--
-- No explicit `user_stats` insert: once migration 3/4 is applied,
-- `profiles_create_user_stats` creates it after every profile insert above.
-- Without 3/4 these three have no stats row, which only matters to section 5
-- (needs 4/4 anyway) and section 10 (skips itself without `fresh_user_id`).

-- owned_group_id: teacher_id's group, with student_id as its only member.
insert into public.teacher_groups (id, teacher_id, name) values
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'WP-2.3 owned group');

insert into public.teacher_group_members (group_id, student_id) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111');

insert into public.homework_topics (id, group_id, title) values
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 'WP-2.3 fixture topic');

-- foreign_topic: a second teacher's group, which student_id is NOT a member
-- of — the AC4 / cross-group-isolation subject.
insert into public.teacher_groups (id, teacher_id, name) values
  ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', 'WP-2.3 foreign group');

insert into public.homework_topics (id, group_id, title) values
  ('66666666-6666-6666-6666-666666666666', '88888888-8888-8888-8888-888888888888', 'WP-2.3 foreign topic');

select set_config('wp23.student_id',     '11111111-1111-1111-1111-111111111111', true);
select set_config('wp23.teacher_id',     '22222222-2222-2222-2222-222222222222', true);
select set_config('wp23.other_teacher',  '33333333-3333-3333-3333-333333333333', true);
select set_config('wp23.owned_group_id', '44444444-4444-4444-4444-444444444444', true);
select set_config('wp23.topic_id',       '55555555-5555-5555-5555-555555555555', true);
select set_config('wp23.foreign_topic',  '66666666-6666-6666-6666-666666666666', true);
select set_config('wp23.fresh_user_id',  '77777777-7777-7777-7777-777777777777', true);

do $$
begin
  raise notice 'FIXTURES: student=%, teacher=%, other_teacher=%, owned_group=%, topic=%, foreign_topic=%, fresh_user=%',
    current_setting('wp23.student_id'), current_setting('wp23.teacher_id'),
    current_setting('wp23.other_teacher'), current_setting('wp23.owned_group_id'),
    current_setting('wp23.topic_id'), current_setting('wp23.foreign_topic'),
    current_setting('wp23.fresh_user_id');
end;
$$;
