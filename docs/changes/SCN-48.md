# SCN-48 — Copy pure modules into `packages/core` with tests and `.upstream.json`

> Type: task · Date: 2026-10-06

## Context

SCN-48 is badged "Goal: WP-0.2" and asks for `packages/core`: a tracked copy
of the web app's pure-logic modules — reward maths, unlock rules, puzzle
generation, streak logic, validation, i18n dictionaries, ~6 000 lines, tests
included — with `packages/core/.upstream.json` recording the upstream path
and SHA-256 of every copied file plus the upstream commit SHA, a generator
script so that manifest is reproducible rather than hand-typed, and the
package wired into the test runner and the TypeScript path aliases.

This is the same goal (WP-0.2) as the ticket that originally delivered the
copy (commit `290e8a5`) and the one that re-verified and packaged it
(SCN-3, commit `6b612bd`). Re-checking this run against every clause of
SCN-48 found the copy, the manifest, the test wiring and the path aliases
already in place and correct — verified directly rather than assumed:

- `packages/core/src/**` holds 48 tracked files (24 modules + their tests)
  mirroring upstream's `src/` tree: `features/mission/{missionReward,
  snakeGrid, wordPuzzle, taskUtils, types}`, `features/levels/levels`,
  `features/i18n/{index,locales,plural,messages,messages/{en,ru,uk}}`,
  `features/profile/username`, `features/map/{mapConstants,mapState}`,
  `features/demo/demoProgress`, `features/study/studyTime`,
  `features/teacher/topicSources`, `features/parent/{homework,
  taskFamilies}`, `features/admin/{taskImageMeta,taskImageSlots,taskTypes,
  userRoles}`, `features/auth/roleRouting`, `features/feedback/feedback`,
  `features/wardrobe/{categories,mascot}`, `lib/hiss`, and `types/{database,
  index}`.
- `packages/core/.upstream.json` lists all 48 files with their upstream path,
  SHA-256 and `adapted` flag; two are `adapted: true`
  (`features/auth/roleRouting.ts`, `lib/hiss.ts`), each with a `note`
  explaining what was left behind (platform-specific functions that take a
  Supabase client, or drive the Web Audio API) and why a drift alert on the
  rest of the file still applies.
- `vitest.config.mts` already includes `packages/**/*.test.ts`, aliases
  `@slay/core`, `@/` (the copied modules' internal import style) and
  `@slay/data`/`@slay/tokens`, and scopes coverage to
  `packages/core/src/**/*.ts`. The project uses Vitest, not Jest — there is
  no Jest config anywhere in the repo, and `AGENTS.md`/`CLAUDE.md` name
  `npm test` (Vitest) as the test command — so "wire into the Jest config"
  is satisfied by the existing Vitest wiring.
- The root `tsconfig.json` already carries `@slay/core`, `@slay/core/*` and
  `@/*` path aliases pointing at `packages/core/src`.
- `npm test` passes 192/192 across 18 files, `npm run lint` and
  `npm run type-check` are clean, and a grep across `packages/core/src` found
  no import from `next/*`, DOM globals, or `upstream/`.

The one clause genuinely unmet was step 3's generator script: "Add a
generator script, for example `scripts/generate-upstream-manifest.mjs`, so
the manifest is reproducible." No such script existed — the manifest's
hashes had been produced by whatever process first wrote the file, with no
way to regenerate them other than hand-computing SHA-256 again. That is the
gap this run closed.

A second thing surfaced while verifying: `npm run upstream:fetch` (no args)
clones the *current* upstream head, which has moved on from the manifest's
recorded `syncedFrom` (`21b4d87c…`, 2026-09-17) to a newer commit
(`beba39d`, this run). Running the drift check against that fresh checkout
reports 7 of 48 files drifted (`types/database.ts`, `types/index.ts`,
`features/auth/roleRouting.ts`, and the four i18n message files).
Re-checking against the exact `syncedFrom` commit (`node
scripts/fetch-upstream.mjs --ref 21b4d87c…`) confirms all 48 hashes are
correct for the commit the manifest claims — the manifest is accurate, and
this is expected, pre-existing drift against a moved upstream, not a defect
in the manifest. SCN-48's acceptance criteria are about the copy and its
manifest being correct, not about the manifest being resynced to today's
upstream head; resolving that drift is a separate sync task per
`docs/SYNC.md` §4 and was deliberately left alone here to avoid an
unrequested, large content change (new RPC-shaped types, retranslated
message catalogs) riding on a ticket that didn't ask for it.

## What was done

Added `scripts/generate-upstream-manifest.mjs`. Given an upstream checkout
path (`--upstream <path>`, matching `check-upstream-drift.mjs`'s existing
flag), it reads the current `packages/core/.upstream.json`, keeps each
entry's `local`/`upstream`/`adapted`/`note` fields exactly as recorded (that
mapping, and the judgement call of what counts as "adapted," stays a human
decision — this script does not rediscover it), recomputes each file's
SHA-256 from the upstream checkout using the same CRLF-normalizing hash
function as the drift checker (so the two scripts always agree regardless of
`core.autocrlf`), reads the checkout's commit via `git rev-parse HEAD` for
`syncedFrom`, stamps `syncedAt` with the current time, and writes the result
back to `packages/core/.upstream.json` (or a path given by `--out`).

Verified it is actually reproducible before leaving it in place: ran it
against `./upstream` checked out at the manifest's own `syncedFrom` commit
(`21b4d87c…`) and diffed the output against the manifest already in the
repo — all 48 `sha256` values and the `syncedFrom` commit matched exactly;
only the `syncedAt` timestamp (which is expected to change on every
regeneration) differed. Restored the original file afterward — this run
makes no content change to `.upstream.json`, since the manifest's recorded
hashes are already correct for the commit it claims.

Added an `upstream:manifest` npm script (`node
scripts/generate-upstream-manifest.mjs --upstream ./upstream`) alongside the
existing `upstream:fetch` / `upstream:check`, so regenerating the manifest
after a real sync is a single command rather than a hand-typed one, matching
the existing convention. Verified it runs and produces the same output as
calling the script directly.

No file under `packages/core/src` was touched, and `.upstream.json`'s
content is byte-for-byte unchanged from before this run.

## Changes by file

- `scripts/generate-upstream-manifest.mjs` — new. Regenerates
  `packages/core/.upstream.json`'s hashes and `syncedFrom`/`syncedAt` from a
  given upstream checkout, preserving the existing file list and
  `adapted`/`note` metadata. Closes the one unmet step in SCN-48 ("add a
  generator script... so the manifest is reproducible").
- `package.json` — modified. Added the `upstream:manifest` script, wiring
  the new generator in next to `upstream:fetch` and `upstream:check`.

## Technical decisions

- **Did not re-copy or re-verify the 48 tracked files or touch
  `.upstream.json`.** They were already ported correctly in WP-0.2 and
  re-verified in SCN-2/SCN-3; the manifest's hashes are confirmed correct for
  the commit it records. Re-doing that work would risk reintroducing drift
  for no benefit.
- **Did not resync `packages/core` against the current upstream head
  (`beba39d`).** The 7-file drift found when checking against a fresh
  `upstream:fetch` is real, but resolving it means pulling in new Supabase
  type shapes and retranslated i18n message catalogs — a substantial,
  judgement-laden content change that SCN-48 (a bootstrap/tooling ticket)
  never asked for. Flagging it here so the next sync-focused ticket has the
  exact file list (`types/database.ts`, `types/index.ts`,
  `features/auth/roleRouting.ts`, `features/i18n/messages.ts`,
  `features/i18n/messages/{en,ru,uk}.ts`) instead of rediscovering it.
- **The generator preserves the manifest's existing file list rather than
  rediscovering "pure modules" from scratch.** Classifying a web-repo module
  as import-free of Next.js/DOM/server code is a judgement call (that's
  step 1 of the ticket, already done when the copy was first made); a script
  that silently added or dropped files from the manifest on every run would
  make the tracked set non-deterministic across runs for reasons unrelated
  to upstream content actually changing. Hashing is the part that should
  never be hand-done twice; which files are tracked is a decision a human
  makes once and amends deliberately.
- **No Jest config added.** The ticket's step 5 says "wire into the Jest
  config," but this repository has no Jest anywhere — `npm test` runs
  Vitest (`vitest.config.mts`), per `CLAUDE.md`'s own command list. Adding a
  parallel Jest config nobody runs would contradict the project's actual
  test setup instead of satisfying the intent (packages/core's tests run
  under the configured test runner).

## Data, API and configuration

- New npm script: `upstream:manifest` (see above). No dependency, schema,
  RPC, or environment changes.
- No changes to `vitest.config.mts`, `tsconfig.json`, `babel.config.js`, or
  `metro.config.js` — all already resolve `@slay/core` / run
  `packages/core`'s tests as required.
- No changes to any file under `packages/core/src/**` or
  `packages/core/.upstream.json`.

## How to verify

- `npm test` — 192/192 tests pass across 18 files (unchanged from before
  this run).
- `npm run lint` — passes with no warnings or errors.
- `npm run type-check` — passes with no output.
- `npm run upstream:fetch -- --ref 21b4d87c880185f58ff85a5b32c1a88b50877741`
  then `npm run upstream:check` — reports all 48 tracked files in sync,
  confirming the manifest's hashes are correct for the commit it claims.
- `npm run upstream:manifest` (with `./upstream` checked out at the same
  ref) — regenerates `packages/core/.upstream.json` with identical `sha256`
  values and `syncedFrom`, differing only in `syncedAt`, demonstrating the
  manifest is now reproducible from the generator rather than hand-typed.
- Manual: `grep -R "from \"next\|from 'next\|from \"upstream\|document\.\|window\."
  packages/core/src` — no matches, confirming no banned import.
- Manual: `git status --porcelain` shows only the new
  `scripts/generate-upstream-manifest.mjs` and the `upstream:manifest` line
  added to `package.json` from this run.

## Limitations and follow-ups

- `packages/core` is 7 files behind the current upstream head (`beba39d`
  at the time of this run): `types/database.ts`, `types/index.ts`,
  `features/auth/roleRouting.ts` (adapted — only the drift in `roleHome()`
  matters here), and the four i18n message files
  (`features/i18n/messages.ts` and `messages/{en,ru,uk}.ts`). This is
  pre-existing drift against a web repo that keeps moving, not something
  introduced by this run; resolving it is a `docs/SYNC.md` §4 sync task for
  a future ticket, not SCN-48's scope.
- The generator script intentionally cannot add newly-pure upstream modules
  to the tracked set on its own — that classification stays a human step,
  done when scoping a sync, same as the original port.
