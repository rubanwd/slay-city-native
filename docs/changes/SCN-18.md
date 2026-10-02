# SCN-18 — Build `generate-image` Edge Function for word images

> Type: feature · Date: 2026-10-02

## Context

`SCN-7` (`EDGE-FUNCTIONS-PLAN.md`) designed three Supabase Edge Functions to
move OpenRouter AI calls out of the web app's Next.js Server Actions, because
`OD-1` (approved 2026-09-29) requires it: a mobile binary cannot hold
`OPENROUTER_API_KEY`, so every call that spends it has to move off every
client, including the browser's. `SCN-14` implemented two of the three —
`draft-vocabulary` and `draft-grammar` — and staged the web's thin-caller
migration for them, deliberately leaving `generate-image` out of scope.
`SCN-15` then confirmed the remaining gap (`generateWordImage` in
`vocabularyActions.ts` still calling `requestOpenRouterImage` from
`src/features/admin/openRouterImage.ts`, still reading
`process.env.OPENROUTER_API_KEY`) but declined to close it, because deciding
"what ships in this PR vs. the next one" was the maintainer's call, not a
step this ticket's predecessor was authorized to make. This ticket is that
authorization: build `generate-image`, and migrate `generateWordImage` to call
it.

This repository (`slay-city-native`) has no `supabase/` directory and never
will. The web repository (`rubanwd/slay-city`) owns the Server Actions, the
Edge Functions and the migration timeline; this repo can only **stage** the
changed files for a human to copy across as a pull request — the same
pattern `SCN-11`–`SCN-15` already established for `WP-2.3` and `WP-5.6`.

## What was done

Implemented `generate-image`, following the exact house style `SCN-14`
established for `draft-vocabulary`/`draft-grammar` (itself following
`update-streak/index.ts`'s split): all request-handling logic lives in pure,
dependency-injected modules unit-tested under Node/Vitest, and exactly one
file (`edgeRuntime.ts`) touches Deno or `supabase-js`.

**The gate chain** (`functions/_shared/imageHandler.ts`,
`handleGenerateImageRequest`) is *not* built on `draftHandler.ts`'s
`DraftSpec`/`DraftPorts` abstraction, because `generate-image` differs from
the two text functions in two structural ways that abstraction doesn't fit:
the `vocab_image_cache` read happens *before* the quota claim (a cache hit
costs neither money nor quota, per `EDGE-FUNCTIONS-PLAN.md` §4.4/§6.6), and it
ends in a Storage upload plus a cache upsert rather than a JSON parse. Order:
method → auth header → caller from JWT → body → `OPENROUTER_API_KEY`
configured → teacher resolved (role + `act_as_teacher_id`) → topic ownership
→ cache read-through → quota claimed → **the billed call** → Storage upload
→ cache upsert (non-fatal). Every step above the billed call costs nothing,
and `generate-image/index.test.ts` asserts that by checking the outbound
model-call counter is zero on every rejection path.

**The image transport** (`functions/_shared/openrouterImage.ts`) is a
Deno/Node-portable port of `src/features/admin/openRouterImage.ts`'s
`requestOpenRouterImage`, `imageProviderRouting`, `describeImageRouting` and
`urlToDataUrl`. Same URL (shared with the text transport's
`OPENROUTER_URL`), same model default (`google/gemini-2.5-flash-image`), same
provider-routing slug and fallback behaviour (`google-ai-studio/flex`, the
half-price flex tier with fallbacks on), same 90 s timeout, same flex-tier
cost logging. Its own failure wording is kept verbatim from the real source
file rather than reused from the text transport's generic `MESSAGES` —
`openRouterImage.ts` has always said "Image generation is not configured on
this server.", not "AI generation is not configured…", because the two
transports have always been two different files with slightly different
wording. Moving the call must not change a single word a teacher reads.

**The word-cache key** (`functions/_shared/wordKey.ts`) is a duplicated copy
of `normalizeWordKey` from `src/features/homework/vocabulary.ts` — that file
stays untouched because the browser UI still calls it directly, and sharing
it across the repository boundary isn't worth the coupling for five lines
(the same `clampWordCount` precedent `EDGE-FUNCTIONS-PLAN.md` §4.5 already
accepted).

**The prompt builder**, `buildWordImagePrompt`, moved into
`functions/_shared/prompts/vocabularyPrompt.ts` alongside
`buildVocabularyPrompt` (which `SCN-14` already moved there), with its tests.
The staged web copy of `vocabularyPrompt.ts`/`vocabularyPrompt.test.ts` — which
held only `buildWordImagePrompt` after `SCN-14` — is now empty and deleted
from the staged tree.

**The Server Action**, `generateWordImage` in
`web/src/features/teacher/vocabularyActions.ts`, is now a thin caller of
`generate-image` via `supabase.functions.invoke(...)`, the same move
`generateVocabularyDraft` made for `draft-vocabulary`. It no longer imports
`requestOpenRouterImage`, `buildWordImagePrompt` or `normalizeWordKey`, and
`requireTopicAccess()` is gone from this path for the same reason it left
`generateVocabularyDraft`: it was never a real authorization gate
(`homework_topics_select` grants `is_group_member(group_id)`, so a student in
the group could already read the topic), and the function now re-checks role
and ownership in SQL before any outbound request.

**Storage scoping**: the Edge Function uploads to
`homework/<teacherId>/<uuid>.<ext>` via the service-role client, rather than
the Server Action's folder-wide `homework/<uuid>.<ext>` — closing
`MIGRATIONS-NEEDED.md` §7.1's "any teacher may overwrite any teacher's image"
for the Storage write, as `EDGE-FUNCTIONS-PLAN.md` §4.4 called for. The
`vocab_image_cache` row stays global on purpose (unchanged behaviour — that
library is deliberately shared across every teacher).

**One correctness issue found and fixed during implementation**: the
`cache_vocab_image` RPC is `SECURITY DEFINER` but still checks
`is_teacher() or is_admin()` internally against `auth.uid()`. Calling it
through the service-role client — which carries no JWT at all — would make
`auth.uid()` evaluate to null and the check would fail every time, silently
degrading every cache write to a no-fatal failure in production. Fixed by
calling `cache_vocab_image` through the anon-key client that carries the
caller's own `Authorization` header, exactly as the Server Action's original
`supabase.rpc(...)` call did. `edgeRuntime.ts` was refactored to extract a
`createSharedPorts()` helper (the caller/profile/topic/claim primitives both
`createDraftPorts` and the new `createImagePorts` need) so this two-client
distinction is written and reviewed once.

## Changes by file

- `docs/migrations/wp-5.6/functions/_shared/wordKey.ts` — new. Duplicated,
  pure `normalizeWordKey`, with a comment explaining why it isn't imported
  from `src/features/homework/vocabulary.ts`.
- `docs/migrations/wp-5.6/functions/_shared/wordKey.test.ts` — new. Three
  cases: lowercasing/trimming, inner-whitespace collapse, and that case/space
  variants produce the same key.
- `docs/migrations/wp-5.6/functions/_shared/openrouterImage.ts` — new. The
  Deno/Node-portable image transport, ported from
  `src/features/admin/openRouterImage.ts` with `fetch` injected.
- `docs/migrations/wp-5.6/functions/_shared/openrouterImage.test.ts` — new.
  Mirrors `openrouter.test.ts`'s structure: request shape, model/provider
  overrides, abort signal, inline vs. hosted data URLs, the full failure
  taxonomy with `openRouterImage.ts`'s own wording, `imageProviderRouting`
  and `describeImageRouting` as pure functions.
- `docs/migrations/wp-5.6/functions/_shared/imageHandler.ts` — new.
  `generate-image`'s own gate chain (`handleGenerateImageRequest`), its body
  parser (`parseGenerateImageBody`) and its `ImagePorts` interface.
- `docs/migrations/wp-5.6/functions/_shared/prompts/vocabularyPrompt.ts` —
  modified. Added `buildWordImagePrompt`, moved verbatim from the web's
  `src/features/teacher/vocabularyPrompt.ts`; updated the file's header
  comment.
- `docs/migrations/wp-5.6/functions/_shared/prompts/vocabularyPrompt.test.ts`
  — modified. Added the `buildWordImagePrompt` describe block, moved verbatim
  from the web's test file; updated the header comment.
- `docs/migrations/wp-5.6/functions/_shared/edgeRuntime.ts` — modified.
  Extracted `createClients()`/`createSharedPorts()` out of `createDraftPorts`
  so the caller/profile/topic/claim primitives are written once; added
  `createImagePorts()` and `serveImageFunction()`; added a `decodeDataUrl()`
  helper (ported from the Server Action's `uploadWordImage`) using
  `node:buffer`'s `Buffer`, which Deno resolves via its `node:` specifier
  support.
- `docs/migrations/wp-5.6/functions/_shared/testPorts.ts` — modified. Added
  `createFakeImagePorts` and its `FakeImagePortOptions`/`FakeImagePorts`
  types, following `createFakePorts`'s shape so `calls.requestImage` can be
  asserted empty on every rejection path.
- `docs/migrations/wp-5.6/functions/generate-image/index.ts` — new. The
  three-line Deno entry point: `serveImageFunction()`.
- `docs/migrations/wp-5.6/functions/generate-image/index.test.ts` — new.
  Gate-order tests mirroring `draft-vocabulary/index.test.ts`'s coverage
  (every 4xx/5xx case, each asserting zero outbound calls), plus
  `generate-image`-specific cases: cache hit, `force_regenerate` bypass,
  non-fatal cache-write failure, admin acting-as scoping the Storage upload
  to the named teacher, and the model/upload failure taxonomy.
- `docs/migrations/wp-5.6/config.toml.add` — modified. Added the
  `[functions.generate-image]` block.
- `docs/migrations/wp-5.6/web/src/features/teacher/aiDrafting.ts` — modified.
  Added `GenerateImageRequest` and `GenerateImageResponse`; updated the file
  header to name all three functions.
- `docs/migrations/wp-5.6/web/src/features/teacher/vocabularyActions.ts` —
  modified. `generateWordImage` is now a thin caller of `generate-image`;
  removed the `requestOpenRouterImage`, `buildWordImagePrompt` and
  `normalizeWordKey` imports and the now-dead `uploadWordImage`,
  `decodeDataUrl` and `CONTENT_BUCKET` helpers.
- `docs/migrations/wp-5.6/web/src/features/teacher/vocabularyActions.test.ts`
  — modified. Added a `generateWordImage` describe block covering the
  success path (and that `OPENROUTER_API_KEY` is never read), the
  `force_regenerate` default and override, the admin view-as field, the
  function's-own-message surfacing, and the offline-degradation path —
  mirroring the existing `generateVocabularyDraft` coverage.
- `docs/migrations/wp-5.6/web/src/features/teacher/vocabularyPrompt.ts` —
  **deleted**. `SCN-14` had already moved `buildVocabularyPrompt` out; this
  round moved `buildWordImagePrompt` out too, leaving nothing.
- `docs/migrations/wp-5.6/web/src/features/teacher/vocabularyPrompt.test.ts`
  — **deleted** with it.
- `docs/migrations/wp-5.6/README.md` — modified. Scope, file tree, the "Files
  to delete from `src/`" list, the web file table, the verifying section
  (test counts, the Deno-check caveat), deployment order, and limitations.
- `docs/UPSTREAM-PR-WP-5.6.md` — modified. Banner, file checklist, open
  question, test plan and pre-opening checklist all updated to reflect that
  `generate-image` is now written, tested and staged.
- `docs/changes/SCN-18.md` — new. This file.

## Technical decisions

- **No `DraftSpec`/`DraftPorts` reuse for `generate-image`.** Considered
  extending the existing abstraction, but its cache-before-quota ordering and
  upload-instead-of-parse ending don't fit `parseResponse(json: unknown)`.
  Forcing the fit would have meant bending an abstraction built for two
  structurally identical functions to cover a third that isn't, which is the
  wrong trade — a dedicated, smaller `imageHandler.ts` reviews more easily
  than a generics-laden compromise.
- **`generate-image` has no `spec.ts`.** `draft-vocabulary`/`draft-grammar`
  split `index.ts`/`spec.ts` because two functions share one gate chain and
  differ only in their spec. `generate-image` has exactly one caller of its
  own chain, so there is nothing yet to parameterize; an admin image variant
  (deferred by `EDGE-FUNCTIONS-PLAN.md` §4.4) would be the second caller, and
  can introduce that split then; adding it now for one caller would be
  speculative generality.
- **`openRouterImage.ts`'s own wording, not the text transport's.** The
  planning doc's error-taxonomy table lists one `not_configured` message
  ("AI generation is not configured on this server.") as shared across all
  three functions, but the actual, currently-shipped `openRouterImage.ts`
  says "Image generation is not configured on this server." — a different
  string, because it's a different file. Fidelity to what a teacher sees
  today today wins over the table's shorthand; this is called out explicitly
  in code comments and the UPSTREAM PR's test plan so it isn't mistaken for
  a bug later.
- **Empty/invalid `word` collapses into the generic `invalid_request`
  message**, not the Server Action's bespoke "Give the word before
  generating an image." — matching the precedent `draft-vocabulary` already
  set for every other malformed field (a bad `topic_id`, a wrong-typed
  `word_count`) collapsing to the same generic 400. No real caller sends an
  empty word today; this is a minor, deliberate wording change for an
  unreachable path, not a regression in a path anyone exercises.
- **`cache_vocab_image` called through the anon-key client, not
  service-role.** Documented above under "What was done" — this is a
  genuine correctness fix, not a style choice; calling it through the
  service-role client would have made every cache write fail silently in
  production (non-fatal by design, so no error surfaces, but the shared
  image library would never actually grow).
- **`edgeRuntime.ts` refactored to share `createSharedPorts()`.** The
  alternative — a second, fully-duplicated ~50-line port builder for images —
  is exactly the "two copies of the same thing" pattern this project avoids
  elsewhere (`packages/core`, `prompts/`). The refactor changes no behavior
  for the already-shipped draft functions; it only relocates code.
- **Base64 encoding via chunked `btoa`, not `Buffer`,** in the
  Node/Vitest-testable `openrouterImage.ts` (a hosted-image-URL re-fetch
  path): `Buffer` is Node-specific and not guaranteed as a Deno global,
  whereas `btoa`/`atob` are standard in both runtimes. `edgeRuntime.ts` (the
  one Deno-only file) does use `Buffer`, imported via Deno's `node:buffer`
  specifier support, since it never needs to run under Vitest.

## Data, API and configuration

- **New Edge Function contract** (not deployed by this change — staged only):
  `POST /functions/v1/generate-image` — `{ topic_id, word, image_prompt,
  force_regenerate, act_as_teacher_id }` → `{ image_url, cached }` on 200, or
  `{ error: { code, message } }` on failure, per `EDGE-FUNCTIONS-PLAN.md`
  §5.1's taxonomy.
- **Supabase Secrets** (to be set when deployed, not by this change):
  `OPENROUTER_API_KEY` (shared with the two text functions),
  `OPENROUTER_IMAGE_MODEL` (default `google/gemini-2.5-flash-image`),
  `OPENROUTER_IMAGE_PROVIDER` (default `google-ai-studio/flex`) — same names
  and defaults the Server Action already used, so no behavior changes at
  deploy time.
- **No schema change.** `vocab_image_cache` and `cache_vocab_image` already
  exist from `WP-2.3` (`SCN-11`); this ticket only changes which client calls
  them and from where.
- **No native (`slay-city-native`) API surface added.** `packages/core` and
  `packages/data` are untouched — the native `@slay/data` wrapper over
  `generate-image` is the "native half" of `WP-5.6` that
  `EDGE-FUNCTIONS-PLAN.md` §7–§8 describes as a separate item, same as it was
  after `SCN-14`.

## How to verify

- `npx vitest run --config <(temp config including docs/migrations/wp-5.6/functions/**/*.test.ts)`
  — **11 files, 138 tests, all passing** (up from `SCN-14`'s 8 files/83
  tests; the new files are `wordKey.test.ts`, `openrouterImage.test.ts`,
  `generate-image/index.test.ts`, and the extended
  `prompts/vocabularyPrompt.test.ts`).
- `npm run type-check`, `npm run lint`, `npm test` in this repository — all
  pass; `tsconfig.json` excludes `docs/`, so this is confirming the staged
  tree doesn't leak into this app's own build, not type-checking the staged
  Deno code itself.
- `deno check draft-vocabulary/index.ts draft-grammar/index.ts
  generate-image/index.ts` under `denoland/deno` via Docker — **not run**:
  no Docker daemon was reachable in this session (`docker run` failed to
  connect to the engine, though the `docker` CLI itself is installed).
  `generate-image/index.ts` is a three-line wrapper around
  `serveImageFunction()`, the same shape the other two entry points already
  passed this check in, and `edgeRuntime.ts`'s additions follow the existing
  `createDraftPorts` pattern with imports (`npm:@supabase/supabase-js@2`,
  `node:buffer`) already proven to resolve under Deno — but this is not a
  substitute for running the check. Flagged in both
  `docs/migrations/wp-5.6/README.md` and `docs/UPSTREAM-PR-WP-5.6.md` as
  something to run before merging.
- Manual verification (draft vocabulary/grammar flows, a live Storage
  upload, a cache hit, the binary-grep acceptance check) is **not possible**
  from this repository — nothing here is deployed; a human opens the PR
  against `rubanwd/slay-city` per `docs/migrations/wp-5.6/README.md`'s
  deployment order, which now includes `generate-image` in every step.

## Limitations and follow-ups

- **Admin image generation is still out of scope**, by the planning
  document's own explicit deferral (`EDGE-FUNCTIONS-PLAN.md` §4.4), not an
  oversight of this ticket. `generateLocationIcon.ts`,
  `generateMapBackground.ts`, `generateTaskImage.ts` and
  `missionImageActions.ts` still call `requestOpenRouterImage` from
  `src/features/admin/openRouterImage.ts` directly and still read
  `process.env.OPENROUTER_API_KEY`. The Vercel environment variable
  therefore still cannot be deleted after this PR merges — only the
  **teacher** caller (`generateWordImage`) is closed. A follow-up PR for the
  admin variant is the documented path to closing the key entirely.
- **`deno check` was not re-run** for `generate-image` (see "How to
  verify") — tracked as an explicit checklist item in both staged documents
  rather than silently assumed to pass.
- **No native wrapper.** `@slay/data`'s `generateWordImage(db, input)` and
  the matching `packages/core` types are not part of this ticket — they are
  the "native half" of `WP-5.6`, blocked only on deployment, which is now
  unblocked for all three functions from the Edge Function side.
- **Nothing in this PR is deployed.** As with every prior `wp-5.6`/`wp-2.3`
  staging round, a human still has to open the pull request against
  `rubanwd/slay-city` and copy the staged tree in.
