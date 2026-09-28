# SCN-2 — Implement upstream fetch and drift-check scripts

> Type: task · Date: 2026-09-28

## Context

`packages/core` in this repository is a tracked copy of ~6 800 lines of shared
domain logic that also lives in the web app, `rubanwd/slay-city` (see
`docs/SYNC.md`). The whole sync contract depends on two scripts existing and
working correctly: one to pull a read-only checkout of the web app down for
porting/comparison (`upstream/`, gitignored), and one to hash-compare the tracked
files in `packages/core/.upstream.json` against that checkout so CI fails the
moment upstream moves and nobody has synced the change yet.

SCN-2 asked for both scripts, the `npm run upstream:*` commands, a CI drift-check
step, and idempotent, never-committed fetch behaviour. By the time this run
started, `scripts/fetch-upstream.mjs`, `scripts/check-upstream-drift.mjs`, the two
`package.json` scripts and the `.github/workflows/ci.yml` `upstream-drift` job had
already been built in an earlier work package (WP-0.1, commit `f3b5e04`). This
run's job was to verify that delivered implementation actually satisfies the
ticket end-to-end rather than re-build it, and it found a real correctness bug in
the drift check in the process.

## What was done

Read both scripts and the CI workflow against every clause of the ticket, then
exercised them for real against the live `rubanwd/slay-city` repository (network
access confirmed available) rather than trusting that "the files exist" meant "the
behaviour is correct":

1. `node scripts/fetch-upstream.mjs --baseline` — clones a full history checkout
   and detaches HEAD at the commit recorded in `UPSTREAM_BASELINE` (`98327f5`).
   Ran twice in a row to confirm idempotency: the second run correctly detects the
   existing `upstream/` directory, removes it, and re-clones cleanly rather than
   erroring or leaving stale state.
2. `node scripts/fetch-upstream.mjs` (no flags) — shallow-clones the current
   upstream head (`--depth 1`), which is what porting work is supposed to read.
3. `node scripts/check-upstream-drift.mjs --upstream ./upstream` — run against
   both checkouts above. Against the *baseline* checkout it correctly reported all
   48 tracked files as drifted (expected — the manifest was synced from a commit
   after the baseline). Against the *current head* checkout it also reported all
   48 files as drifted, which was **not** expected: `packages/core/.upstream.json`
   records the repository as last synced from a recent commit, so only a handful
   of files, if any, should have genuinely moved since then.

   Diffing one of the "drifted" files (`levels.ts`) byte-for-byte against its
   local tracked copy showed them to be identical — `diff -u` produced no output.
   Investigation traced the false positive to line endings: this checkout has
   `core.autocrlf=true` (the common Windows default), so files land on disk with
   CRLF line endings after `git clone`, but the SHA-256 hashes recorded in the
   manifest were computed against the LF content Git actually stores as blob
   objects (confirmed by hashing `git cat-file -p HEAD:<path>` for the same file
   and matching the manifest hash exactly). The result: on any checkout where Git
   converts line endings on checkout, `check-upstream-drift.mjs` reports **every
   single tracked file** as drifted, whether or not anything actually changed.
   CI runs on `ubuntu-latest`, where Git does not rewrite line endings by
   default, so this bug would not have surfaced there — but it makes the drift
   check unusable for anyone running it locally on Windows (or any machine with
   `core.autocrlf` enabled), which is exactly the workflow `docs/SYNC.md` and
   `AGENTS.md` document ("locally: `git clone ... /tmp/upstream` then
   `node scripts/check-upstream-drift.mjs --upstream /tmp/upstream`").
4. Fixed `sha256()` in `scripts/check-upstream-drift.mjs` to normalize CRLF to LF
   before hashing, so the comparison is platform-independent and matches how the
   manifest hashes were originally computed. Re-ran the drift check against the
   current-head checkout: it now correctly reports only **1 of 48** files
   drifted — `packages/core/src/features/auth/roleRouting.ts`, an `adapted: true`
   file. Diffing it showed the shared `roleHome()` function is byte-identical;
   the change is entirely inside `ensureRoleProfile`/`resolveHomePath`, the two
   Supabase-client-taking functions the manifest's own note already says belong
   in `packages/data`, not `packages/core`. This is a real, correctly-detected
   drift alert on an adapted file working exactly as `docs/SYNC.md` §4 describes
   — not a bug, and not something to silently work around. Resolving it (i.e.
   updating the manifest hash with a note, per §4 case 5) is a sync-content
   decision for whoever owns that workflow next, not part of building the
   scripts — see Limitations.
5. Verified `npm run lint`, `npm run type-check` and `npm test` all still pass,
   and re-ran `npm run upstream:fetch -- --baseline` and `npm run upstream:check`
   through their `package.json` entries (not just the raw `node` invocations) to
   confirm the documented commands work as-is.
6. Removed the local `upstream/` checkout after testing — it is gitignored and
   was never staged; `git status` shows only the one script edit.

No other gaps were found: `package.json` already has `upstream:fetch` and
`upstream:check`; `upstream:fetch -- --baseline` needs no separate script entry
since `--baseline` is a passthrough flag handled by `fetch-upstream.mjs` itself
(and is documented that way in `AGENTS.md`); `.github/workflows/ci.yml` already
has an `upstream-drift` job that checks out `rubanwd/slay-city` into `./upstream`
and runs the drift check on push, PR and a nightly cron; `.gitignore` already
excludes `upstream/`.

## Changes by file

- `scripts/check-upstream-drift.mjs` — modified. `sha256()` now normalizes CRLF
  to LF (`buf.toString("utf8").replace(/\r\n/g, "\n")`) before hashing, instead
  of hashing the raw checked-out bytes. Fixes a false-positive-on-every-file bug
  that fires on any checkout where Git rewrites line endings on checkout (e.g.
  Windows with `core.autocrlf=true`), since the manifest's recorded hashes were
  computed against Git's LF blob content, not a particular checkout's bytes.
- `docs/changes/SCN-2.md` — new. This file.

## Technical decisions

- **Fixed the CRLF hashing bug in-scope rather than filing it separately.**
  SCN-2's deliverable is a drift-check script that "verifies [tracked files]
  against upstream." A script that reports 100% drift regardless of whether
  anything changed does not satisfy that; the fix is a one-line, low-risk change
  to the hashing function the ticket is explicitly about, not a scope expansion
  into unrelated code.
- **Did not touch `packages/core/.upstream.json` to resolve the one real drift
  finding on `roleRouting.ts`.** `docs/SYNC.md` §4 makes drift resolution — reading
  the upstream diff, deciding whether it's adapted-and-inapplicable, updating the
  hash with a justification note — a deliberate human/agent judgement call
  separate from the scripts that surface it. Silently updating the manifest here
  would hide a legitimate finding from whoever is supposed to make that call, and
  conflating "build the drift detector" with "resolve everything it detects" is
  exactly the kind of scope creep the working agreement asks to avoid.
- **Did not re-build the scripts, `package.json` entries, or CI job.** They
  already existed from WP-0.1 and, once the hashing bug was fixed, correctly
  satisfy every clause of the ticket. Re-scaffolding working, tested
  infrastructure would only risk regressing it.

## Data, API and configuration

- No new dependencies, environment variables, or schema/API changes.
- No changes to `package.json` scripts or `.github/workflows/ci.yml` — both were
  already correct.

## How to verify

- `npm run lint`, `npm run type-check`, `npm test` — all pass (184 tests across
  16 files), unaffected by this change.
- `node scripts/fetch-upstream.mjs --baseline` then again — second run removes
  and re-clones `./upstream` cleanly (idempotent), detaches at `98327f5`.
- `node scripts/fetch-upstream.mjs` — shallow-clones current upstream head.
- `npm run upstream:check` (after a fetch) — now correctly reports 1 of 48 files
  drifted (`roleRouting.ts`, adapted, real upstream change confined to the
  non-shared functions) instead of the pre-fix 48 of 48.
- Manual: confirmed the pre-fix false positive directly — `diff -u
  packages/core/src/features/levels/levels.ts upstream/src/features/levels/levels.ts`
  produces no output (files identical) despite the unfixed script reporting drift;
  and confirmed the manifest's recorded hash for that file matches
  `sha256(git cat-file -p HEAD:packages/core/src/features/levels/levels.ts)`,
  i.e. the LF blob content, not the CRLF checkout bytes.
- `git status --porcelain` — only `scripts/check-upstream-drift.mjs` is modified;
  `upstream/` was removed after testing and never appears (gitignored).

## Limitations and follow-ups

- One genuine drift finding is now surfacing correctly and is unresolved:
  `packages/core/src/features/auth/roleRouting.ts` vs upstream
  `src/features/auth/roleRouting.ts`. Only the non-shared functions
  (`ensureRoleProfile`, `resolveHomePath`) changed upstream; `roleHome()`, the
  actually-shared function, is untouched. Per `docs/SYNC.md` §4 case 5, the
  manifest hash should be updated with a note explaining the change doesn't apply
  to this file — left for whoever next runs the sync workflow, since that's a
  content decision, not a scripts change.
- The CRLF fix normalizes based on the file's own bytes at hash time; it does not
  change how Git checks files out, `.gitattributes` is not present in this repo.
  If contributors want checkouts to be byte-consistent across platforms
  regardless of this fix (e.g. for tooling other than the drift check that also
  hashes file content), adding a `.gitattributes` with `* text=auto eol=lf` would
  be the next step — out of scope for this ticket, which is specifically about
  the two scripts.
