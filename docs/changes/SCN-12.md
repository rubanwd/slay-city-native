# SCN-12 — Refactor web teacher actions to call new RPCs instead of direct writes

> Type: task · Date: 2026-09-30

## Context

`SCN-6` audited the web app's teacher-authoring, Q&A and onboarding Server
Actions and found 21 direct table writes across five files, each authorized
today by a TypeScript guard that only exists on the Next.js server. `SCN-11`
wrote the SQL half of the fix: twelve `SECURITY DEFINER` RPCs that re-check
the same authorization in the database, staged (not applied) in
`docs/migrations/wp-2.3/`, because a native client talks to PostgREST directly
and never runs the guard. `SCN-11`'s own *Limitations* section named exactly
what was left: *"The TypeScript thin-caller pass is not done… the Server
Actions still issue their direct writes… `WP-2.3` `AC5` is not met until that
lands."* This item is that pass.

The ticket asks to edit five files in the web repository
(`rubanwd/slay-city`): `teacher/vocabularyActions.ts`,
`teacher/grammarActions.ts`, `teacher/actions.ts`, `homework/qa/actions.ts`
and `onboarding/actions.ts`. None of those files exist as editable, committable
files in *this* repository — `slay-city-native` has no web-app source tree.
The only copy reachable here is `upstream/`, a gitignored, read-only checkout
that `AGENTS.md` forbids editing, importing from, or committing
("Migrations belong upstream… Need a new RPC or Edge Function? Open a pull
request against the web repository."). `SCN-6`, `SCN-7` and `SCN-11` all hit
this same boundary before and answered it the same way: write the deliverable
here, staged for a pull request against the web repo, instead of touching
`upstream/`. This item follows that precedent — it is the TypeScript sibling
of `SCN-11`'s staged SQL, not a change to any file this repository owns.

## What was done

Ported all five action files, replacing every direct table write the `SCN-6`
audit named with the matching `SCN-11` RPC call, and staged them under
`docs/migrations/wp-2.3/thin-callers/src/`, mirroring the web repo's own
`src/` layout so they can be copied over 1:1. Each function keeps its exported
name, parameters and return type — no caller (form, client component) needs to
change. Read paths, client-side validation and error strings are all
unchanged; only the write itself moved from a `.from(table).insert/update/
delete/upsert(...)` call to a single `supabase.rpc(...)` call.

| File | Before → after |
| --- | --- |
| `teacher/actions.ts` | `createHomeworkTopic`, `updateHomeworkTopic`, `deleteHomeworkTopic`: direct `homework_topics` insert/update/delete → `create_homework_topic` / `update_homework_topic` / `delete_homework_topic` |
| `teacher/vocabularyActions.ts` | `generateWordImage`'s cache write: direct `vocab_image_cache` upsert → `cache_vocab_image`. `publishVocabulary`: four round-trips (delete words, delete tasks, insert words, insert tasks) → one `publish_homework_vocabulary` call. `clearVocabulary`: two deletes → one `clear_homework_vocabulary` call |
| `teacher/grammarActions.ts` | `publishGrammar`: four round-trips → one `publish_homework_grammar` call. `clearGrammar`: two deletes → one `clear_homework_grammar` call |
| `homework/qa/actions.ts` | `postTopicMessage` → `post_topic_message`. `markTopicRead` → `mark_topic_read`. `deleteTopicMessage` → `delete_topic_message` |
| `onboarding/actions.ts` | `createProfile`'s two inserts (`profiles`, then `user_stats`) → one `create_my_profile` call |

Everything else in these five files is untouched: `generateVocabularyDraft`,
`generateGrammarDraft`, `generateWordImage`'s AI call, `copyVocabularyFromTopic`
and `copyGrammarFromTopic` write nothing, and `generateWordImage`'s Storage
upload (audit operation W-04) cannot run inside a Postgres function — it stays
a direct `storage.upload()` call and moves server-side only when the `WP-5.6`
Edge Function lands. `requireTeacher()`, `requireTopicAccess()` and every
`.select()` read are unchanged; RLS already governed them and `SCN-12` is
scoped to writes.

### Behaviour before → after

Every successful flow returns the same value with the same message, because
the TypeScript-side validation (`parseNonNegativeInt`, `parseOptionalUrl`,
word/point trimming and filtering, `checkUsername`, the age range, the level
re-check) is untouched and runs before the RPC call, exactly as it ran before
the direct write. Four failure paths change, all inherited from the RPCs
`SCN-11` wrote and now reachable from the web UI for the first time:

- `updateHomeworkTopic` on a topic the caller doesn't own: was
  `{ success: 'Topic "…" updated.' }` with nothing changed; now
  `{ error: "Topic not found or not yours to edit." }`.
- `deleteTopicMessage` on a message the caller may not delete: was
  `{ ok: true }` with nothing changed; now
  `{ ok: false, error: "That message is not yours to delete." }`. The UI only
  renders the delete button on the caller's own messages, so no legitimate
  flow observes this.
- `publishVocabulary` / `publishGrammar` failing partway through: the four
  round-trips were not transactional, so a mid-failure could leave a topic
  with no words/points. The single RPC call is one transaction: it either
  fully succeeds or changes nothing.
- An over-long task list: already unreachable from the web UI (the action
  clamps to `MAX_TASK_COUNT` / `MAX_GRAMMAR_TASKS` before calling the RPC);
  matters only for a caller that skips this file, which now gets a clean
  rejection instead of a silent truncation.

Authorization failures throughout surface the RPC's own message (e.g. "Topic
not found or not yours to edit.", "That message is not yours to delete.",
"Only teachers can manage homework.") — the same friendly strings the direct
writes' RLS-driven paths already used, never a raw Postgres error.

### Tests

The web repository has no existing pattern for testing a Server Action
against a mocked Supabase client — every `*.test.ts` file under
`upstream/src/features/` covers a pure logic module. `src/lib/testSupabase.ts`
introduces the smallest mock that fits what these five files call:
`.auth.getUser()`, `.from(table).select().eq().order().maybeSingle()` (one
canned row per table), and `.rpc(name, args)`. One success test and one
authorization-failure test were written per action area, per the ticket's
step 4, plus a couple of extras where the ownership-check behaviour change
was worth pinning directly:

- `teacher/actions.test.ts` — `createHomeworkTopic` success (asserts the exact
  `create_homework_topic` RPC args); a non-teacher rejected by
  `requireTeacher()` before the RPC is ever called; `updateHomeworkTopic`
  surfacing a `42501` ownership rejection from the RPC cleanly.
- `teacher/vocabularyActions.test.ts` — `publishVocabulary` success (asserts
  one `publish_homework_vocabulary` call, and that `homework_vocab_words` /
  `homework_vocab_tasks` are never touched directly); a non-owning teacher
  rejected before the RPC call; `clearVocabulary` success.
- `teacher/grammarActions.test.ts` — the same three cases for
  `publishGrammar` / `clearGrammar`.
- `homework/qa/actions.test.ts` — `postTopicMessage` success (trims the body,
  asserts the exact RPC args); `deleteTopicMessage` surfacing the RPC's
  `42501` cleanly instead of the old silent `{ ok: true }` no-op.
- `onboarding/actions.test.ts` — `createProfile` success (asserts one
  `create_my_profile` call and a redirect to `/map`, and that `profiles` /
  `user_stats` are never inserted directly); an expired session rejected
  before the RPC is ever called.

## Changes by file

- `docs/migrations/wp-2.3/thin-callers/README.md` — (new) what this directory
  is, the file-by-file mapping, what changed vs. what was deliberately left
  alone, the four behaviour changes a reviewer should expect, and why the
  tests here are staged but unrun.
- `docs/migrations/wp-2.3/thin-callers/src/features/teacher/actions.ts` —
  (new) `createHomeworkTopic`, `updateHomeworkTopic`, `deleteHomeworkTopic`
  ported to call `create_homework_topic` / `update_homework_topic` /
  `delete_homework_topic`.
- `docs/migrations/wp-2.3/thin-callers/src/features/teacher/actions.test.ts`
  — (new) tests above.
- `docs/migrations/wp-2.3/thin-callers/src/features/teacher/vocabularyActions.ts`
  — (new) `generateWordImage`'s cache write, `publishVocabulary`,
  `clearVocabulary` ported; `generateVocabularyDraft`, the AI call and the
  Storage upload in `generateWordImage`, and `copyVocabularyFromTopic`
  unchanged from `upstream/`.
- `docs/migrations/wp-2.3/thin-callers/src/features/teacher/vocabularyActions.test.ts`
  — (new) tests above.
- `docs/migrations/wp-2.3/thin-callers/src/features/teacher/grammarActions.ts`
  — (new) `publishGrammar`, `clearGrammar` ported; `generateGrammarDraft` and
  `copyGrammarFromTopic` unchanged.
- `docs/migrations/wp-2.3/thin-callers/src/features/teacher/grammarActions.test.ts`
  — (new) tests above.
- `docs/migrations/wp-2.3/thin-callers/src/features/homework/qa/actions.ts` —
  (new) `postTopicMessage`, `markTopicRead`, `deleteTopicMessage` ported.
- `docs/migrations/wp-2.3/thin-callers/src/features/homework/qa/actions.test.ts`
  — (new) tests above.
- `docs/migrations/wp-2.3/thin-callers/src/features/onboarding/actions.ts` —
  (new) `createProfile` ported to call `create_my_profile`.
- `docs/migrations/wp-2.3/thin-callers/src/features/onboarding/actions.test.ts`
  — (new) tests above.
- `docs/migrations/wp-2.3/thin-callers/src/lib/testSupabase.ts` — (new)
  shared mock Supabase client the five test files use.
- `docs/UPSTREAM-PR-WP-2.3.md` — (modified) the status banner now points to
  the staged thin callers; the "Thin callers — the TypeScript side" section
  notes they are written; the pre-open checklist gained a line marking `AC5`
  resolved (written, not yet run against the web repo's own test runner).
- `tsconfig.json` — (modified) added `"docs"` to `exclude`. Without it,
  `tsc --noEmit`'s `**/*.ts` include swept up the newly staged files under
  `docs/migrations/wp-2.3/thin-callers/`, which import `next/cache`,
  `next/navigation` and `@/lib/supabase/server` — none of which exist in this
  Expo project — and broke `npm run type-check` for the whole repository.
  `docs/` had no `.ts` files before this change, so nothing existing loses
  coverage.
- `eslint.config.js` — (modified) added `"docs/"` to the root `ignores` array,
  for the same reason and with the same "nothing existing was linted from
  here before" justification.
- `docs/changes/SCN-12.md` — (new) this file.

## Technical decisions

- **Staged under `docs/migrations/wp-2.3/thin-callers/`, not written into
  `upstream/`.** `AGENTS.md` is explicit and absolute: "never import from it,
  never edit it, never commit it" — it is gitignored specifically so a stale
  snapshot can never be committed here. The ticket's own instructions
  (*"If the item cannot be implemented as specified… do not invent the
  missing answer. Implement whatever part is genuinely buildable"*) describe
  exactly this situation: the buildable part is the ported TypeScript itself,
  and the deliverable is where `SCN-11` already put its SQL counterpart —
  next to the migrations it calls, ready to be copied into the web repo on
  the same branch.
- **Kept `requireTeacher()` / `requireTopicAccess()` as the first check, not
  removed in favor of the RPC alone.** The ticket asks to "preserve existing…
  permission checks." These calls are reads (`.from("profiles").select("role")`,
  `.from("homework_topics").select("id, group_id")`), not writes, so they are
  outside `SCN-12`'s scope either way, and keeping them preserves the exact
  "You must be signed in." vs. "Only teachers can manage homework." UX
  distinction the web app has today. The RPC's own `can_author_group` /
  `can_author_topic` check is what actually closes the gap for a client that
  skips this file — the two checks are intentionally redundant, the same
  defense-in-depth relationship `requireTeacher()` already had with RLS.
- **Kept all client-side validation, even though the RPC re-validates the
  same rules.** Removing it would trade an instant, worded error for a round
  trip to get the identical message back from Postgres — a regression in
  perceived responsiveness for zero behavioural gain, and the ticket asks to
  preserve "existing input validation… and error messaging."
- **`words` and `tasks` (or `points` and `tasks`) are still filtered/built in
  TypeScript before the RPC call**, rather than sending the raw form input
  and letting `publish_homework_vocabulary` / `publish_homework_grammar` do
  all the filtering. The RPC's filter is idempotent on already-filtered input
  (trimming an already-trimmed string, keeping already-non-empty entries), so
  this preserves the exact early-exit behaviour ("Add at least one word with
  a translation before publishing.") without a network round trip for the
  common validation-failure case, while the RPC's own filtering remains the
  guarantee for a caller that sends unfiltered input directly.
- **The Storage upload in `generateWordImage` was left as a direct call.**
  Operation W-04 in the audit is explicit that an object upload cannot run
  inside a `SECURITY DEFINER` Postgres function; `SCN-11`'s migrations never
  attempted an RPC for it, so there is nothing for this item to swap it for.
  It stays out of scope here and moves only when `WP-5.6`'s Edge Function
  lands.
- **`tsconfig.json` and `eslint.config.js` now exclude `docs/`.** Discovered
  by actually running `npm run type-check` and `npm run lint` after staging
  the files (see *How to verify*) rather than assumed: the broad `**/*.ts`
  include had no reason to expect non-project TypeScript to ever live under
  `docs/`, because until this item nothing did. Excluding the directory is
  narrower and more honest than deleting the `.ts` extension or renaming the
  files to something eslint/tsc wouldn't recognize, which would have made
  them harder to read as the TypeScript they are.

## Data, API and configuration

**No change to this repository's schema, runtime dependencies, or Supabase
project.** No `package.json` dependency was added or changed.

For the web repository, once the staged files in
`docs/migrations/wp-2.3/thin-callers/src/` are copied into place (after the
`docs/migrations/wp-2.3/*.sql` migrations 1/4–3/4 are applied, and before
migration 4/4 — see that directory's `README.md`, *Deployment order*): the
five Server Action files call twelve `supabase.rpc(...)` functions instead of
issuing direct PostgREST writes. No new environment variable, feature flag, or
web-repo dependency is introduced — `supabase.rpc` is already how
`set_my_knowledge_level` and other existing calls in the same codebase work.

## How to verify

- **`npm run type-check`, `npm run lint`, `npm test`** all run in this
  repository after the change. Each reports the same single pre-existing
  failure already on `main` and documented in `docs/changes/SCN-11.md`:
  `packages/tokens/src/typography.ts` declares `fluidFontSize` twice (lines 34
  and 178), which breaks the ESLint `import/export` rule, gives
  `TS2300`/`TS2323`/`TS2393` type errors, and makes
  `packages/tokens/src/typography.test.ts` fail to parse under Vitest/Rolldown.
  `git diff HEAD -- packages/tokens/` is empty for this item. **185 of 185
  tests that run pass; 17 of 18 test files pass** — identical to `SCN-11`'s
  numbers, confirming this item added no regression.
- **Confirmed the new staged files are actually excluded, not just
  untouched-by-luck.** Before adding `docs` to `tsconfig.json`'s `exclude`,
  `npm run type-check` additionally failed on the new files' unresolved
  `next/cache`, `next/navigation` and `@/lib/supabase/server` imports (this
  project's `@/*` alias points at `packages/core/src`, not a Next.js tree).
  After the exclusion, re-running `npm run type-check` and `npm run lint`
  reproduced only the pre-existing `typography.ts` failure above — the fix
  was verified by seeing the error disappear, not assumed.
- **The five `*.test.ts` files under `docs/migrations/wp-2.3/thin-callers/`
  have not been executed.** They cannot be: this repository's
  `vitest.config.mts` scopes to `packages/**/*.test.ts` and has no `@/ ->
  src/` alias into a Next.js tree, and the runtime these tests need
  (`next/cache`, `next/navigation`, `@/lib/supabase/server`,
  `@/features/levels/queries`, `@/features/profile/username`, …) only exists
  in the web repository. Each test was written and re-read against the exact
  `upstream/` source and the exact RPC signatures in
  `docs/migrations/wp-2.3/2026093000000{1,2,3}_*.sql` it exercises, matching
  argument names, argument order and error codes/messages line for line, but
  running them is a step for whoever opens the PR in `rubanwd/slay-city` — see
  the command in `docs/migrations/wp-2.3/thin-callers/README.md`.
- **Manual read-through against the RPC signatures.** Every `p_*` argument
  name and shape sent by each ported action was checked against the
  corresponding `create or replace function` in
  `docs/migrations/wp-2.3/20260930000001_teacher_authoring_rpcs.sql`,
  `…0002_homework_qa_rpcs.sql` and `…0003_onboarding_profile_rpc.sql` — for
  example, `p_words` entries are `{ word, transcription, translation,
  image_url }` (snake_case, matching the SQL's `jsonb_array_elements`
  destructuring), and `update_homework_topic` is never sent a `group_id`,
  matching the function's signature, which doesn't accept one.

## Limitations and follow-ups

- **Not applied, not opened.** Like `SCN-11`'s SQL, this is staged code, not a
  live change. Nothing in the web app or the Supabase project is different
  after this item; `docs/UPSTREAM-PR-WP-2.3.md` is still marked
  "Status: NOT OPENED."
- **The five new test files are unexecuted**, per *How to verify* above.
  Whoever opens the upstream PR should run them against the web repo's real
  `vitest.config.ts` before merging, not just trust this item's read-through.
- **`docs/` is now excluded from this repository's `tsconfig.json` and
  `eslint.config.js`.** This is a permanent, small footprint change to this
  repo's own configuration, made necessary by staging TypeScript (rather than
  SQL or Markdown) under `docs/` for the first time. Future staged
  deliverables of any kind under `docs/` inherit this exclusion; if `docs/`
  ever needs to hold TypeScript that *should* be type-checked here, this
  exclusion will need to be scoped more narrowly (e.g. to
  `docs/migrations/**`) instead of removed outright.
- **Storage upload W-04 is still a direct write, on purpose** — see
  *Technical decisions*. Not part of `WP-2.3`; tracked under `WP-5.6`.
- **Findings the `SCN-6` audit left open are still open**: cross-teacher
  exposure on `vocab_image_cache` and `content/homework/` (§7.1), no
  table-level `CHECK` on `profiles.username` (§6.4), and cleaning up any
  already-forged `user_stats` values (unknown U-3). None of these are
  `WP-2.3` writes this item touches; they are unchanged by this pass, exactly
  as `SCN-11`'s *Limitations* already recorded.
