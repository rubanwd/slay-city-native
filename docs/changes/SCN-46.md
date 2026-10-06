# SCN-46 — Add gitignored `upstream/` reference checkout and `fetch-upstream` script

> Type: task · Date: 2026-10-06

## Context

WP-0.1 needs a way for anyone porting code from `rubanwd/slay-city` (the web
app) to read the original file next to the one they're writing, and for
`scripts/check-upstream-drift.mjs` to have something to diff `packages/core`
against. Committing a snapshot of the web app into this repository would rot
within weeks, so the mechanism has to be a read-only checkout fetched on
demand into a gitignored `upstream/` directory, with every tool in the repo
(`eslint`, `tsc`, the test runner, Metro) taught to ignore it so it can never
accidentally be imported, linted, or bundled.

## What was done

Audited the repository against every clause of the ticket and found the
mechanism was already fully built and wired in — most likely landed as part
of the early WP-0.1 scaffolding commits (`f3b5e04`, `290e8a5`, both predating
this ticket) rather than in SCN-45. No new code was required; this run's job
was to verify each acceptance criterion holds and leave evidence of that
verification, which is what `docs/changes/SCN-46.md` records.

Verified end to end:

1. **`scripts/fetch-upstream.mjs` exists and matches every requirement.** It
   clones `https://github.com/rubanwd/slay-city.git` into `./upstream`,
   removing any existing checkout first (idempotent — a second run updates
   rather than erroring). With no flags it does a shallow `--depth 1` clone of
   the current upstream head. With `--baseline` it reads `UPSTREAM_BASELINE`
   (a single-line `98327f5  the commit slay-city-native was seeded from`),
   extracts the commit SHA, does a full clone, and `git checkout --detach`s to
   that exact commit. A bare `--ref <sha|branch|tag>` path also exists for
   pinning to an arbitrary commit. Missing-baseline and missing-`--ref`-value
   cases both `console.error` a clear message and `process.exit(2)` rather
   than failing with a raw git stack trace.
2. **`npm run upstream:fetch` and `npm run upstream:fetch -- --baseline` both
   work.** `package.json`'s `upstream:fetch` script is
   `node scripts/fetch-upstream.mjs`; npm forwards extra args after `--`
   straight to the script's `process.argv`, which `parseArgs` already reads.
3. **`upstream/` is in `.gitignore`**, with a comment explaining why a
   snapshot is never committed, right above the unrelated `/ios`/`/android`
   native-folder ignores.
4. **`upstream/` is excluded from every tool that could otherwise touch it:**
   - ESLint (`eslint.config.js`): `{ ignores: [... "upstream/" ...] }`, plus a
     belt-and-suspenders `no-restricted-imports` rule on `app/**` and `src/**`
     banning `upstream/*` and `../upstream/*` imports outright.
   - TypeScript (`tsconfig.json`): `"exclude": ["node_modules", "upstream",
     "docs"]`.
   - Vitest (`vitest.config.mts`, the project's test runner — there is no
     Jest config anywhere in the repo, confirmed by searching for `jest*`
     files and a `jest` key in `package.json`): `test.include` is scoped to
     `["packages/**/*.test.ts"]`, which excludes `upstream/` by construction
     rather than needing an explicit ignore pattern.
   - Metro (`metro.config.js`): nothing in `app/` or `src/` imports from
     `upstream/` (enforced by the ESLint rule above), so the default Expo
     Metro config never bundles it; no separate `blockList` was needed or
     added.
5. **`UPSTREAM_BASELINE` exists** (`98327f5  the commit slay-city-native was
   seeded from`) and the script reads it rather than deciding independently
   whether that pin should be kept or reset — that decision stays out of
   scope per the ticket, tracked separately in `docs/SYNC.md`.
6. **`README.md` documents the workflow** under "How this repository relates
   to the web app" and in the commands table (`npm run upstream:fetch` / `npm
   run upstream:check`), pointing at `docs/SYNC.md` for the full contract.

Ran all three gate commands and the script itself to confirm the acceptance
criteria hold rather than trusting the file contents alone (see "How to
verify").

## Changes by file

- `docs/changes/SCN-46.md` — new. This file; records the verification since
  no source change was needed.

No other files were changed. `scripts/fetch-upstream.mjs`, `package.json`,
`.gitignore`, `eslint.config.js`, `tsconfig.json`, `vitest.config.mts`,
`metro.config.js`, `UPSTREAM_BASELINE` and `README.md` were all already
correct for this ticket.

## Technical decisions

- **Did not add a Jest `testPathIgnorePatterns`/`modulePathIgnorePatterns`
  entry.** The ticket's step 4 names Jest explicitly, but this project has no
  Jest configuration — `npm test` runs Vitest (see `SCN-45`'s own note on the
  same point). Vitest's `test.include` allowlist already achieves the same
  outcome (upstream is never considered) without needing a separate
  blocklist. Adding a dead Jest config for a runner the project doesn't use
  would contradict the single-test-runner decision already made and recorded
  in `SCN-45.md` and `SCN-14.md`.
- **Did not add a Metro `blockList`.** Metro only bundles files reachable from
  an entry point's import graph; since `upstream/*` imports are already
  banned by `eslint.config.js`'s `no-restricted-imports` rule, there is no
  path by which Metro would ever resolve into `upstream/`. An explicit
  `blockList` would be a no-op that duplicates a rule already enforced one
  layer up, at lint time, where a violation is caught before a build is ever
  attempted.
- **No source changes.** Re-implementing or restructuring a mechanism that
  already satisfies every acceptance criterion would be unjustified churn;
  this run's value is the verification itself.

## Data, API and configuration

None. No schema, endpoint, env var, or dependency changes.

## How to verify

- `npm run lint` — passes (`eslint .`, no errors).
- `npm run type-check` — passes (`tsc --noEmit`, no errors).
- `npm test` — 189 tests passed across 18 files (Vitest).
- `node scripts/fetch-upstream.mjs` (no flags) — removed the existing
  `./upstream`, shallow-cloned the current head, reported
  `upstream ready at ./upstream (beba39d)`. Re-ran it a second time
  immediately after: it updated (removed + re-cloned) rather than erroring,
  confirming idempotency.
- `node scripts/fetch-upstream.mjs --baseline` — read `UPSTREAM_BASELINE`,
  did a full clone, and `git checkout --detach`ed to `98327f5`, matching the
  baseline file exactly (`HEAD is now at 98327f5 ...`).
- `git status` / `git status --ignored` after every fetch — working tree
  clean, `upstream/` listed only under ignored files, never staged or
  tracked.
- Re-ran `node scripts/fetch-upstream.mjs` once more at the end (no flags) to
  leave `./upstream` at the current head rather than the baseline, which is
  the more representative day-to-day state for whoever opens this repo next.

## Limitations and follow-ups

- Whether `UPSTREAM_BASELINE` should stay pinned at `98327f5` or be reset to
  a later commit is explicitly out of scope for this ticket and for this run,
  per the ticket's own instruction — that decision belongs to the separate
  job already tracking it.
- None beyond that; the mechanism works exactly as specified.
