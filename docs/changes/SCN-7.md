# SCN-7 — Document OpenRouter Edge Function plan and OD-1 decision

> Type: research · Date: 2026-09-29

## Context

SLAY CITY's teacher console can draft a topic's vocabulary set and grammar
lesson with AI. On the web those calls run inside Next.js Server Actions, which
read `OPENROUTER_API_KEY` from `process.env` — safe, because the code runs on a
server the user does not control.

React Native has no Server Actions. Whatever the mobile teacher console does,
the *device* does, holding the public anon key and a user JWT. A key compiled
into an `.ipa` or `.aab` is extractable in minutes and bills to the project
owner's OpenRouter account (`docs/RISKS.md` `R9`).

That makes moving the calls into Supabase Edge Functions unavoidable — and that
move changes a rule the web repository's `AGENTS.md` lists under *What Not to
Change Without Permission*: *"The decision to call OpenRouter exclusively from
Next.js Server Actions."* The project tracked this as open decision **OD-1**,
blocking milestones M4 and M5 and work package `WP-5.6`.

This item is the research that unblocks it: read the web files that call
OpenRouter, specify the replacement Edge Functions in enough detail that someone
can implement them without re-deriving anything, record OD-1 as approved, and
stage the upstream pull request. **No functions are implemented** — that is
`WP-5.6`, and it lands in `rubanwd/slay-city`, not here.

It is the sibling of `SCN-6`, which audited the *write* half of the same teacher
console and produced `docs/MIGRATIONS-NEEDED.md`.

## What was done

### 1. Read the OpenRouter call sites in `upstream/`

`npm run upstream:fetch` gives a read-only checkout of the web app at `7612da5`.
Every file reachable from a teacher AI action was read in full:

- `src/features/teacher/openRouterChat.ts` — the text transport.
  `requestOpenRouterJson(prompt)` and `extractJson(raw)`.
- `src/features/teacher/vocabularyPrompt.ts` — `buildVocabularyPrompt()`,
  `buildWordImagePrompt()`.
- `src/features/teacher/grammarPrompt.ts` — `buildGrammarPrompt()`.
- `src/features/teacher/vocabularyActions.ts` — `generateVocabularyDraft()`,
  `generateWordImage()`.
- `src/features/teacher/grammarActions.ts` — `generateGrammarDraft()`.
- `src/features/admin/openRouterImage.ts` — the image transport, imported
  *directly* by `vocabularyActions.ts`.

Plus their guards (`requireTeacher.ts`, `viewAs.ts`), their parsers
(`homework/vocabulary.ts:295`, `homework/grammar.ts:157`), their UI callers
(`VocabularyManager.tsx`, `GrammarManager.tsx`), the existing Edge Function that
sets the house style (`supabase/functions/update-streak/index.ts`), and the
migration timeline, to confirm no rate limiting exists today.

Every request parameter actually sent is now recorded verbatim — URL, model and
its env override, `response_format: { type: "json_object" }`, the `X-Title`
headers, the 60 s / 90 s `AbortSignal.timeout` values, and the
`google-ai-studio/flex` provider routing with its fallback behaviour and its
cost-logging.

**Finding worth keeping:** the docs' "Category C — 6 files" is right about the
count and wrong about the list. `ARCHITECTURE.md` §3 and `MIGRATION-MAP.md` §2
both omit `vocabularyActions.ts` and `grammarActions.ts`, and file
`admin/openRouterImage.ts` as admin-only when the teacher vocabulary flow calls
it. Corrected in `MIGRATION-MAP.md`, in the same spirit as `SCN-6`'s correction
of the "32 direct writes" label.

**Finding that changes the design:** the current guard does not hold.
`generateVocabularyDraft`, `generateGrammarDraft` and `generateWordImage` write
nothing before spending money, so no RLS policy is in their path; and the topic
lookup they rely on proves nothing, because `homework_topics_select` grants
`is_group_member(group_id)` — every student in a group can already read every one
of their teacher's topics. `requireTeacher()` is the only thing standing between
a student and an OpenRouter bill. This confirms `MIGRATIONS-NEEDED.md` §6.2 from
the caller side and becomes the primary requirement on the new functions: re-check
role and ownership in SQL *before* any outbound request.

### 2. Wrote `docs/EDGE-FUNCTIONS-PLAN.md`

The deliverable, ~450 lines, covering the four things the ticket asks for:

1. **§3 — what calls OpenRouter today.** The six-file table, the exact request
   parameters for both transports, the three server entry points with their
   input/guard/pipeline/output, the broken guard, and the UI call patterns —
   including that `GrammarManager.handleRegenerateTest()` spends a full draft to
   keep only the tasks, and that `VocabularyManager` fires up to 20 image calls
   at `IMAGE_CONCURRENCY = 3` right after a draft.
2. **§4 — proposed signatures.** `POST /functions/v1/draft-vocabulary` and
   `draft-grammar` with full request/response JSON, plus `generate-image`, which
   is not one of the two named but belongs in the same PR because the teacher
   vocabulary flow calls it. The nine-step handler order is specified explicitly,
   because the order *is* the security property: everything above the OpenRouter
   call is free, and the call is the only billed line.
3. **§5 — error handling.** A thirteen-entry `{ error: { code, message } }`
   taxonomy mapped to HTTP status codes, with the messages that exist today
   marked as character-for-character regression baselines. Plus: no automatic
   retry on any billed call (a timeout does not mean the request was not served),
   and what "degrade to manual authoring" means concretely on each screen.
4. **§6 — rate limiting.** An `ai_generation_events` ledger with RLS enabled and
   zero policies, an atomic `claim_ai_generation()` `SECURITY DEFINER` RPC with
   `execute` revoked from `authenticated`, per-teacher budgets, and a
   project-wide circuit breaker.
5. **§7 — how native calls them.** `supabase.functions.invoke()`, the
   `FunctionsHttpError` unwrapping that the taxonomy depends on, the
   `@slay/data` wrapper signatures, where the shared types live, TanStack Query
   rules, the configuration table, and the binary-grep verification.

Two design choices in the signatures are deliberate departures from the current
Server Actions and are argued in the document: the request does **not** accept
`topic_title` / `topic_description` (the function reads them from
`homework_topics` in the same query that proves ownership, closing a
prompt-injection surface), and `generate-image` writes to
`homework/<teacherId>/<uuid>.<ext>` instead of `homework/<uuid>.<ext>`, which is
a free fix for `MIGRATIONS-NEEDED.md` §7.1.

### 3. Recorded OD-1 as APPROVED

**OD-1 — APPROVED, 2026-09-29. Rationale: the API key cannot ship in a mobile
binary.**

Propagated to every place the project tracks decisions: `ARCHITECTURE.md` §7 and
its Category C callout, `CONCEPT.md` §6 and §10, `ROADMAP.md`'s dependency graph
and the M4/M5 gating lines, `WORK-PACKAGES.md`'s `WP-5.6` row, `RISKS.md` `R9`,
and `work-packages.json`'s machine-readable `open_decisions` entry.

The amendment to the locked rule itself is **not** made here. This repository's
`AGENTS.md` opens by stating the root manual "is the product's constitution and
this repository does not get to amend it", and overrides it "only where it says
so explicitly". So `AGENTS.md` gains an explicit override note under the
security rules, and the replacement wording for the three affected lines of the
root manual (303, 463, 482) is fixed in `EDGE-FUNCTIONS-PLAN.md` §2.2 for the
upstream PR to carry.

### 4. Staged the upstream PR

`docs/UPSTREAM-PR-WP-5.6.md` is a paste-ready pull-request body for
`rubanwd/slay-city`, banner-marked **NOT OPENED**. It carries the what/why, the
live authorisation gap it closes, the rate-limiting summary, a file manifest,
the `AGENTS.md` amendment, a test plan whose gate tests each assert *no outbound
`fetch`*, a deployment sequence, and one open question for the reviewer (whether
the four admin image callers move in this PR or a follow-up; recommendation is a
follow-up, with the remaining `process.env` read tracked as a dated exception
rather than an oversight).

## Changes by file

- `docs/EDGE-FUNCTIONS-PLAN.md` — **new**. The deliverable: the six-file audit,
  the proposed `draft-vocabulary` / `draft-grammar` / `generate-image`
  signatures, the error taxonomy, the rate-limiting design, the native call
  path, the order of work, and an explicit list of what the plan does not cover.
- `docs/UPSTREAM-PR-WP-5.6.md` — **new**. Placeholder for the eventual pull
  request against the web repository, with the PR body written and a
  pre-opening checklist.
- `docs/changes/SCN-7.md` — **new**. This summary.
- `AGENTS.md` — modified. An explicit-override note under *Security* recording
  OD-1, why it was approved, and that the root manual's amendment lands
  upstream. Placed beside the existing "no `OPENROUTER_API_KEY` in the bundle"
  rule, which it does not weaken.
- `CLAUDE.md` — modified. The "no `supabase/` directory" paragraph now names the
  two documents staged for upstream PRs, so an agent reading only `CLAUDE.md`
  finds them.
- `docs/ARCHITECTURE.md` — modified. OD-1 struck through in the §7 table and
  marked approved with its rationale; the Category C "Requires product-owner
  approval" callout rewritten as an approval and linked to the plan.
- `docs/CONCEPT.md` — modified. OD-1 marked approved in the §10 decision table
  and in the §6C paragraph.
- `docs/ROADMAP.md` — modified. OD-1 removed from the dependency graph's
  "needed by" line and from the M4 and M5 gating lines; M5 now names the
  upstream PR as `WP-5.6`'s remaining blocker; the cross-repository table links
  both new documents.
- `docs/WORK-PACKAGES.md` — modified. `WP-5.6`'s row drops "*Skipped under
  OD-1(b)*" and points at the plan and the staged PR.
- `docs/RISKS.md` — modified. `R9`'s mitigation records the approval date and
  links the plan.
- `docs/MIGRATION-MAP.md` — modified. Category C records the approval and
  corrects its own file list.
- `docs/work-packages.json` — modified. The `OD-1` entry gains `status`,
  `decision`, `rationale`, `decided_on` and `plan` fields.

No source file was touched. No `packages/core` file was touched.

## Technical decisions

- **Three functions, not two.** The ticket names `draft-vocabulary` and
  `draft-grammar`. `generate-image` is specified alongside them because
  `vocabularyActions.ts` imports `admin/openRouterImage.ts` directly — the
  teacher vocabulary flow *is* an image caller, so shipping only the two text
  functions would leave the teacher console still needing the key. The four
  admin-only image callers are explicitly deferred to a follow-up PR, with the
  consequence named: the Vercel environment variable cannot be deleted until
  then.
- **Ownership data is read server-side, not accepted from the client.**
  Dropping `topic_title` / `topic_description` from the request costs one row
  read that the function performs anyway to check ownership, and removes the
  ability to inject arbitrary text into the prompt from a phone. Rejected the
  alternative (keep the current shape for a smaller diff) because the diff is
  the same size either way.
- **Prompts and parsers move rather than get copied.** Three options are
  weighed in §4.5: import in place from `src/` (rejected — Deno cannot resolve
  the `@/` aliases and extensionless specifiers, and it would break the first
  time someone adds an import), copy into `_shared/` (rejected — two copies of a
  prompt is exactly the failure `packages/core` exists to prevent, one
  repository over), or move into `_shared/` with the tests, which is possible
  precisely because the Server Actions stop building prompts and parsing model
  output. The document also notes this is the web repository's decision alone:
  the native app builds no prompt and parses no model response, so it does not
  block `WP-5.6` here.
- **The limiter claims atomically and is unreachable from a client.** A
  count-then-insert lets two concurrent requests both pass a `SELECT count(*)`,
  so `claim_ai_generation()` counts and inserts in one statement. `execute` is
  revoked from `anon` and `authenticated`, and the ledger table has RLS enabled
  with no policies at all — a configuration that reads like an unfinished
  migration and is therefore called out explicitly for the reviewer.
- **The image budget is derived, not guessed.** 25/minute comes from the shipped
  flow: auto-images fire up to 20 calls immediately after a draft. Any lower
  limit would break behaviour the web ships today, and would look like a flaky
  model rather than a limit.
- **No automatic retry on a billed call, at any layer.** A `fetch` timeout does
  not prove the request went unserved; OpenRouter may have generated and billed
  a response that never arrived. Trade-off accepted: a genuinely transient
  network blip costs the teacher one button press.
- **Existing error strings are a regression baseline.** Nine messages a teacher
  can read today are reproduced character-for-character in the taxonomy, so
  moving the call cannot change the web UX. New codes exist only where the
  failure mode is new (`rate_limited`, `forbidden`, `invalid_request`).

## Data, API and configuration

Nothing changes in this repository. Everything below is **proposed** for
`rubanwd/slay-city` and is implemented by `WP-5.6`, not by this item.

- **New Edge Functions** (proposed): `POST /functions/v1/draft-vocabulary`,
  `POST /functions/v1/draft-grammar`, `POST /functions/v1/generate-image`. All
  `verify_jwt` on. Contracts in `EDGE-FUNCTIONS-PLAN.md` §4.
- **New migration** (proposed): `public.ai_generation_events` (ledger, RLS on,
  no policies, no grants) and `public.claim_ai_generation(uuid, uuid, text,
  uuid)` `SECURITY DEFINER`, `execute` revoked from `anon` / `authenticated`.
- **Secrets** (proposed): `OPENROUTER_API_KEY`, `OPENROUTER_TEXT_MODEL`,
  `OPENROUTER_IMAGE_MODEL` and `OPENROUTER_IMAGE_PROVIDER` move from Vercel
  environment variables to Supabase Secrets, keeping their names and defaults so
  a model change stays a deploy-time change.
- **This repository**: no new environment variable, no `.env.example` entry, no
  dependency, no key. That is the point of the decision.
- Future `@slay/data` exports (`draftVocabulary`, `draftGrammar`,
  `generateWordImage`) and their `packages/core` types are specified in §7.2 but
  **not written** — they are `WP-5.6`.

## How to verify

This item produces documentation only, so verification is that the repository is
unchanged in behaviour and the analysis is checkable against source.

- `npm run lint` — passes.
- `npm run type-check` — passes.
- `npm test` — 189 tests pass, unchanged from `SCN-6`.
- `git status` shows only `.md` files plus `docs/work-packages.json`; no file
  under `packages/`, `src/` or `app/` is modified, so the drift contract is
  untouched.
- Spot-check the analysis against the source (requires `npm run upstream:fetch`):
  - `upstream/src/features/teacher/openRouterChat.ts:7,32-46` — model default,
    headers, `response_format`, 60 s timeout, as recorded in §3.2.
  - `upstream/src/features/admin/openRouterImage.ts:10-43,153-170` — image
    model, `google-ai-studio/flex` routing, 90 s timeout.
  - `upstream/src/features/teacher/VocabularyManager.tsx:58,259` —
    `IMAGE_CONCURRENCY = 3`, which sets the image budget in §6.4.
  - `grep -rl "rate_limit" upstream/supabase/migrations/` returns nothing —
    the claim in §6.1 that no rate limiting exists today.
  - `grep -n "OpenRouter" upstream/AGENTS.md` returns lines 303, 463 and 482 —
    the three lines §2.2 rewrites.
- Read `docs/EDGE-FUNCTIONS-PLAN.md` §4.2 step 7 and §5.2 together: they are the
  two places where being wrong costs money rather than correctness, and they are
  the ones a reviewer should read first.

## Limitations and follow-ups

- **No function is implemented.** This is planning, as the ticket specifies. The
  code lands upstream under `WP-5.6`.
- **The upstream PR is not opened.** `docs/UPSTREAM-PR-WP-5.6.md` is staged and
  banner-marked; its pre-opening checklist has four unchecked items, one of
  which (the admin `generate-image` question) needs a human answer.
- **Budgets are opening numbers.** The per-teacher limits in §6.4 are derived
  from shipped UI behaviour, not from usage data — no usage data exists, because
  the ledger that would produce it is part of the proposal. Tune after a month.
- **No cost model.** Text drafting is cheap next to images and no per-teacher
  spend forecast was built.
- **The admin image callers are out of scope.** `locationIconPrompt.ts`,
  `mapBackgroundPrompt.ts` and `taskImagePrompt.ts` were not read in detail;
  they are Category D (not ported) and move only in the follow-up PR. Until
  then one `process.env.OPENROUTER_API_KEY` read remains in the web app.
- **Everything is read from the migration timeline at `7612da5`.** Policies,
  grants or rate limiting added through the Supabase dashboard rather than a
  migration would not appear. Re-read upstream before opening the PR — the same
  caveat `MIGRATIONS-NEEDED.md` §8 carries.
- **Streaming was not considered.** The current calls are single-shot and the
  teacher waits behind a spinner; streaming a draft word-by-word would be nicer
  and is not in `WP-5.6`.
- **`MIGRATIONS-NEEDED.md` §6.1 is still open and is more urgent than any of
  this.** `user_stats` INSERT is column-blind, live on the web today, and lets a
  fresh account mint XP and coins. It is independent of OD-1 and still needs a
  decision from the maintainer.
