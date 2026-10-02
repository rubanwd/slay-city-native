# SCN-15 — Switch web AI drafting Server Actions to call new Edge Functions

> Type: task · Date: 2026-10-01

## Context

`WP-5.6` moves the web app's AI drafting off direct OpenRouter calls and onto
Supabase Edge Functions, because `OD-1` (approved 2026-09-29) requires it: a
mobile binary cannot hold `OPENROUTER_API_KEY`, so the call has to move off
every client, including the browser's. The ticket asks for the web
repository's Server Action modules that call OpenRouter directly to be
switched to call `draft-vocabulary` and `draft-grammar` instead, preserving
UI behaviour, with dead OpenRouter code removed and tests added.

This repository (`slay-city-native`) has no `supabase/` directory and never
will — `AGENTS.md` states "Migrations belong upstream." The web repository
(`rubanwd/slay-city`) owns the Server Actions, the Edge Functions and the
migration timeline; this repo can only **stage** the changed files for a
human to copy across as a pull request, the same pattern `SCN-11`–`SCN-14`
already established for `WP-2.3` and `WP-5.6`.

## What was found

`SCN-14` (2026-10-01, same day) already implemented exactly what this
ticket's five steps ask for, scoped to the two functions the ticket names:

- `docs/migrations/wp-5.6/web/src/features/teacher/vocabularyActions.ts` —
  `generateVocabularyDraft` is a thin caller of `draft-vocabulary`
  (`supabase.functions.invoke("draft-vocabulary", { body })`). No
  `openRouterChat`, `buildVocabularyPrompt` or `parseGeneratedWords` import
  remains in it.
- `docs/migrations/wp-5.6/web/src/features/teacher/grammarActions.ts` — same
  for `generateGrammarDraft` / `draft-grammar`.
- `docs/migrations/wp-5.6/web/src/lib/functionError.ts` —
  `readFunctionError()`, the `FunctionsHttpError` → `{ code, message }`
  mapping the UI needs so `toast.error(result.error)` keeps showing the
  function's real message instead of "Edge Function returned a non-2xx
  status code".
- `docs/migrations/wp-5.6/README.md` names the three dead files to delete
  from `src/` in the same upstream commit: `openRouterChat.ts`,
  `grammarPrompt.ts`, `grammarPrompt.test.ts` (moved into
  `functions/_shared/`).
- `docs/migrations/wp-5.6/web/src/features/teacher/{vocabularyActions,
  grammarActions}.test.ts` cover both the success path and the failure path
  (function unreachable, function returns an error body, degrades to the
  existing draft on screen).

I re-read every staged file against this ticket's acceptance criteria and
confirmed there is nothing left to add for `draft-vocabulary` / `draft-grammar`:
no Server Action for vocabulary/grammar text drafting reads
`OPENROUTER_API_KEY`, the UI-facing result types and error surfacing are
unchanged, and tests exist for both outcomes. I ran this repository's own
gates (`npm run type-check`) to confirm the staged tree still leaves this
app's build untouched — it passes, as it did after `SCN-14` (`tsconfig.json`
excludes `docs/`).

## Why nothing new was written

The ticket's **acceptance criteria** say "No Server Action directly uses
`OPENROUTER_API_KEY`" — full stop, across the file set. But its **steps**
scope the work to exactly two functions, `draft-vocabulary` and
`draft-grammar`. A third Server Action, `generateWordImage` (in the same
`vocabularyActions.ts`), still calls `requestOpenRouterImage` from
`src/features/admin/openRouterImage.ts`, which still reads
`process.env.OPENROUTER_API_KEY` — confirmed by reading the staged file
(`docs/migrations/wp-5.6/web/src/features/teacher/vocabularyActions.ts:6,232`)
and by `docs/migrations/wp-5.6/README.md`'s own "Limitations" section, which
names this as the tracked reason the Vercel key cannot be deleted yet.

That gap is not an oversight for this ticket to close quietly. It is a
project-level decision already on record:

- `EDGE-FUNCTIONS-PLAN.md` §4.4 scopes `generate-image` into the `WP-5.6`
  pull request but explicitly treats porting the **admin** callers as a
  separate follow-up PR, and is silent on whether `generate-image` itself
  ships in the same PR as the two text functions or after.
- `docs/UPSTREAM-PR-WP-5.6.md`'s checklist already lists `generate-image`
  as unwritten and names it "the one blocker on this PR being complete."
- `docs/changes/SCN-14.md`'s own Limitations section records the same gap
  and explicitly defers it as native-repo-visible but out of `SCN-14`'s
  scope.

Writing `generate-image` now would be scope creep against this ticket's own
steps (which name only the two text functions) and would duplicate a
decision — "what ships in this PR vs. the next one" — that the project's
planning documents have already made and recorded with reasoning, not left
open. Inventing an answer here (either "fold it into SCN-15" or "declare the
acceptance criterion already met") would be guessing at a decision that is
the maintainer's to make explicitly, matching the brief's instruction not to
write code around an unresolved decision or invent the missing answer.

## Changes by file

None. `docs/migrations/wp-5.6/` already contains everything this ticket's
steps ask for, committed in `90df2e6`. No file was added, modified or
deleted by this round.

## Technical decisions

- Did not duplicate `SCN-14`'s staged `vocabularyActions.ts` /
  `grammarActions.ts` / `functionError.ts` — re-writing already-correct,
  already-tested files would add risk with no behavioural change.
- Did not implement `generate-image` to force-close the "no
  `OPENROUTER_API_KEY` in any Server Action" acceptance criterion — that
  function's scope and timing relative to this PR is an open point in the
  project's own planning docs, not something this ticket's steps authorize
  deciding unilaterally.

## Data, API and configuration

None — no files changed this round. (See `docs/changes/SCN-14.md` for the
`draft-vocabulary` / `draft-grammar` endpoint contracts, which already cover
this ticket's scope.)

## How to verify

- `npm run type-check` — passes (confirms the already-staged
  `docs/migrations/wp-5.6/` tree still leaves this repository's own build
  untouched; `tsconfig.json` excludes `docs/`).
- Re-read `docs/migrations/wp-5.6/web/src/features/teacher/vocabularyActions.ts`
  and `grammarActions.ts`: `generateVocabularyDraft` / `generateGrammarDraft`
  call `supabase.functions.invoke(...)` only; no `process.env.OPENROUTER_API_KEY`
  reference in either function.
- Re-read `docs/migrations/wp-5.6/web/src/features/teacher/{vocabularyActions,
  grammarActions}.test.ts`: both success and failure (unreachable function,
  function error body) are covered.

## Limitations and follow-ups

- `generateWordImage` in the same staged `vocabularyActions.ts` still calls
  `requestOpenRouterImage`, which still reads `OPENROUTER_API_KEY` via
  `process.env`. Closing this requires the `generate-image` Edge Function
  from `EDGE-FUNCTIONS-PLAN.md` §4.4, which is explicitly out of this
  ticket's named steps and already tracked as the one open item against
  `WP-5.6` in `docs/UPSTREAM-PR-WP-5.6.md` and `docs/changes/SCN-14.md`.
- Nothing in `docs/migrations/wp-5.6/` is deployed; per this repository's
  standing rule, a human still has to open the pull request against
  `rubanwd/slay-city` and copy the staged tree in, per the deployment order
  in `docs/migrations/wp-5.6/README.md`.
