# SCN-14 — Implement `draft-vocabulary` and `draft-grammar` Supabase Edge Functions

> Type: feature · Date: 2026-10-01

## Context

SLAY CITY's teacher console drafts homework with AI: a teacher names a topic, asks
for N vocabulary words or N grammar points, reviews what comes back, edits it and
publishes. On the web that call is a Next.js Server Action that reads
`OPENROUTER_API_KEY` from `process.env` and talks to OpenRouter directly. That is
safe, because the code runs on a server the user does not control.

There is no equivalent on a phone. A key compiled into an `.ipa` or an `.aab` is
extractable in minutes and bills to the project owner's OpenRouter account, so the
native teacher console cannot have the key — and the feature cannot ship without
the call. **`OD-1`**, approved 2026-09-29, resolves this by moving the call off
every client into Supabase Edge Functions that both apps invoke. It amends a rule
the web repository's `AGENTS.md` lists under *What Not to Change Without
Permission* ("All OpenRouter calls must go through Next.js Server Actions"), with
the rationale that the key cannot ship in a mobile binary. The intent is
strengthened rather than relaxed: the key stops being readable by the whole
Next.js server process and becomes readable only inside the Deno isolate.

The move also closes a **live authorization gap**. The three AI entry points write
nothing before they spend money, so no RLS policy is ever in their path. Their only
gate is `requireTopicAccess()` → `requireTeacher()` plus a `SELECT` on
`homework_topics` — and `homework_topics_select` grants
`is_group_member(group_id)`, so every student in a group can already read every one
of their teacher's topics. The topic lookup therefore proves nothing about the
caller, and `requireTeacher()` alone stands between a student and an OpenRouter
bill. There is also no rate limiting on AI spend anywhere in the project:
`grep -rl rate_limit supabase/migrations/` returns nothing.

`SCN-14` implements the two text functions the ticket names — `draft-vocabulary`
and `draft-grammar` — the SQL rate limiter they need, their tests, and the web-side
Server Actions rewritten as thin callers.

Because this repository has no `supabase/` directory and never will (`AGENTS.md`,
"Migrations belong upstream"), everything is **staged** under
`docs/migrations/wp-5.6/` to be copied into `rubanwd/slay-city` as a pull request,
the same way `SCN-11`–`SCN-13` staged `WP-2.3` under `docs/migrations/wp-2.3/`.

## What was done

### The request path, end to end

Before: `VocabularyManager.tsx` → `generateVocabularyDraft()` (Server Action) →
`requireTopicAccess()` → `buildVocabularyPrompt()` → `requestOpenRouterJson()`
(reads `process.env.OPENROUTER_API_KEY`) → `extractJson()` →
`parseGeneratedWords()`.

After: `VocabularyManager.tsx` → `generateVocabularyDraft()` (unchanged signature)
→ `supabase.functions.invoke("draft-vocabulary", { body })` → the Deno function →
nine gates → OpenRouter → a typed JSON body back. `VocabularyManager.tsx` and
`GrammarManager.tsx` are not touched, and no teacher-visible string changes.

Inside the function, `_shared/draftHandler.ts` runs one chain, and **the order is
the security property**:

1. `POST`, else `405 method_not_allowed`
2. `Authorization` header present, else `401 unauthorized`
3. caller resolved from the JWT with an **anon-key** client, else `401`
4. body parsed and validated, else `400 invalid_request`
5. `OPENROUTER_API_KEY` present, else `500 not_configured`
6. teacher resolved — `profiles.role = 'teacher'`, or `role = 'admin'` **and** a
   verified `act_as_teacher_id` — else `403 forbidden`
7. **topic ownership** via `homework_topics` → `teacher_groups.teacher_id`, else
   `403`. This read also supplies the topic title and description for the prompt
8. **rate-limit quota claimed** via `claim_ai_generation`, else `429 rate_limited`
   with `Retry-After`
9. *the only billed line in the function* — `requestOpenRouterJson()`
10. model output parsed; an empty result is `422 unusable_response`

Steps 1–8 cost nothing. Every rejection test asserts the outbound call count is
**zero**, because money is spent at step 9 and a gate below it protects nothing.

### Two gaps in the plan that had to be fixed

- **`topic_title` / `topic_description` are no longer accepted from the client.**
  The browser sends them today and they go straight into the prompt — a forged
  title is a forged prompt. The function reads them from `homework_topics` in the
  same query that proves ownership. The Server Action keeps the fields in
  `GenerateDraftInput` so the manager's call site is unchanged, and simply does not
  forward them.
- **"Count and insert in one statement" does not actually serialise.**
  `EDGE-FUNCTIONS-PLAN.md` §6.3 prescribes a single statement so two concurrent
  requests cannot both pass a separate `SELECT count(*)`. Under READ COMMITTED each
  transaction's snapshot still excludes the other's uncommitted insert, so a single
  `insert … select … where count < limit` races identically. `claim_ai_generation`
  therefore takes `pg_advisory_xact_lock` on `(teacher_id, kind)` first. This was
  not reasoned about and then asserted — it was **measured**: 20 parallel claims
  against a budget of 5 granted exactly 5 with the lock, and **20** against a
  lock-free copy of the same function.

### The rate limiter

`public.ai_generation_events` is an append-only ledger: `user_id` (who called),
`teacher_id` (whose budget), `kind`, `topic_id` (`on delete set null`, so deleting a
topic does not erase its spend history), `created_at`. RLS is on with **no policies
and no table grants to any PostgREST role — not even `service_role`**. That last
part is a deliberate tightening: `service_role` has `BYPASSRLS`, so a policy would
never have stopped a leaked service key; only the missing grant does. All access is
through `public.claim_ai_generation(...)`, `SECURITY DEFINER`, with `execute`
revoked from `public` and granted only to `service_role` — so a client holding the
anon key cannot call it, drain it, or skip it.

Budgets per teacher per kind: text 5/min · 40/h · 200/day; images 25/min · 200/h ·
600/day, plus a project-wide 5 000/day circuit breaker. The image per-minute figure
is set by shipped behaviour, not taste: `handleGenerateDraft()` with auto-images on
fires up to 20 image calls immediately after a draft, so anything under ~20 would
break the flow and look like a flaky model. The numbers live in SQL only; the
TypeScript deliberately does not restate them, because two copies of "5 per minute"
is how a limit stops matching the ledger it is counted from.

### Testability under Node, with a Deno runtime

`update-streak` is the house template, and its `streak.ts` / `index.ts` split is
what makes its logic unit-testable under Node while the handler runs under Deno.
The same split is applied here, harder: **every** `_shared` module is pure and
dependency-injected, and exactly one file — `_shared/edgeRuntime.ts` — reads
`Deno.env` or imports `npm:@supabase/supabase-js@2`. Each `index.ts` is a comment
block plus `serveDraftFunction(spec)`; the per-function parts live in a pure
`spec.ts` that the tests drive directly.

The staged PR body said to run `deno test supabase/functions/`. That was written
before the existing convention was read: `update-streak/index.test.ts` uses
**vitest**, and the web repo's `vitest.config.ts` `unit` project already includes
`supabase/functions/**/*.{test,spec}.ts`. These tests use vitest too, so they need
no new runner, and `docs/UPSTREAM-PR-WP-5.6.md` has been corrected.

### Error contract

One taxonomy, 13 codes, `{ error: { code, message } }` on every non-2xx. Every
message that exists in the product today is reproduced character for character
(`"The AI model took too long. Try again."`, `"AI generation is not configured on
this server."`, `"The AI didn't return any usable words. Try again."`, and
OpenRouter's own `error.message` verbatim for `upstream_error`, which is the only
thing that distinguishes bad key from no credit from provider rate limit). There is
no automatic retry at any layer: a timeout does not mean the request was not
served, so a retry can double a bill silently.

On the web side, `src/lib/functionError.ts` unwraps `FunctionsHttpError` —
`invoke()` does not put a non-2xx body in `error.message`, so without this helper
every one of those messages would collapse into "Edge Function returned a non-2xx
status code" and the taxonomy would be wasted.

## Changes by file

### New — SQL

- `docs/migrations/wp-5.6/20260930000010_ai_generation_rate_limit.sql` — new.
  `public.ai_generation_events` (ledger, two indexes, RLS on, all grants revoked),
  `public.ai_window_retry_after(uuid,text,interval)` (seconds until the oldest row
  in a window ages out, so a 429 can name a real wait), and
  `public.claim_ai_generation(uuid,uuid,text,uuid)` (advisory lock, three window
  counts, global ceiling, insert, `service_role`-only execute).
- `docs/migrations/wp-5.6/down/20260930000010_ai_generation_rate_limit_down.sql` —
  new. Drops all three, with a header warning that applying it while the functions
  are deployed turns every drafting call into a 500 by design.

### New — Edge Functions

- `functions/_shared/response.ts` — new. The 13-code taxonomy, its status map, the
  fixed message strings (marked "existing" where they already ship), and
  `jsonResponse` / `errorResponse`.
- `functions/_shared/requestBody.ts` — new. `isUuid`, `parseOptionalText`,
  `parseCount`, `parseDraftBase`. Rejects wrong types rather than coercing them —
  `String({})` is `"[object Object]"`, which would otherwise reach the model as
  teacher instructions.
- `functions/_shared/openrouter.ts` — new. The Deno port of `openRouterChat.ts`:
  same URL, model default, single-turn message, `response_format`, `X-Title` and
  60 s timeout, with the key and `fetch` injected rather than read from the
  environment. Carries `extractJson`, moved unchanged.
- `functions/_shared/teacherAuth.ts` — new. `resolveTeacherId` (role and verified
  `act_as_teacher_id`) and `resolveOwnedTopic` (ownership *and* the prompt's topic
  text). The file that closes the §6.2 gap.
- `functions/_shared/rateLimit.ts` — new. `claimAiGeneration`, `rateLimitMessage`,
  `retryAfterHeader`. Returns `null` when the ledger is unreachable, which the
  handler turns into a 500 — a rate limiter that fails open is not one.
- `functions/_shared/draftHandler.ts` — new. The shared gate chain, with the step
  order documented and justified.
- `functions/_shared/edgeRuntime.ts` — new. The only file touching Deno or
  supabase-js: the anon-key auth client, the service-role client, the two ownership
  reads, the `claim_ai_generation` RPC, structured logging, and
  `serveDraftFunction()`.
- `functions/_shared/testPorts.ts` — new, test-only. Fake ports that count outbound
  model calls, which is what lets every rejection test assert zero.
- `functions/_shared/prompts/vocabularyPrompt.ts` + `.test.ts` — **moved** from
  `src/features/teacher/vocabularyPrompt.ts`. Builder body byte-identical;
  `buildWordImagePrompt` deliberately left behind.
- `functions/_shared/prompts/grammarPrompt.ts` + `.test.ts` — **moved** unchanged
  from `src/features/teacher/grammarPrompt.ts`.
- `functions/_shared/drafts/vocabularyDraft.ts` + `.test.ts` — **moved**
  `parseGeneratedWords` from `src/features/homework/vocabulary.ts`, plus the
  `VocabDraftWord` / `DraftVocabularyResponse` wire types and the count bounds.
- `functions/_shared/drafts/grammarDraft.ts` + `.test.ts` — **moved**
  `parseGeneratedGrammar` (with `parseGrammarTask` and `asStringList`) from
  `src/features/homework/grammar.ts`. `GrammarTaskType` is narrowed to
  `"quiz" | "fill_blank"` so the union cannot drift wider than the parser.
- `functions/_shared/openrouter.test.ts`, `functions/_shared/requestBody.test.ts` —
  new. The transport had no tests upstream; a move is exactly the change that
  silently alters a request.
- `functions/draft-vocabulary/{index.ts, spec.ts, index.test.ts}` — new.
- `functions/draft-grammar/{index.ts, spec.ts, index.test.ts}` — new.

### New — SQL tests and config

- `tests/fixtures.sql` — new. Teacher / other-teacher / student profiles, a group
  and a topic, under fixed literal uuids, with `wp56.*` config vars set.
- `tests/rate-limit-tests.sql` — new. 22 checks across ten sections.
- `config.toml.add` — new. The two `[functions.*]` blocks to paste into
  `supabase/config.toml`, with `verify_jwt = true`.

### New — web (`docs/migrations/wp-5.6/web/src/`)

- `features/teacher/aiDrafting.ts` — new. The request shapes and error-code union
  both front ends share; the native app will mirror it as
  `packages/core/features/teacher/aiDrafting.ts`.
- `lib/functionError.ts` — new. `readFunctionError()`.

### Modified — web

- `features/teacher/vocabularyActions.ts` — `generateVocabularyDraft` is now a thin
  caller of `draft-vocabulary`. Same exported name, input and result type. Drops
  the `openRouterChat` / `buildVocabularyPrompt` / `parseGeneratedWords` imports and
  its `requireTopicAccess` call; forwards the admin view-as cookie as an explicit
  `act_as_teacher_id` field. Built on `SCN-12`'s version, so the `WP-2.3` RPC calls
  in `publishVocabulary` / `clearVocabulary` are preserved.
- `features/teacher/grammarActions.ts` — the same change for
  `generateGrammarDraft` / `draft-grammar`.
- `features/teacher/vocabularyPrompt.ts` — `buildVocabularyPrompt` removed (moved);
  `buildWordImagePrompt` and the `clean()` helper it needs stay, because
  `generateWordImage` is still a Server Action.
- `features/teacher/vocabularyPrompt.test.ts` — the `buildVocabularyPrompt` and
  `extractJson` describes removed (moved).
- `features/homework/vocabulary.ts` — `parseGeneratedWords` removed;
  `isRecord` / `asTrimmedString` kept, because `describeVocabTask` uses them.
  `buildVocabTest`, `clampWordCount`, `normalizeWordKey` and `defaultTestTaskCount`
  untouched.
- `features/homework/grammar.ts` — `parseGeneratedGrammar`, `parseGrammarTask` and
  `asStringList` removed; the draft interfaces, the counts,
  `GRAMMAR_TEST_TASK_TYPES` and `describeGrammarTask` untouched.
- `features/homework/{vocabulary,grammar}.test.ts` — the moved describes removed.
- `features/teacher/{vocabularyActions,grammarActions}.test.ts` — `SCN-12`'s files
  plus draft coverage: the invoked function name and body, count clamping, the
  view-as field, `readFunctionError` surfacing the function's own message, and
  graceful degradation when the function is unreachable.
- `lib/testSupabase.ts` — `SCN-12`'s mock plus `functions.invoke`.

### Documentation

- `docs/migrations/wp-5.6/README.md` — new. Scope, the file-to-destination map, the
  three `src/` files to **delete**, the budget table, the gate chain, every
  verification command with its actual result, the deployment order, and the
  limitations.
- `docs/UPSTREAM-PR-WP-5.6.md` — modified. Banner now says what is written and what
  is not; the Files list is annotated ✅/⬜ against what `SCN-14` produced; the test
  plan's `deno test` line is corrected to vitest and the completed items are
  checked with their results; two new checklist lines for `generate-image` and the
  `AGENTS.md` amendment.
- `docs/changes/SCN-14.md` — new. This file.

## Technical decisions

- **Pure modules + one Deno boundary, instead of Supabase calls scattered through
  `_shared/`.** The plan's `teacherAuth.ts` was sketched as
  `resolveTeacherCaller(req)`, which would have needed a `npm:` import and made the
  module unimportable under Vitest. Narrow injected ports instead mean the gate
  chain is testable, and — the point — a test can assert the outbound model call
  **never happened**, which is the one property a reviewer cannot verify by reading
  the handler top to bottom.
- **An advisory lock in `claim_ai_generation`.** Rejected the plan's
  single-statement approach because it does not serialise under READ COMMITTED, and
  proved the difference empirically rather than arguing it. Contention is scoped to
  one `(teacher_id, kind)` and held for microseconds; nothing slow runs inside it.
- **No grants on the ledger at all, including `service_role`.** The plan said "no
  policies and no grants to anon/authenticated". Extending the revoke to
  `service_role` costs nothing (the `SECURITY DEFINER` function runs as the owner)
  and means a leaked service key cannot pad or reset the ledger either.
- **The configuration check hoisted above the quota claim.** The plan has
  `not_configured` emerge from inside the OpenRouter call at step 9, which would
  burn a teacher's quota to tell them the server has no key. Moved to step 5. No
  teacher-visible string changes.
- **Move the prompts and parsers, do not copy them** (plan §4.5 option (c)). A
  second copy of a prompt is the failure mode `packages/core` exists to prevent,
  one repository over. The cost is that the moved modules re-declare `Json`,
  `MissionTaskType`'s grammar subset and `VocabDraftWord` locally, because Deno
  cannot resolve `@/types/database`. Those are type *declarations*, not logic, and
  `index.test.ts` pins the wire shape so a drift has to be deliberate.
- **Two explicit reads for ownership, not one PostgREST embed.**
  `teacher_groups!inner(teacher_id)` depends on the FK's generated relationship
  name; a rename upstream would silently turn the ownership filter into no filter.
  Two equality reads on primary keys cannot fail that way.
- **Reject wrong-typed counts rather than clamping them to the minimum.** Silently
  drafting one word because a client sent `"8"` hides the client's bug. Noted in a
  test: JSON has no `NaN`/`Infinity` — they serialise to `null`, which legitimately
  means "use the default" — so the realistic failure is the type, and that is what
  is rejected.
- **`psql` + `DO` blocks, not pgTAP.** Same reasoning `SCN-13` recorded: the web
  repo has no database-test convention, `wp-2.3` established this one, and
  `tests/bootstrap.sql` is reused from it rather than duplicated.
- **Scope held to the two functions the ticket names.** `generate-image` is in scope
  for the *pull request* per plan §4.4 but is not one of the two functions `SCN-14`
  was opened for. Deferring it is recorded with its consequence (below) rather than
  quietly widened or quietly dropped.

## Data, API and configuration

**Migration** (staged, not applied):
`20260930000010_ai_generation_rate_limit.sql` adds one table
(`public.ai_generation_events`), two indexes, and two functions
(`public.ai_window_retry_after`, `public.claim_ai_generation`). Purely additive;
independent of `docs/migrations/wp-2.3/`'s five files. The web repo's generated
`src/types/database.ts` should be regenerated after it is applied — no staged file
needs it (the actions use `functions.invoke`, not `.rpc`), but the file is checked
in and should not go stale.

**New endpoints:**

```
POST /functions/v1/draft-vocabulary       Authorization: Bearer <user JWT>
  { topic_id: uuid, extra_instructions: string|null,
    word_count?: 1–20 (default 8), act_as_teacher_id?: uuid|null }
→ 200 { words: [{ word, transcription, translation, exampleSentence, imagePrompt }] }

POST /functions/v1/draft-grammar          Authorization: Bearer <user JWT>
  { topic_id: uuid, extra_instructions: string|null,
    point_count?: 1–20 (default 4), task_count?: 0–20 (default 3),
    act_as_teacher_id?: uuid|null }
→ 200 { points: [{ title, explanation, example }], tasks: [{ taskType, content }] }
```

Non-2xx is always `{ error: { code, message } }`. Codes: `method_not_allowed` 405,
`unauthorized` 401, `forbidden` 403, `invalid_request` 400, `rate_limited` 429
(+ `Retry-After`), `not_configured` 500, `upstream_timeout` 504,
`upstream_unreachable` / `upstream_error` / `unreadable_response` /
`empty_response` 502, `unusable_response` 422, `internal` 500.

**Environment.** Supabase Secrets gain `OPENROUTER_API_KEY` and (optionally)
`OPENROUTER_TEXT_MODEL` — same name and same default (`google/gemini-2.5-flash`) as
the Server Action used, so a model change stays a deploy-time change.
`supabase/config.toml` gains two `[functions.*]` blocks with `verify_jwt = true`.
The Vercel `OPENROUTER_API_KEY` **cannot be deleted yet** — see Limitations.
**This repository gains nothing: no env var, no `.env.example` entry, no key.**
That is the point of `OD-1`.

**Feature flags:** none. **New dependencies:** none — the functions use
`npm:@supabase/supabase-js@2`, which `update-streak` already imports.

## How to verify

Everything below was run in this session.

- **Edge Function tests — 8 files, 83 tests, all passing.** Run from this
  repository with a throwaway vitest config (exact commands in
  `docs/migrations/wp-5.6/README.md` § Verifying). Covers the taxonomy, the
  transport, body validation, the two moved prompt suites and the two moved parser
  suites assertion-for-assertion, and the full gate chain for both functions —
  `405` on GET, `401` with no header and with an unresolvable token, `403` for a
  student, for a profile-less caller, for a non-owning teacher, for a non-admin
  sending `act_as_teacher_id`, for an admin naming a non-teacher and for an admin
  naming nobody, `400` for four malformed bodies, `500 not_configured`, `429` with
  `Retry-After`, `500` when the ledger is unreachable, and `422` on an unusable
  model response. Every one of those asserts the outbound call count is zero.
- **`deno check` on both entry points — clean**, against the real
  `npm:@supabase/supabase-js@2` types, in `denoland/deno:latest`.
- **Live boot under Deno — serving.** Both functions were started in the same image
  with stub `SUPABASE_*` secrets and probed over HTTP: `GET` →
  `405 {"error":{"code":"method_not_allowed",…}}`, unauthenticated `POST` →
  `401 {"error":{"code":"unauthorized","message":"Your session expired. Sign in
  again."}}`, and the structured log line appeared with `kind`, `outcome` and
  `duration_ms` and no prompt text.
- **SQL — 22 `PASS`, 0 `FAIL`, exit 0.** Against a fresh `postgres:16-alpine`
  container: `docs/migrations/wp-2.3/tests/bootstrap.sql`, then all 67
  `upstream/supabase/migrations/*.sql` in order, then this migration — all with
  zero edits — then `tests/rate-limit-tests.sql`. Covers the grants, RLS-on-with-no-
  policies, `service_role`-only execute, the pinned `search_path`, a real
  `authenticated` and `anon` request being refused at the boundary (42501), the
  minute / hour / day windows, window sliding, per-kind and per-teacher isolation,
  the 20-image auto-generate batch fitting the budget, `remaining_today`, a refused
  claim recording nothing, input validation, and `on delete set null` on `topic_id`.
- **Concurrency — exactly the budget, and the test proven to detect a weakened
  limiter.** 20 simultaneous `psql` connections each claiming once against
  `draft_vocabulary`'s 5/minute:

  ```
  locked:   20 parallel claims against a budget of 5 -> granted=5  ledger_rows=5
  unlocked: 20 parallel claims against a budget of 5 -> granted=20 ledger_rows=20
  ```

  The second line is the same function with the advisory lock removed.
- **This repository's own gates — all green and unaffected.** `npm run type-check`,
  `npm run lint`, `npm test` (18 files, 189 tests) all pass. `tsconfig.json` and
  `eslint.config.js` both exclude `docs/`, so nothing staged here enters this app's
  build; the pass only confirms no regression.
- **Not run, and must be run upstream:** `npm run lint`, `npm run type-check`,
  `npm test` in `rubanwd/slay-city` once `web/src/` is copied into place. Those
  files need `next/cache`, the real `@/lib/supabase/server` and the `@/` → `src/`
  alias, none of which exist here — the same caveat
  `docs/migrations/wp-2.3/thin-callers/README.md` records for `SCN-12`.
- Both Docker containers were removed after verification; nothing was left running.

## Limitations and follow-ups

- **`generate-image` is not implemented, and the Vercel key therefore stays.**
  `generateWordImage` still calls `requestOpenRouterImage` from
  `src/features/admin/openRouterImage.ts`, which still reads
  `process.env.OPENROUTER_API_KEY`. Nothing is *exposed* — that read is on the
  Next.js server, never in client-delivered code, so the ticket's "no API key
  exposure in client-delivered code" holds — but `WP-5.6`'s end state of "the key
  exists in exactly one place" is not reached by this package alone. The same
  applies to the four admin callers (`generateLocationIcon.ts`,
  `generateMapBackground.ts`, `generateTaskImage.ts`, `missionImageActions.ts`),
  which plan §4.4 defers anyway. Tracked as unchecked lines in
  `docs/UPSTREAM-PR-WP-5.6.md`.
- **Nothing is deployed.** Per this repository's standing rule, none of this runs
  until a human opens the `WP-5.6` pull request against `rubanwd/slay-city` and
  copies the files per `docs/migrations/wp-5.6/README.md`. The acceptance criterion
  "both functions deploy and run in Supabase Edge runtime" is evidenced here by
  `deno check` plus a live boot and HTTP probe under the real Deno runtime, not by
  a Supabase deployment.
- **The `AGENTS.md` amendment is not staged.** The OD-1 rewording of the web
  manual's lines 303 / 463 / 482 is fixed verbatim in `EDGE-FUNCTIONS-PLAN.md` §2.2
  and belongs in the pull request, against that repository's own file.
- **Ordering dependency on `WP-2.3`.** `web/src/features/teacher/{vocabularyActions,
  grammarActions}.ts` and `web/src/lib/testSupabase.ts` are built on `SCN-12`'s
  staged versions. Applying this package *before* `docs/migrations/wp-2.3/
  thin-callers/` would revert the `WP-2.3` RPC calls in the publish paths.
- **The admin "view as teacher" path narrows.** `can_author_topic()` (WP-2.3) lets
  an admin author on any topic; these functions scope an admin to the topics of the
  teacher named in `act_as_teacher_id`. An admin only reaches the teacher console
  through "view as", so the console cannot produce a request this refuses, but it is
  a real difference from the `U-7` parity argument and is commented in
  `teacherAuth.ts`.
- **Budgets are opening numbers**, derived from the shipped UI's own call patterns
  rather than observed usage. Plan §6.4 says to tune them from
  `ai_generation_events` after a month.
- **No CI job is staged for the SQL tests.** `SCN-13` staged
  `docs/migrations/wp-2.3/ci-database-tests.yml`, which replays
  `supabase/migrations/` and runs `negative-tests.sql`; adding
  `supabase/tests/wp-5.6/rate-limit-tests.sql` to it is a one-line change to a file
  that is itself not yet merged upstream, so it is better made when that job lands.
  The concurrency check is shell-driven and would need a separate step.
- **No native code.** The `@slay/data` wrappers, the `packages/core` contract types
  and the binary-grep acceptance check (plan §7, §8 step 4) are the native half of
  `WP-5.6` and a separate item; they cannot be written against endpoints that are
  not deployed. `web/src/features/teacher/aiDrafting.ts` exists so that half has a
  file to mirror and track in `packages/core/.upstream.json`.
