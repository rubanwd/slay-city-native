// SLAY CITY — `generate-image` Edge Function.
//
// Generates (or reuses, via `vocab_image_cache`) a flashcard illustration for
// one vocabulary word and uploads it to the `content` Storage bucket.
//
// Replaces `generateWordImage` in `src/features/teacher/vocabularyActions.ts`,
// which read `OPENROUTER_API_KEY` from `process.env` on the Next.js server —
// safe on the web, impossible on a phone. Decision `OD-1`, approved
// 2026-09-29. Closes `EDGE-FUNCTIONS-PLAN.md` §4.4, the one AI entry point
// `SCN-14` (`draft-vocabulary` / `draft-grammar`) deliberately left out of
// scope.
//
// Also closes the same live authorization gap those two functions closed:
// the Server Action's only gate was `requireTeacher()` plus a topic read, and
// `homework_topics_select` grants `is_group_member(group_id)` — so every
// student in a group can read their teacher's topics, and the read proved
// nothing. Role *and* ownership are now re-checked in the database before any
// outbound request, and the `vocab_image_cache` read-through happens before
// the rate-limit quota is claimed, so a cache hit costs neither money nor
// quota.
//
// Runtime: Deno (Supabase Edge Runtime). All of the logic is in
// `../_shared/imageHandler.ts` and its siblings, which are dependency-free and
// unit-tested under Node/Vitest — the same split `update-streak/streak.ts`
// uses. `verify_jwt = true` in `supabase/config.toml`.

import { serveImageFunction } from "../_shared/edgeRuntime.ts";

serveImageFunction();
