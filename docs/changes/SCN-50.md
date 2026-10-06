# SCN-50 — Implement `check-upstream-drift.mjs` against `.upstream.json`

> Type: feature · Date: 2026-10-06

## Context

`docs/SYNC.md` (WP-0.5) commits this repository to a specific promise: a tracked
copy of shared logic in `packages/core` can only stay trustworthy if something
notices the moment upstream (`rubanwd/slay-city`) changes a file this repo also
holds. `scripts/check-upstream-drift.mjs` already existed from earlier work
(SCN-3/WP-0.2) and satisfied the drift contract's basic shape — hash comparison,
exit codes 0/1/2, a readable report — and is already wired into CI
(`.github/workflows/ci.yml`'s `upstream-drift` job, nightly and per-PR). SCN-50
asked for three things that script didn't yet have: a convenience path that
fetches the upstream checkout itself rather than requiring one to already exist, a
`--baseline` flag to compare against a pinned commit instead of current head, a
`--json` output mode for machine consumption, and — the part with no prior
coverage at all — automated tests of the hash-comparison and exit-code behaviour
using fixtures instead of the real `rubanwd/slay-city` checkout.

## What was done

Rewrote `scripts/check-upstream-drift.mjs` to split pure, testable logic from the
CLI shell, and extended its behaviour:

- **Multi-manifest discovery.** `findManifests(packagesDir)` globs
  `packages/*/.upstream.json` instead of hardcoding
  `packages/core/.upstream.json`. Today that still finds exactly one file (only
  `packages/core` is tracked — see `docs/SYNC.md` §6), but any future tracked
  copy is picked up with no code change, matching the ticket's own
  "manifest(s) … and any other tracked copy" framing.
- **Pure core exported for tests.** `sha256`, `findManifests`, `loadManifest`,
  `checkManifest`, and `checkAll` are now named exports with no side effects —
  no `process.exit`, no console output — so a test can feed them a temp
  directory and a fixture manifest directly. The CLI (`main()`) only runs when
  the file is executed directly (`isMain()` guards on `process.argv[1]`), so
  importing the module for tests no longer triggers it.
- **Auto-fetch when the checkout is implicit.** Without an explicit
  `--upstream <path>`, the script now defaults to `./upstream` and, if that
  directory doesn't exist, shells out to `scripts/fetch-upstream.mjs` to clone
  the current upstream head before comparing. An **explicit** `--upstream <path>`
  (the form CI and `docs/SYNC.md` already documented) keeps the old behaviour
  exactly — missing is a hard error (exit 2), never a surprise network clone —
  because CI's `actions/checkout` step is what's supposed to populate that path,
  and silently substituting a live clone there would make a CI failure
  non-deterministic.
- **`--baseline` flag.** Forces a fresh fetch of `./upstream` pinned to the
  commit recorded in `UPSTREAM_BASELINE` (via
  `fetch-upstream.mjs --baseline`, which already implemented the pin/checkout
  logic) before comparing, so the check can be reproduced deterministically
  against the exact commit this repo was seeded from rather than whatever is
  on disk.
- **`--json` flag.** Emits an array (one entry per manifest) of
  `{ manifest, upstream, syncedFrom, syncedAt, total, inSync, drifted, missing }`,
  where `drifted` entries carry `local`, `upstream`, `adapted`, `note`,
  `expectedSha256` and `currentSha256`, so CI or another tool can consume the
  result without parsing the human-readable text report.
- **Text report unchanged in substance**, just restructured to loop over
  however many manifests were found: the in-sync summary, the drifted/missing
  listing with the `[adapted — needs judgement]` flag and resolution
  instructions, all read the same as before when there is exactly one
  manifest (the only case that exists today).

Added `scripts/check-upstream-drift.test.mjs` (10 tests) covering:
- `sha256`'s CRLF→LF normalization (the fix from SCN-2, now has a regression
  test).
- `findManifests` against a temp `packages/` tree with and without
  `.upstream.json` files present.
- `checkManifest`/`checkAll` against fixture manifests + fixture upstream
  files in `os.tmpdir()`-based temp directories: in-sync, drifted (content
  changed after the hash was recorded), and missing (upstream file deleted).
- The CLI itself, spawned as a real subprocess (`execFileSync`) against a temp
  working directory with its own `packages/` and `upstream/` trees: exit 0
  when freshly generated and in sync, exit 1 with the file named in both text
  and `--json` output after the fixture upstream file is modified, and exit 2
  when `--upstream` points at a path that doesn't exist.

Added the `drift:check` npm script (`node scripts/check-upstream-drift.mjs`,
no args — the auto-fetching convenience form) alongside the pre-existing
`upstream:check` (`--upstream ./upstream`, the explicit CI form) rather than
replacing it, since `upstream:check` is referenced from `CLAUDE.md`, `AGENTS.md`,
`README.md`, `docs/CONCEPT.md`, `docs/RISKS.md`, `.claude/settings.json`, and
`.github/workflows/ci.yml` — renaming it would be an unrelated, wide-blast-radius
change this ticket didn't ask for.

Extended `vitest.config.mts`'s `test.include` to also pick up
`scripts/**/*.test.mjs` (it previously only ran `packages/**/*.test.ts`), so the
new test file actually executes under `npm test`.

Verified against the real `rubanwd/slay-city` checkout (not just fixtures): the
current `./upstream` head finds genuine drift in 7 files (`database.ts`,
`types/index.ts`, the adapted `roleRouting.ts`, `i18n/messages.ts` and its three
locale files) relative to the manifest's `syncedFrom` commit from 2026-09-17 —
expected behaviour of a drift checker whose upstream has since moved, not a bug
introduced here. Resolving that drift is a `docs/SYNC.md` §4 exercise, out of
scope for this ticket, which is about the checker, not the backlog of the thing
it checks. `./upstream` was left re-fetched at current head afterward (it is
gitignored, so this has no working-tree effect).

## Changes by file

- `scripts/check-upstream-drift.mjs` — modified. Split into testable pure
  functions (`sha256`, `findManifests`, `loadManifest`, `checkManifest`,
  `checkAll`) plus a CLI shell (`parseArgs`, `ensureUpstream`, `printText`,
  `printJson`, `main`) guarded to run only when invoked directly. Added
  multi-manifest glob discovery, auto-fetch-if-missing, `--baseline`, and
  `--json`. Exit codes (0/1/2) and the text report's content are unchanged for
  the existing single-manifest, explicit-`--upstream` case CI already uses.
- `scripts/check-upstream-drift.test.mjs` — new. 10 tests: CRLF hashing,
  manifest discovery, in-sync/drifted/missing comparison against fixtures in
  temp directories, and CLI exit-code/output verification via subprocess.
- `package.json` — modified. Added the `drift:check` script
  (`node scripts/check-upstream-drift.mjs`); `upstream:check` is unchanged.
- `vitest.config.mts` — modified. `test.include` now also matches
  `scripts/**/*.test.mjs` so the new test file runs under `npm test`.
- `docs/SYNC.md` — modified. §4 now documents `npm run drift:check` (plain,
  `-- --baseline`, `-- --json`) alongside the existing CI invocation, and notes
  the explicit-vs-implicit `--upstream` fetch-on-missing distinction.

## Technical decisions

- **Rewrote the existing script rather than leaving it and adding a second
  one.** The ticket names `scripts/check-upstream-drift.mjs` specifically, and
  the file already implemented most of the contract (SCN-3/WP-0.2); extending
  it in place avoids two scripts doing almost the same thing and keeps the one
  CI already calls as the one source of truth.
- **Kept `upstream:check` instead of renaming it to `drift:check`.** The ticket
  says "add," not "rename," and `upstream:check`'s explicit `--upstream ./upstream`
  form is load-bearing in CI and documented in five other files. Added
  `drift:check` as the new, auto-fetching, no-args convenience form instead of
  overloading one script name with two different missing-checkout behaviours.
- **Auto-fetch only applies when `--upstream` is omitted.** Tried the
  alternative (always auto-fetch, explicit path or not) and rejected it: CI's
  `upstream-drift` job relies on a failure there meaning "the `actions/checkout`
  step didn't do what it was supposed to," not "and here's a live clone instead."
  Collapsing that distinction would make a CI red build quietly self-heal into a
  non-deterministic comparison against whatever GitHub currently serves.
- **`--baseline` always re-fetches, never trusts an existing `./upstream`.** A
  directory that happens to exist could be at any commit (current head from a
  previous run, a stale clone, mid-checkout). Only a fresh, forced checkout via
  `fetch-upstream.mjs --baseline` (which itself always removes and re-clones)
  guarantees the comparison is actually against `UPSTREAM_BASELINE`.
- **Multi-manifest glob over a hardcoded path**, even though only one manifest
  exists today. The ticket's own wording ("manifest(s) … any other tracked
  copy") and `docs/SYNC.md` §6's "not tracked" table (which is a point-in-time
  decision, not a permanent one) both point at this becoming non-singular
  eventually; the glob costs nothing now and removes a future migration.
- **Tests live in `scripts/`, not `packages/`,** as plain `.test.mjs` files
  mirroring the `.mjs` scripts they test, rather than `.ts` under `packages/`.
  The script itself is plain Node ESM with no TypeScript in its lineage;
  writing the test in TypeScript would need to resolve types for a `.mjs`
  import, an unforced complication for a script this repo has never
  type-checked (`tsconfig.json`'s `include` is `**/*.ts`/`**/*.tsx` only — the
  three pre-existing `scripts/*.mjs` files aren't type-checked today either).
  `vitest.config.mts`'s `include` was extended rather than switching to a
  catch-all glob, keeping `packages/**/*.test.ts` and `scripts/**/*.test.mjs`
  as two explicit, intentional suites.

## Data, API and configuration

- No schema, RPC, or environment changes.
- New npm script: `drift:check` → `node scripts/check-upstream-drift.mjs`.
- No new dependencies — the auto-fetch path reuses the existing
  `scripts/fetch-upstream.mjs` via `execFileSync`, not a new library.
- No change to `.github/workflows/ci.yml` — the existing `upstream-drift` job's
  `node scripts/check-upstream-drift.mjs --upstream ./upstream` invocation is
  the explicit-path case, untouched in behaviour.

## How to verify

- `npm test` — 263/263 pass (253 pre-existing + 10 new in
  `scripts/check-upstream-drift.test.mjs`).
- `npm run type-check` — clean, no output.
- `npm run lint` — clean, no output.
- Manual, against the real upstream checkout:
  - `node scripts/check-upstream-drift.mjs --upstream ./upstream` → exit 1,
    names 7 genuinely drifted files (real-world drift, confirmed pre-existing
    and out of this ticket's scope).
  - `node scripts/check-upstream-drift.mjs --json` → same result as structured
    JSON.
  - `node scripts/check-upstream-drift.mjs --baseline --json` → re-clones
    `./upstream` pinned to the `UPSTREAM_BASELINE` commit (`98327f5`) and
    reports drift against that older commit instead (1 file, `levels.ts`) —
    confirms the flag's fetch-and-pin wiring actually works end to end, not
    just that it parses.
  - `node scripts/check-upstream-drift.mjs --upstream ./does-not-exist` →
    exit 2.
- `git status --porcelain` after this run shows only the four files listed
  above — no change under `packages/core/**` or `.upstream.json` itself.

## Limitations and follow-ups

- The real drift this run surfaced (7 files, listed above) is not resolved
  here — resolving it is a `docs/SYNC.md` §4 exercise (read the upstream diff,
  decide adapted-vs-not, copy or hand-apply, update the hash) and belongs in
  its own ticket, not folded into "build the checker."
- `--baseline` and the auto-fetch path both shell out to
  `fetch-upstream.mjs`, which always targets the literal `./upstream` directory
  regardless of any `--upstream` value — so combining an explicit, non-default
  `--upstream <other-path>` with `--baseline` is not meaningful and isn't
  specially guarded against beyond `--upstream`'s own precedence (explicit path
  skips the fetch logic entirely). This matches how `fetch-upstream.mjs` already
  worked before this ticket; not a new limitation introduced here.
- No CI workflow change was made to add a `--json`-based machine step (e.g. a
  PR comment or a GitHub Actions job summary built from the structured output) —
  the ticket asked for the flag to exist, not for a consumer of it yet.
