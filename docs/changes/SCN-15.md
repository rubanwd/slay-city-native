# SCN-15 — Switch web AI drafting Server Actions to call new Edge Functions

> Type: task · Date: 2026-10-02 (resolved; originally blocked 2026-10-01)

## Context

`WP-5.6` moves the web app's AI drafting off direct OpenRouter calls and onto
Supabase Edge Functions, because `OD-1` (approved 2026-09-29) requires it: a
mobile binary cannot hold `OPENROUTER_API_KEY`, so the call has to move off
every client, including the browser's. The ticket asks for the web
repository's Server Action modules that call OpenRouter directly to be
switched to call Edge Functions instead, preserving UI behaviour, with dead
OpenRouter code removed and tests added.

This repository (`slay-city-native`) has no `supabase/` directory and never
will — `AGENTS.md` states "Migrations belong upstream." The web repository
(`rubanwd/slay-city`) owns the Server Actions, the Edge Functions and the
migration timeline; this repo can only **stage** the changed files for a
human to copy across as a pull request, the same pattern `SCN-11`–`SCN-14`
already established for `WP-2.3` and `WP-5.6`.

## What was found (this round)

The prior round (2026-10-01) implemented and staged `draft-vocabulary` /
`draft-grammar` thin callers (`SCN-14`), then found that this ticket's broad
acceptance criterion — "No Server Action directly uses `OPENROUTER_API_KEY`"
— was not fully met: `generateWordImage` in the same
`vocabularyActions.ts` still called `requestOpenRouterImage` because the
third planned function, `generate-image`, did not exist yet. That round
ended **BLOCKED**, and a sub-item (`SCN-15-1`) asked the maintainer to decide
whether closing `generateWordImage` was in this ticket's scope.

Since then, `SCN-18` (2026-10-02, commit `aae64d5`) built `generate-image`
end to end — gate chain, image transport, word-cache key, Storage scoping
fix, and the `cache_vocab_image` client-selection correctness fix — and
migrated `generateWordImage` to call it. I re-read the current staged tree to
confirm this actually closed the gap rather than trusting the commit message:

- `docs/migrations/wp-5.6/web/src/features/teacher/vocabularyActions.ts` —
  both `generateVocabularyDraft` (→ `draft-vocabulary`) and
  `generateWordImage` (→ `generate-image`) are thin
  `supabase.functions.invoke(...)` callers. Grepped the file for
  `OPENROUTER_API_KEY` / `requestOpenRouterImage` / `openRouterChat`: the only
  hits are in doc comments explaining what *used to* happen and *why* it no
  longer does.
- `docs/migrations/wp-5.6/web/src/features/teacher/grammarActions.ts` —
  `generateGrammarDraft` is a thin caller of `draft-grammar`; no OpenRouter
  references at all.
- `docs/migrations/wp-5.6/web/src/features/teacher/vocabularyActions.test.ts`
  — the only remaining `OPENROUTER_API_KEY` references are assertions that it
  is `undefined` in the test environment (proving the action never reads it),
  in both the `generateVocabularyDraft` and `generateWordImage` describe
  blocks.
- `docs/migrations/wp-5.6/README.md` and `docs/UPSTREAM-PR-WP-5.6.md` both
  now list all three functions (`draft-vocabulary`, `draft-grammar`,
  `generate-image`) as written, tested and staged, with `generate-image`'s
  own `[functions.generate-image]` block added to `config.toml.add`.

No teacher-facing Server Action in the staged tree reads
`process.env.OPENROUTER_API_KEY` or imports `requestOpenRouterImage` /
`openRouterChat` any more.

## What remains out of scope (by design, not oversight)

The **admin console** (`generateLocationIcon.ts`, `generateMapBackground.ts`,
`generateTaskImage.ts`, `missionImageActions.ts`) still calls
`requestOpenRouterImage` directly and still reads `OPENROUTER_API_KEY`. This
is not a gap this ticket leaves open by accident:

- This repository's own `CLAUDE.md` states "The admin console stays
  web-only" — it never ships in a mobile binary, so `OD-1`'s actual security
  concern (a key extractable from an `.ipa`/`.aab`) does not apply to it the
  way it did to `generateWordImage`, which a native teacher console will
  eventually need to call too.
- `EDGE-FUNCTIONS-PLAN.md` §4.4 explicitly scopes porting the admin callers
  to a separate follow-up PR, not this one.
- `SCN-15-1`, the sub-item that unblocked this ticket, asked specifically
  about `generateWordImage` — the admin console was never raised as part of
  that scope question, so treating it as in-scope now would be re-opening a
  decision nobody asked this ticket to make.

The Vercel `OPENROUTER_API_KEY` environment variable therefore still cannot
be deleted after the `WP-5.6` PR merges — only the **teacher-facing**
drafting and image-generation paths are closed, which is what this ticket's
steps (and the mobile-binary security rationale behind `OD-1`) actually
required.

## Changes by file

None in this round. `docs/migrations/wp-5.6/` already contains everything
this ticket needs, delivered across `SCN-14` (commit `90df2e6`) and `SCN-18`
(commit `aae64d5`). This round re-verified the staged tree against the
ticket's acceptance criteria and rewrote this change doc to record the
resolution; no source file was added, modified or deleted.

## Technical decisions

- Did not re-implement or duplicate any file `SCN-14`/`SCN-18` already
  staged — re-writing already-correct, already-tested files would add risk
  with no behavioural change.
- Did not fold the admin console's OpenRouter callers into this ticket's
  scope. That boundary was already decided in `EDGE-FUNCTIONS-PLAN.md` §4.4
  and is consistent with this repository's `CLAUDE.md` ("admin console stays
  web-only"); nothing in this round's re-investigation surfaced a reason to
  revisit it.

## Data, API and configuration

None changed this round. See `docs/changes/SCN-14.md` for the
`draft-vocabulary` / `draft-grammar` contracts and `docs/changes/SCN-18.md`
for the `generate-image` contract — both already cover this ticket's full
scope.

## How to verify

- `npm run type-check` in this repository — passes (`tsconfig.json` excludes
  `docs/`, so this confirms the staged tree doesn't leak into this app's own
  build, not that the staged Deno code type-checks under Deno).
- Grepped `docs/migrations/wp-5.6/web/src` for `OPENROUTER_API_KEY`: the only
  matches are in `vocabularyActions.ts` doc comments (explaining the key is
  *no longer* read there) and `vocabularyActions.test.ts` assertions that it
  is `undefined` — no executable read of the key remains in any teacher
  Server Action.
- Re-read `vocabularyActions.ts` and `grammarActions.ts` in full: every
  exported action is now either a `supabase.functions.invoke(...)` call or an
  unrelated RPC/`.from()` call (`publishVocabulary`, `clearVocabulary`,
  `copyVocabularyFromTopic`) that never touched OpenRouter.

## Limitations and follow-ups

- Admin console image generation (`generateLocationIcon`,
  `generateMapBackground`, `generateTaskImage`, `missionImageActions`) still
  reads `OPENROUTER_API_KEY` directly — tracked as a separate follow-up PR by
  `EDGE-FUNCTIONS-PLAN.md` §4.4, out of this ticket's scope by design (see
  above).
- Nothing in `docs/migrations/wp-5.6/` is deployed; a human still has to open
  the pull request against `rubanwd/slay-city` and copy the staged tree in,
  per the deployment order in `docs/migrations/wp-5.6/README.md` (now
  including all three functions).
- `deno check` has still not been run against the staged functions (no Docker
  daemon available in any session so far) — tracked in both
  `docs/migrations/wp-5.6/README.md` and `docs/UPSTREAM-PR-WP-5.6.md` as a
  pre-merge checklist item.
