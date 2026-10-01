// SLAY CITY — `draft-vocabulary` Edge Function.
//
// Drafts a vocabulary word set for a homework topic via OpenRouter. Writes
// nothing: the words come back for the teacher to review, illustrate and
// publish.
//
// Replaces `generateVocabularyDraft` in `src/features/teacher/vocabularyActions.ts`,
// which read `OPENROUTER_API_KEY` from `process.env` on the Next.js server. That
// is safe on the web and impossible on a phone — a key compiled into an `.ipa` or
// `.aab` is extractable in minutes and bills to the project owner. So the call
// moves here, where the key lives in Supabase Secrets and never leaves the Deno
// isolate. Decision `OD-1`, approved 2026-09-29.
//
// It also closes a live authorization gap: the Server Action's only gate was
// `requireTeacher()` plus a topic read, and `homework_topics_select` grants
// `is_group_member(group_id)` — so every student in a group can read their
// teacher's topics, and the read proved nothing. Role *and* ownership are now
// re-checked in the database before any outbound request.
//
// Runtime: Deno (Supabase Edge Runtime). All of the logic is in `./spec.ts` and
// `../_shared/`, which are dependency-free and unit-tested under Node/Vitest —
// the same split `update-streak/streak.ts` uses. `verify_jwt = true` in
// `supabase/config.toml`.

import { serveDraftFunction } from "../_shared/edgeRuntime.ts";

import { draftVocabularySpec } from "./spec.ts";

serveDraftFunction(draftVocabularySpec);
