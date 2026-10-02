# `WP-5.6` AI drafting Edge Functions — staged for `rubanwd/slay-city`

> **Nothing in this directory runs in this repository.** It is the deliverable of
> `SCN-14` and `SCN-18`, written here because this repository has no `supabase/`
> directory and never will ([AGENTS.md](../../../AGENTS.md), "Migrations belong
> upstream"). The web repository owns the migration timeline and the Edge
> Functions. Copy the tree below into it on a branch and open the pull request
> described in [UPSTREAM-PR-WP-5.6.md](../../UPSTREAM-PR-WP-5.6.md).
>
> Design and rationale: [EDGE-FUNCTIONS-PLAN.md](../../EDGE-FUNCTIONS-PLAN.md).
> Decision: **OD-1 — APPROVED**, 2026-09-29.
> Base read at upstream commit `7612da5`; re-verify before applying.
>
> Same staging pattern as [`../wp-2.3/`](../wp-2.3/) (`SCN-11`–`SCN-13`), and
> `web/` below is the successor of that package's `thin-callers/`.

## Scope

`SCN-14` implemented the two text functions the ticket named: `draft-vocabulary`
and `draft-grammar`. `SCN-18` adds the third, `generate-image`
(EDGE-FUNCTIONS-PLAN.md §4.4), which `SCN-14` and `SCN-15` deliberately left for a
later, explicitly-authorized ticket rather than guessing at its scope relative to
the first PR.

All three of `EDGE-FUNCTIONS-PLAN.md` §3.1's teacher-facing entry points are now
staged. What is **not** closed — by design, per §4.4's own deferral — is the
**admin** image generation callers (`generateLocationIcon.ts`,
`generateMapBackground.ts`, `generateTaskImage.ts`, `missionImageActions.ts`),
which still read `process.env.OPENROUTER_API_KEY` directly and are not ported
here. See [Limitations](#limitations-and-what-this-does-not-close).

## Where each file goes

| Staged here | Destination in `rubanwd/slay-city` |
| --- | --- |
| `20260930000010_ai_generation_rate_limit.sql` | `supabase/migrations/` |
| `down/20260930000010_…_down.sql` | not applied; kept for rollback |
| `functions/_shared/**` | `supabase/functions/_shared/**` |
| `functions/draft-vocabulary/**` | `supabase/functions/draft-vocabulary/**` |
| `functions/draft-grammar/**` | `supabase/functions/draft-grammar/**` |
| `functions/generate-image/**` | `supabase/functions/generate-image/**` |
| `tests/*.sql` | `supabase/tests/wp-5.6/` (same destination convention as `wp-2.3`) |
| `web/src/**` | over the matching paths in `src/**` |
| `config.toml.add` | appended into `supabase/config.toml` — see the file's header |

### Files to **delete** from `src/` in the same commit

Nothing imports them once `web/src/` is in place, and leaving them behind leaves a
second copy of a prompt and a second reader of `process.env.OPENROUTER_API_KEY`:

```
src/features/teacher/openRouterChat.ts        — requestOpenRouterJson + extractJson, moved to functions/_shared/openrouter.ts
src/features/teacher/grammarPrompt.ts         — moved to functions/_shared/prompts/grammarPrompt.ts
src/features/teacher/grammarPrompt.test.ts    — moved with it
src/features/teacher/vocabularyPrompt.ts      — buildWordImagePrompt moved to functions/_shared/prompts/vocabularyPrompt.ts; the file is now empty
src/features/teacher/vocabularyPrompt.test.ts — moved with it; the file is now empty
```

`grep -rn "openRouterChat\|grammarPrompt\|buildWordImagePrompt" src/` must come
back empty afterwards. `src/features/admin/openRouterImage.ts` is **not** in
either deletion list — its `requestOpenRouterImage` export still has four live
admin callers (see Limitations), so it stays, unmodified.

## What is here

### SQL — the rate limiter

| File | Adds |
| --- | --- |
| `20260930000010_ai_generation_rate_limit.sql` | `public.ai_generation_events` (append-only ledger, RLS on, **no policies and no grants to any PostgREST role**), `public.ai_window_retry_after(...)`, `public.claim_ai_generation(...)` (`SECURITY DEFINER`, `execute` granted to `service_role` only) |
| `down/20260930000010_…_down.sql` | drops all three |

Purely additive and independent of `../wp-2.3/`'s five files; the `000010` suffix
only keeps it lexically after them. Apply it whenever — nothing reads the ledger
until the functions are deployed.

Opening budgets, per teacher per kind, from EDGE-FUNCTIONS-PLAN.md §6.4:

| `kind` | / minute | / hour | / day |
| --- | --- | --- | --- |
| `draft_vocabulary` | 5 | 40 | 200 |
| `draft_grammar` | 5 | 40 | 200 |
| `generate_image` | 25 | 200 | 600 |

Plus a project-wide ceiling of 5 000/day as a circuit breaker. The image figure is
not a guess: `handleGenerateDraft()` with auto images on fires up to 20 image calls
immediately after a draft, so anything under ~20 breaks shipped behaviour. The
numbers live in SQL only — the TypeScript deliberately does not restate them.

### Functions

```
functions/
├── _shared/
│   ├── response.ts        taxonomy + jsonResponse/errorResponse      (pure)
│   ├── requestBody.ts     uuid / count / text validation             (pure)
│   ├── openrouter.ts      requestOpenRouterJson, extractJson         (pure, fetch injected)
│   ├── openrouterImage.ts requestOpenRouterImage, routing/fallback   (pure, fetch injected)
│   ├── wordKey.ts         normalizeWordKey                           (pure)
│   ├── teacherAuth.ts     role + topic-ownership resolution          (pure, ports injected)
│   ├── rateLimit.ts       claim_ai_generation wrapper, 429 message   (pure, ports injected)
│   ├── draftHandler.ts    THE GATE CHAIN for the two text functions  (pure)
│   ├── imageHandler.ts    THE GATE CHAIN for generate-image          (pure)
│   ├── edgeRuntime.ts     the ONLY file touching Deno or supabase-js
│   ├── testPorts.ts       test-only fake ports (draft + image)
│   ├── prompts/{vocabularyPrompt,grammarPrompt}.ts  (+ .test.ts)   moved from src/features/teacher/
│   └── drafts/{vocabularyDraft,grammarDraft}.ts     (+ .test.ts)   parsers moved from src/features/homework/
├── draft-vocabulary/{index.ts, spec.ts, index.test.ts}
├── draft-grammar/{index.ts, spec.ts, index.test.ts}
└── generate-image/{index.ts, index.test.ts}
```

`generate-image` has no `spec.ts`: unlike the two text functions it is the only
caller of its own gate chain, so there is nothing to parameterise yet (an admin
image variant would be the second caller, and is explicitly deferred — see
Limitations). Its body-parsing and response-building logic lives directly in
`imageHandler.ts` instead.

Each `index.ts` is a comment block plus `serveDraftFunction(spec)` /
`serveImageFunction()`. All the logic is in `spec.ts` / `imageHandler.ts` and
`_shared/`, none of which imports Deno or Supabase — which is what lets the tests
run under Node/Vitest, exactly as `update-streak/streak.ts` already does. The web
repo's `vitest.config.ts` `unit` project already includes
`supabase/functions/**/*.{test,spec}.ts`, so they run with no config change.

> The staged PR body says `deno test supabase/functions/`. That was written before
> the existing convention was read; `update-streak/index.test.ts` uses **vitest**,
> and so do these. `UPSTREAM-PR-WP-5.6.md` has been corrected.

**The gate chain, in order, is the security property** (`_shared/draftHandler.ts`,
`_shared/imageHandler.ts`): method → auth header → caller from JWT → body →
OpenRouter configured → teacher resolved → **topic ownership** → (image only:
**cache read-through**) → **quota claimed** → *the billed call* → parse / upload.
Everything above the billed call costs nothing. Every rejection test asserts the
outbound call count is zero, because money is spent at the API call and a gate
below it protects nothing.

`generate-image` is not built on `draftHandler.ts`'s `DraftSpec`/`DraftPorts`
abstraction: its cache read happens *before* the quota claim rather than after
the gates, and it ends in a Storage upload plus a cache upsert rather than a JSON
parse, so the existing `parseResponse(json)` step doesn't fit. `imageHandler.ts`
documents the two-step difference inline.

### Web (`web/src/`)

| File | Change |
| --- | --- |
| `features/teacher/aiDrafting.ts` | **new** by `SCN-14`; `SCN-18` adds `GenerateImageRequest`/`GenerateImageResponse`. |
| `lib/functionError.ts` | **new** — unwraps `FunctionsHttpError` so the function's own message survives `invoke()`. Without it every error reads "Edge Function returned a non-2xx status code". |
| `features/teacher/vocabularyActions.ts` | `generateVocabularyDraft` (`SCN-14`) and `generateWordImage` (`SCN-18`) both become thin callers. Same names, same inputs, same result types. |
| `features/teacher/grammarActions.ts` | `generateGrammarDraft` becomes a thin caller. |
| `features/teacher/vocabularyPrompt.ts` | **deleted** — `buildVocabularyPrompt` (`SCN-14`) and `buildWordImagePrompt` (`SCN-18`) are both moved; nothing is left in this file. |
| `features/teacher/vocabularyPrompt.test.ts` | **deleted** with it. |
| `features/homework/vocabulary.ts` | `parseGeneratedWords` removed (moved). Everything else — `buildVocabTest`, `clampWordCount`, `normalizeWordKey`, `defaultTestTaskCount` — untouched. `normalizeWordKey` still drives the UI; `generate-image` keeps its own copy server-side (`_shared/wordKey.ts`), the same `clampWordCount`-style duplication EDGE-FUNCTIONS-PLAN.md §4.5 already accepted. |
| `features/homework/grammar.ts` | `parseGeneratedGrammar` and the helpers only it used removed (moved). |
| `features/homework/{vocabulary,grammar}.test.ts` | the moved describes removed. |
| `features/teacher/{vocabularyActions,grammarActions}.test.ts` | the `SCN-12` files plus draft coverage (`SCN-14`) plus `generateWordImage` thin-caller coverage (`SCN-18`). |
| `lib/testSupabase.ts` | the `SCN-12` mock plus `functions.invoke`. |

`VocabularyManager.tsx` and `GrammarManager.tsx` are **not** in this list and need
no edit. That is the review's main assertion: the teacher-facing behaviour of the
web app does not change.

`web/src/features/teacher/{vocabularyActions,grammarActions}.ts` are built on the
`SCN-12` versions in `../wp-2.3/thin-callers/`, so **this package must be applied
after that one** — or the `WP-2.3` RPC calls in the publish paths will be reverted.

## Verifying

### Edge Function tests — run, and passing

Run from this repository (they need nothing but `vitest`, which is already a
dependency here):

```bash
cat > vitest.wp56.config.mts <<'EOF'
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["docs/migrations/wp-5.6/functions/**/*.test.ts"], environment: "node" },
});
EOF
npx vitest run --config vitest.wp56.config.mts
rm vitest.wp56.config.mts
```

`SCN-14` result: 8 files, 83 tests, all passing. `SCN-18` result, same command,
after adding `openrouterImage.ts`, `wordKey.ts`, `imageHandler.ts` and
`generate-image/`: **11 files, 138 tests, all passing.** Once copied into the web
repository they run as part of `npx vitest --project unit` with no config change.

The `web/src/**/*.test.ts` files are **not** runnable here — they need
`next/cache`, the real `@/lib/supabase/server` and the `@/` → `src/` alias, which
only exist upstream. Same caveat `../wp-2.3/thin-callers/README.md` records.

### Deno type-check and a live boot

```bash
docker run --rm -v "$PWD/docs/migrations/wp-5.6/functions:/app" -w /app \
  denoland/deno:latest deno check draft-vocabulary/index.ts draft-grammar/index.ts generate-image/index.ts
```

(On Git Bash for Windows, `MSYS_NO_PATHCONV=1` and `$(pwd -W)` instead of `$PWD`
— that is how it was run for `SCN-14`. `deno` itself is not installed locally.)

`SCN-14` result: both entry points check clean against the real
`npm:@supabase/supabase-js@2` types. The functions were then booted under the same
image with stub `SUPABASE_*` secrets and probed over HTTP; `GET` returned
`405 method_not_allowed` and an unauthenticated `POST` returned
`401 unauthorized` with the taxonomy body, so the entry points really do serve.

`SCN-18`: **not run** — no Docker daemon was reachable in that session
(`docker run` failed to connect to the engine). `generate-image/index.ts` is a
three-line wrapper around `serveImageFunction()`, the same shape the other two
entry points already passed this check in, and `edgeRuntime.ts`'s additions
(`createClients`, `createSharedPorts`, `createImagePorts`, `serveImageFunction`)
follow the existing `createDraftPorts` pattern with the same `npm:@supabase/supabase-js@2`
and `node:buffer` imports already in use there — but this is not a substitute for
running the check. Whoever opens the PR should run it before merging.

### SQL tests — run, and passing

Same harness as `../wp-2.3/` (plain `psql` + `DO` blocks, no pgTAP), reusing that
package's `tests/bootstrap.sql`, which is generic to the whole timeline:

```bash
psql -v ON_ERROR_STOP=1 -f ../wp-2.3/tests/bootstrap.sql
for f in $(ls supabase/migrations/*.sql | sort); do psql -v ON_ERROR_STOP=1 -f "$f"; done
psql -v ON_ERROR_STOP=1 -f 20260930000010_ai_generation_rate_limit.sql
psql -v ON_ERROR_STOP=1 -f tests/rate-limit-tests.sql
```

`SCN-14` result, against a fresh `postgres:16-alpine` container (removed
afterwards): bootstrap + all 67 upstream migrations + this migration applied with
zero edits, then `rate-limit-tests.sql` exited 0 with **22 `PASS`, 0 `FAIL`** —
grants, RLS, the `service_role`-only execute, the minute/hour/day windows, window
sliding, per-kind and per-teacher isolation, the 20-image batch, input validation,
and `on delete set null` on `topic_id`.

### Concurrency — run, and passing

`rate-limit-tests.sql` is one session and cannot test this, so it is driven from
the shell: 20 simultaneous `psql` connections each claiming once against
`draft_vocabulary`'s budget of 5/minute.

`SCN-14` result:

```
locked:   20 parallel claims against a budget of 5 -> granted=5  ledger_rows=5
unlocked: 20 parallel claims against a budget of 5 -> granted=20 ledger_rows=20
```

The second line is a deliberately weakened copy of the function with the advisory
lock removed (count-then-insert, as EDGE-FUNCTIONS-PLAN.md §6.3 describes it): it
grants **four times** the budget. This is why `claim_ai_generation` takes
`pg_advisory_xact_lock` on `(teacher_id, kind)` — "count and insert in one
statement" is necessary but not sufficient, because under READ COMMITTED each
transaction's snapshot excludes the other's uncommitted insert. The pair of
numbers is the evidence that the test detects a weakened limiter rather than
passing regardless.

## Deployment order

1. `supabase secrets set OPENROUTER_API_KEY=… OPENROUTER_TEXT_MODEL=… OPENROUTER_IMAGE_MODEL=… OPENROUTER_IMAGE_PROVIDER=…`
   — all four names and defaults are unchanged from the Server Actions
   (`google/gemini-2.5-flash`, `google/gemini-2.5-flash-image`,
   `google-ai-studio/flex`), so a model or tier change stays a deploy-time change.
2. Apply `20260930000010_ai_generation_rate_limit.sql`. Additive; safe before
   anything else is deployed.
3. Regenerate `src/types/database.ts` — the new table and function are not in it.
   Not required by any file in `web/src/` (the actions use `functions.invoke`, not
   `.rpc`), but the file is checked in and should not go stale.
4. `supabase functions deploy draft-vocabulary draft-grammar generate-image`.
5. Add the three blocks from `config.toml.add`.
6. Deploy the web app with `web/src/` applied and the five deletions made.
7. Verify in production, in the browser, before anything touches the phone —
   including a `vocab_image_cache` hit (`cached: true`, no OpenRouter call) and a
   miss (`cached: false`, image lands under `homework/<teacherId>/` in Storage).

Steps 2 and 4 are reversible in isolation. Step 6 is the only one that changes
teacher-visible behaviour, and it is a no-op if the functions are already live.

Rollback is `git revert` plus a redeploy; the functions can stay deployed
harmlessly once nothing calls them. Do **not** apply the `down/` migration while
the functions are deployed — `claim_ai_generation` disappearing makes every
drafting call a 500, by design (a rate limiter that fails open is not one).

## Limitations and what this does not close

- **The four admin image callers are not ported**, and never were meant to be
  by this package — EDGE-FUNCTIONS-PLAN.md §4.4 explicitly defers an admin
  `generate-image` variant to a follow-up PR, since the admin console is
  web-only and nothing native is blocked by leaving it. `generateLocationIcon.ts`,
  `generateMapBackground.ts`, `generateTaskImage.ts` and `missionImageActions.ts`
  still call `requestOpenRouterImage` from
  `src/features/admin/openRouterImage.ts` directly, which still reads
  `process.env.OPENROUTER_API_KEY`. So the **Vercel environment variable still
  cannot be deleted**, even after this package — `generateWordImage` was the
  only *teacher* caller of that key, and it is now closed, but WP-5.6's "the key
  exists in one place" end state needs the admin follow-up PR too. This is a
  tracked, dated exception, not an oversight: nothing is newly *exposed* by
  leaving it (that read is on the Next.js server, never in client-delivered
  code), and §4.4 made the same deferral call before any code existed to defer.
- **No `AGENTS.md` amendment is staged here.** The OD-1 rewording of the web
  manual's lines 303 / 463 / 482 is fixed verbatim in EDGE-FUNCTIONS-PLAN.md §2.2
  and belongs in the pull request, against that repository's own file.
- **Budgets are opening numbers.** They are set from the shipped UI's own call
  patterns, not from observed usage, and §6.4 says to tune them from
  `ai_generation_events` after a month.
- **The admin "view as teacher" path narrows.** `can_author_topic()` (WP-2.3) lets
  an admin author on any topic; these functions scope an admin to the topics of the
  teacher they named in `act_as_teacher_id`. In practice an admin only reaches the
  teacher console through "view as", so the console cannot produce a request this
  refuses — but it is a real difference and is commented in `teacherAuth.ts`.
- **No native code, for any of the three functions.** `@slay/data` wrappers,
  `packages/core` types and the binary-grep acceptance check
  (EDGE-FUNCTIONS-PLAN.md §7, §8 step 4) are the native half of `WP-5.6` and a
  separate item; they cannot be written against endpoints that are not deployed.
  Now that all three teacher-facing functions are staged, that native work has
  nothing left blocking it from the Edge Function side.
