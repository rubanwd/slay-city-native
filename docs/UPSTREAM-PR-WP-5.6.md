# Upstream PR placeholder — `WP-5.6` AI drafting Edge Functions

> **Status: NOT OPENED.** This is a staged pull-request description for
> [rubanwd/slay-city](https://github.com/rubanwd/slay-city), written by `SCN-7`
> so the work is specified before anyone starts it.
>
> **`SCN-14` (2026-10-01) and `SCN-18` (2026-10-02) have now written all three
> functions.** `draft-vocabulary`, `draft-grammar` and `generate-image`, the
> rate-limit migration, their tests and the web-side thin callers are staged,
> verified and ready to copy — see
> [`migrations/wp-5.6/README.md`](migrations/wp-5.6/README.md) for the file map,
> the destinations and the verification results. What is **still unwritten** is
> the `AGENTS.md` amendment, which belongs in the pull request itself, and the
> admin `generate-image` variant (`EDGE-FUNCTIONS-PLAN.md` §4.4's own deferral,
> not a gap in this PR). The "Files" and "Test plan" sections below are
> annotated accordingly.
>
> Design and rationale: [EDGE-FUNCTIONS-PLAN.md](EDGE-FUNCTIONS-PLAN.md).
> Decision: **OD-1 — APPROVED**, 2026-09-29.
> Target branch: `main` · Base read at `7612da5`.

## Why this file exists here

This repository has no `supabase/` directory and never will
([AGENTS.md](../AGENTS.md), "Migrations belong upstream"). The web repository
owns the migration timeline and the Edge Functions. `ROADMAP.md` lists `WP-5.6`
as one of three work packages whose output is a pull request against the live
product rather than a commit here.

So the plan lives here and the code lives there. Paste the sections below into
the PR body when it is opened, and replace this banner with a link to it.

---

## PR title

```
feat(ai): move OpenRouter drafting into Edge Functions (OD-1)
```

## PR body — paste from here

### What

`OPENROUTER_API_KEY` moves from Vercel environment variables to Supabase
Secrets, and the three AI generation entry points become Supabase Edge
Functions that both the web app and the upcoming native app invoke:

| Function | Replaces | Caller must be |
| --- | --- | --- |
| `draft-vocabulary` | `teacher/vocabularyActions.ts` → `generateVocabularyDraft` | the topic's teacher (or an admin acting as them) |
| `draft-grammar` | `teacher/grammarActions.ts` → `generateGrammarDraft` | same |
| `generate-image` | `teacher/vocabularyActions.ts` → `generateWordImage` | same |

The Server Actions keep their exported names, input types and return types.
They become thin callers. `VocabularyManager.tsx` and `GrammarManager.tsx` are
untouched, and **the teacher-facing behaviour of this app does not change** —
that is the main thing to check in review.

### Why

SLAY CITY is getting a native iOS/Android build with the same teacher console.
A mobile binary is not a secret store: a key compiled into an `.ipa` or `.aab`
is extractable in minutes and bills to this account. There is no way to ship AI
drafting to a mobile teacher without moving the call off the client.

This amends a rule `AGENTS.md` lists under *What Not to Change Without
Permission*. The amendment is approved as **OD-1**, with the rationale
*"API key cannot ship in a mobile binary"*, and is included in this PR (see
*Manual amendment* below).

The intent of the locked rule is strengthened rather than relaxed: the key stops
being readable by the whole Next.js server process and becomes readable only
inside the Deno function.

### Also fixes a live authorisation gap

`generateVocabularyDraft`, `generateGrammarDraft` and `generateWordImage` write
nothing before they spend money, so no RLS policy is in their path. Their only
gate is `requireTopicAccess()` → `requireTeacher()`, and the topic lookup it
relies on proves nothing: `homework_topics_select` grants
`is_group_member(group_id)`, so **every student in a group can already read
every one of their teacher's topics**.

The new functions re-check role *and* topic ownership in SQL before any
outbound request, and claim rate-limit quota before it too. Reported in the
native repo's `docs/MIGRATIONS-NEEDED.md` §6.2 (`SCN-6`).

### Rate limiting

There is no rate limiting on AI spend in this project today. This PR adds:

- `public.ai_generation_events` — an append-only ledger. RLS enabled with **no
  policies and no grants**, deliberately: only the service-role client inside
  the functions touches it, so a direct PostgREST call can neither read it nor
  pad it.
- `public.claim_ai_generation(...)` — `SECURITY DEFINER`, `execute` revoked from
  `anon` and `authenticated`. Counts and inserts in one statement; a
  count-then-insert lets two concurrent requests both pass.
- Opening budgets per teacher per kind: text 5/min · 40/h · 200/day;
  images 25/min · 200/h · 600/day. The image figure is set by the existing
  auto-image flow, which fires up to 20 calls right after a draft — a lower
  limit would break shipped behaviour.
- A project-wide daily ceiling as a circuit breaker.

### Files

`✅` = written and verified by `SCN-14`/`SCN-18`, staged at the path in
[`migrations/wp-5.6/`](migrations/wp-5.6/README.md) given in that file's map.
`⬜` = still to write.

```
✅ supabase/functions/_shared/response.ts                        new
✅ supabase/functions/_shared/requestBody.ts                     new  (not in the original list)
✅ supabase/functions/_shared/openrouter.ts                      new
✅ supabase/functions/_shared/openrouter.test.ts                 new  (not in the original list)
✅ supabase/functions/_shared/openrouterImage.ts                 new  (SCN-18, not in the original list)
✅ supabase/functions/_shared/openrouterImage.test.ts            new  (SCN-18)
✅ supabase/functions/_shared/wordKey.ts                         new  (SCN-18, not in the original list)
✅ supabase/functions/_shared/wordKey.test.ts                    new  (SCN-18)
✅ supabase/functions/_shared/teacherAuth.ts                     new
✅ supabase/functions/_shared/rateLimit.ts                       new
✅ supabase/functions/_shared/draftHandler.ts                    new  (the shared gate chain, two text functions)
✅ supabase/functions/_shared/imageHandler.ts                    new  (SCN-18, generate-image's own gate chain)
✅ supabase/functions/_shared/edgeRuntime.ts                     new  (the only Deno/supabase-js file)
✅ supabase/functions/_shared/testPorts.ts                       new  (test-only; SCN-18 added the image fakes)
✅ supabase/functions/_shared/prompts/vocabularyPrompt.ts        moved from src/features/teacher/; SCN-18 added buildWordImagePrompt
✅ supabase/functions/_shared/prompts/vocabularyPrompt.test.ts   moved; SCN-18 added its describe
✅ supabase/functions/_shared/prompts/grammarPrompt.ts           moved from src/features/teacher/
✅ supabase/functions/_shared/prompts/grammarPrompt.test.ts      moved
✅ supabase/functions/_shared/drafts/vocabularyDraft.ts          moved parser from src/features/homework/
✅ supabase/functions/_shared/drafts/vocabularyDraft.test.ts     moved
✅ supabase/functions/_shared/drafts/grammarDraft.ts             moved parser from src/features/homework/
✅ supabase/functions/_shared/drafts/grammarDraft.test.ts        moved
✅ supabase/functions/draft-vocabulary/index.ts                  new
✅ supabase/functions/draft-vocabulary/spec.ts                   new  (pure, so index.test.ts can run)
✅ supabase/functions/draft-vocabulary/index.test.ts             new
✅ supabase/functions/draft-grammar/index.ts                     new
✅ supabase/functions/draft-grammar/spec.ts                      new
✅ supabase/functions/draft-grammar/index.test.ts                new
✅ supabase/functions/generate-image/index.ts                    new  (SCN-18)
✅ supabase/functions/generate-image/index.test.ts               new  (SCN-18)
✅ supabase/migrations/20260930000010_ai_generation_rate_limit.sql  new
✅ supabase/tests/wp-5.6/{fixtures,rate-limit-tests}.sql         new  (not in the original list)
✅ supabase/config.toml                                          modified — verify_jwt on for all three functions
✅ src/features/teacher/aiDrafting.ts                            new  — the shared wire contract; SCN-18 added the image request/response types
✅ src/lib/functionError.ts                                      new  — FunctionsHttpError unwrapping
✅ src/features/teacher/openRouterChat.ts                        deleted
✅ src/features/teacher/grammarPrompt.ts                         deleted (moved)
✅ src/features/teacher/grammarPrompt.test.ts                    deleted (moved)
✅ src/features/teacher/vocabularyPrompt.ts                      deleted — SCN-14 moved buildVocabularyPrompt out, SCN-18 moved buildWordImagePrompt out; nothing was left
✅ src/features/teacher/vocabularyPrompt.test.ts                 deleted with it
✅ src/features/teacher/vocabularyActions.ts                     modified — generateVocabularyDraft (SCN-14) and generateWordImage (SCN-18) are both thin callers
✅ src/features/teacher/vocabularyActions.test.ts                modified — draft coverage (SCN-14) plus generateWordImage coverage (SCN-18)
✅ src/features/teacher/grammarActions.ts                        modified — thin caller
✅ src/features/teacher/grammarActions.test.ts                   modified — draft coverage added
✅ src/features/homework/vocabulary.ts                           modified — parseGeneratedWords moved out
✅ src/features/homework/vocabulary.test.ts                      modified — its describe moved out
✅ src/features/homework/grammar.ts                              modified — parseGeneratedGrammar moved out
✅ src/features/homework/grammar.test.ts                         modified — its describe moved out
✅ src/lib/testSupabase.ts                                       modified — functions.invoke added
⬜ src/features/admin/openRouterImage.ts                         unchanged — see "Open question"; its four
                                                                 admin callers are the one remaining
                                                                 process.env.OPENROUTER_API_KEY read
⬜ AGENTS.md                                                     modified — the OD-1 amendment
```

Exact contracts, the handler gate order, and the full error taxonomy are in
[EDGE-FUNCTIONS-PLAN.md](EDGE-FUNCTIONS-PLAN.md) §4–§6. Do not re-derive them —
`SCN-14` implemented the two text functions as written, and `SCN-18` implemented
`generate-image` the same way, with the deliberate departures recorded in
[`migrations/wp-5.6/README.md`](migrations/wp-5.6/README.md) (the configuration
check is hoisted above the quota claim; `claim_ai_generation` takes an advisory
lock because "count and insert in one statement" does not actually serialise
under READ COMMITTED; `generate-image`'s cache read-through is hoisted above its
quota claim too, per §4.4, and `cache_vocab_image` is called through the
anon-key client rather than the service-role one, because its `SECURITY DEFINER`
body checks `auth.uid()`).

### Manual amendment (`AGENTS.md`)

Three lines change; wording is fixed in EDGE-FUNCTIONS-PLAN.md §2.2 and should
be copied from there rather than paraphrased.

- **line 303** — "must go through Next.js Server Actions" → "go through Supabase
  Edge Functions", naming the three functions and the Secrets store.
- **line 463** — the technology paragraph keeps every model and tier detail;
  only the "called exclusively from Next.js Server Actions … never called from
  the browser" sentence is replaced.
- **line 482** — the *What Not to Change Without Permission* entry becomes
  "exclusively from Supabase Edge Functions (never OpenAI, never from a browser
  or a mobile binary)", dated and attributed to OD-1.

### Open question for the reviewer

`generate-image`'s four **admin** callers (`generateLocationIcon.ts`,
`generateMapBackground.ts`, `generateTaskImage.ts`, `missionImageActions.ts`)
are not ported to mobile and are not moved by this PR — only the teacher
caller, `generateWordImage`, is. That leaves one `process.env.OPENROUTER_API_KEY`
read behind, so the Vercel variable cannot be deleted yet.

Either (a) merge this, then a follow-up PR adds the admin variant and the Vercel
key is deleted; or (b) grow this PR to cover them and delete the key here.
Recommendation is (a) — the admin console is web-only, nothing is blocked, and
this PR is already the larger review. If (a), the remaining read is a tracked,
dated exception, not an oversight.

### Test plan

- [x] ~~`deno test supabase/functions/`~~ → **`npx vitest --project unit`**. Corrected: `update-streak/index.test.ts` already uses vitest, and `vitest.config.ts`'s `unit` project already includes `supabase/functions/**/*.{test,spec}.ts`, so the function tests need no new runner. The moved prompt tests pass unchanged, assertion for assertion. `SCN-14`: 8 files, 83 tests, green. `SCN-18`, same command: 11 files, 138 tests, green.
- [x] Unit tests per function covering the gate order: `405` on GET; `401` with no/expired JWT; `403` for a student JWT on a topic in their own group **(the §6.2 case)**; `403` for a teacher against another teacher's topic; `403` for a non-admin sending `act_as_teacher_id`; `400` on a malformed body; `429` once the budget is spent; `422` on a model response that parses to zero words (text) / `502` on a model response with no image (`generate-image`). All present for all three functions, plus `403` for an admin naming a non-teacher and `403` for an admin naming nobody.
- [x] Each of those asserts **no outbound `fetch`** was made. Money is spent at the API call; a gate that fires after it is not a gate. (`_shared/testPorts.ts` counts outbound calls; every rejection test asserts zero.)
- [x] `generate-image`-specific: a cache hit returns `cached: true` and makes no quota claim or OpenRouter call; `force_regenerate: true` bypasses a hit; a cache-write failure after a successful generation still returns the image (non-fatal); the Storage path is `homework/<teacherId>/<uuid>.<ext>`, not the Server Action's folder-wide `homework/<uuid>.<ext>`.
- [x] `claim_ai_generation` under concurrency: N parallel claims against a budget of M grant exactly M. `SCN-14`: 20 parallel claims against a budget of 5 granted exactly 5; the same test against a lock-free copy granted 20, which is the evidence the check detects a weakened limiter. Not re-run for `generate_image`'s own budget by `SCN-18` — same function, same lock, already proven kind-independent.
- [x] `deno check` on the two text entry points against the real `npm:@supabase/supabase-js@2` types, and a live boot under `denoland/deno` answering `405`/`401` over HTTP with the taxonomy body (`SCN-14`). **Not re-run for `generate-image`** (`SCN-18`) — no Docker daemon was reachable in that session. Run it before merging:
  `docker run --rm -v "$PWD/supabase/functions:/app" -w /app denoland/deno:latest deno check draft-vocabulary/index.ts draft-grammar/index.ts generate-image/index.ts`.
- [ ] `npm run lint`, `npm run type-check`, `npm test` in the web app. **Not run — must be run in `rubanwd/slay-city` once the files are copied**; this repository has no Next.js tree to run them against.
- [ ] Manual: draft vocabulary, draft grammar, regenerate a test, auto-generate images for a 20-word set, publish — all through the deployed functions, all unchanged from `main`.
- [ ] Manual: every error message in EDGE-FUNCTIONS-PLAN.md §5.1 that exists today renders character-identical (unset the secret for `not_configured`; a bad key for `upstream_error`). For `generate-image`, the wording is `openRouterImage.ts`'s own ("Image generation is not configured on this server.", not the text transport's "AI generation…") — confirmed by reading the source file, not by re-deriving it.
- [ ] Manual: a `vocab_image_cache` hit returns `cached: true`, spends no quota, and makes no OpenRouter call.
- [ ] Manual: the manual "AI" button's `forceRegenerate: true` path produces a visibly different image for a word that already has one cached.

### Deployment

1. `supabase secrets set OPENROUTER_API_KEY=… OPENROUTER_TEXT_MODEL=… OPENROUTER_IMAGE_MODEL=… OPENROUTER_IMAGE_PROVIDER=…`
2. Apply the migration.
3. `supabase functions deploy draft-vocabulary draft-grammar generate-image`
4. Merge and deploy the web app.
5. Verify in production, then remove `OPENROUTER_API_KEY` from Vercel — **only
   after** the admin question above is closed. Until then the old path is still
   reachable and nothing is proven.

Rollback is `git revert` plus a redeploy; the functions can stay deployed
harmlessly, and the migration is additive.

### Downstream

Unblocks `WP-5.6` in
[rubanwd/slay-city-native](https://github.com/rubanwd/slay-city-native), which
adds `@slay/data` wrappers over these three endpoints and greps the built binary
for the key as an acceptance criterion.

## PR body — end

---

## Checklist before opening this

- [x] `EDGE-FUNCTIONS-PLAN.md` §4 contracts reviewed by whoever will write the functions — `SCN-14` implemented the two text functions; the two departures are recorded in `migrations/wp-5.6/README.md`
- [x] `draft-vocabulary` and `draft-grammar` written, tested and staged (`SCN-14`)
- [x] `generate-image` written, tested and staged (`SCN-18`) — `src/features/admin/openRouterImage.ts` still keeps its `process.env.OPENROUTER_API_KEY` read, but only for its four **admin** callers now; the teacher caller (`generateWordImage`) is closed
- [ ] `deno check` re-run including `generate-image/index.ts` — `SCN-18` could not reach a Docker daemon to do this; see the Test plan note
- [ ] The `AGENTS.md` amendment applied, wording copied verbatim from §2.2
- [ ] Budgets in §6.4 confirmed against real teacher usage, not assumed
- [ ] The admin `generate-image` question above answered (a) or (b) — unaffected by `SCN-18`, which only closed the teacher caller
- [ ] `docs/MIGRATIONS-NEEDED.md` §6.1 decided — it is independent of this PR and more urgent
- [ ] Upstream re-fetched and the base commit re-read; `7612da5` will be stale by then
