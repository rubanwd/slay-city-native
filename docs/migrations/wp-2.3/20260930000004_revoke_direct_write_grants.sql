-- SLAY CITY — WP-2.3 (4/4): make the RPCs the only write path
--
-- Migrations 1/4 … 3/4 are additive: they add functions that enforce in SQL
-- what `requireTeacher`, `requireTopicAccess` and the onboarding action
-- enforce in TypeScript. Until the table grants go, a client can still skip
-- them — which is the whole reason this work package exists, because the
-- native app is exactly such a client.
--
-- This file removes the write privileges of `authenticated` on the eight
-- tables the audit covers. After it, every write in
-- `docs/native-app/DIRECT-WRITES.md` can only happen through a function in
-- 1/4 … 3/4, which re-checks the caller's role and scope first.
--
-- ORDER OF OPERATIONS. Apply this ONLY after the web app that calls the RPCs
-- is deployed. Applying it against the current web app breaks teacher
-- authoring, the Q&A thread and onboarding immediately. Rollback is
-- `down/20260930000004_revoke_direct_write_grants_down.sql`, which restores
-- every grant exactly as 1/4's base migrations created it, and is safe to run
-- at any time.
--
-- NO POLICY IS DROPPED OR WEAKENED HERE, deliberately (WP-2.3 AC6). The RLS
-- policies stay exactly as they are: a revoked grant and a policy are
-- independent controls, and keeping both means restoring a grant by mistake
-- cannot on its own open a hole. The SECURITY DEFINER functions are owned by
-- the migration role, so they need neither.
--
-- `select` is untouched everywhere. No read path changes.

-- =========================================================================
-- Teacher authoring — W-01 … W-03, W-06 … W-17
--
-- Replaced by create_homework_topic, update_homework_topic,
-- delete_homework_topic, publish_homework_vocabulary,
-- clear_homework_vocabulary, publish_homework_grammar and
-- clear_homework_grammar (1/4).
-- =========================================================================

revoke insert, update, delete on public.homework_topics from authenticated;
revoke insert, update, delete on public.homework_vocab_words from authenticated;
revoke insert, update, delete on public.homework_vocab_tasks from authenticated;
revoke insert, update, delete on public.homework_grammar_points from authenticated;
revoke insert, update, delete on public.homework_grammar_tasks from authenticated;

-- =========================================================================
-- Shared vocabulary image cache — W-05
--
-- Replaced by cache_vocab_image (1/4). There has never been a DELETE grant on
-- this table and this does not add one.
--
-- The Storage side of image generation (W-04, `content/homework/*`) is NOT
-- touched here: an object upload cannot run inside a Postgres function, so it
-- stays on the server behind the OD-1 `generate-image` Edge Function. The
-- cross-teacher overwrite/delete surface on that folder (finding F5) is a
-- policy change on `storage.objects` and is out of scope for this PR.
-- =========================================================================

revoke insert, update on public.vocab_image_cache from authenticated;

-- =========================================================================
-- Topic Q&A — W-18 … W-20
--
-- Replaced by post_topic_message, mark_topic_read and delete_topic_message
-- (2/4). `homework_topic_messages` has never had an UPDATE grant: a posted
-- message is not editable, and that stays true.
-- =========================================================================

revoke insert, delete on public.homework_topic_messages from authenticated;
revoke insert, update on public.homework_topic_reads from authenticated;

-- =========================================================================
-- Game statistics — W-22, finding F1
--
-- Replaced by create_my_profile (3/4) for onboarding and by the
-- `profiles_create_user_stats` trigger for every other provisioning path,
-- including the parent path in `features/auth/roleRouting.ts`, which is why
-- 3/4 must be applied first.
--
-- There has never been an UPDATE or DELETE grant on `user_stats` — XP, coins
-- and streaks only ever move through SECURITY DEFINER functions
-- (`complete_mission`, `complete_homework_vocab`, …). Removing INSERT closes
-- the last client-writable door on the table.
--
-- `profiles` keeps its INSERT grant: `ensureRoleProfile` needs it for the
-- parent and admin paths, and `profiles_prevent_role_insert_escalation`
-- (20260919000001) is what makes that safe. Table-level validation of
-- `username` is a separate change that needs a data audit first — see the PR
-- body.
-- =========================================================================

revoke insert on public.user_stats from authenticated;
