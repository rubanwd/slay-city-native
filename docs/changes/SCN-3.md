# SCN-3 — Port and track core logic to packages/core

> Type: task · Date: 2026-09-28

## Context

The sync contract in `docs/SYNC.md` depends on `packages/core` holding a
faithful, tracked copy of the web app's pure-logic modules — reward maths,
unlock rules, puzzle generation, streak logic, validation, i18n dictionaries —
so the phone and the browser pay the same XP for the same mission. SCN-3 asked
for that copy (~6,000 lines, all unit tests included, hashes tracked in
`packages/core/.upstream.json`, drift check verified) plus configuring
`packages/core` as a proper TypeScript package with its own `tsconfig.json`
and an exports map.

## What was done

The copy itself — 48 files, ~6,800 lines, upstream's own 184 tests — had
already been delivered in an earlier work package (WP-0.2, commit `290e8a5`)
and re-verified end-to-end in SCN-2, which also fixed a CRLF hashing bug in
the drift check. Re-checking this run against every clause of SCN-3 found
that work intact and correct:

- `packages/core/src/**` mirrors upstream's `src/` tree exactly (46 of 48
  files byte-identical; `features/auth/roleRouting.ts` and `lib/hiss.ts` are
  the two deliberately adapted files, each documenting in its own header what
  was left behind and why).
- `packages/core/.upstream.json` records the upstream path and SHA-256 for
  all 48 tracked files.
- `npm test` passes 184/184 across 16 files, `npm run lint` and
  `npm run type-check` are clean.
- `node scripts/check-upstream-drift.mjs --upstream ./upstream` (verified in
  SCN-2) recognizes all 48 files as tracked and confirms their hashes.

The one clause not yet satisfied was "Configure `packages/core` as a
TypeScript package with its own tsconfig and exports map" — `packages/core`
had no `package.json` or `tsconfig.json` of its own; every alias
(`@slay/core`, `@slay/core/*`, `@/*`) was resolved purely through the root
`tsconfig.json`'s `paths`, with no per-package identity. That is the gap this
run closed, without touching any tracked file or the manifest (no functional
change to the shared logic, per the ticket).

Added `packages/core/package.json` naming the package `@slay/core` with an
`exports` map (`.` → `src/index.ts`, `./types` → `src/types/index.ts`, `./*` →
`src/*`) that mirrors exactly what the root `tsconfig.json` path aliases and
`packages/core/README.md`'s documented import surface already allow —
`@slay/core`, `@slay/core/types`, and any other subpath. Added
`packages/core/tsconfig.json`, extending the root config, scoped to
`src/**/*.ts`, so the package can be type-checked standalone
(`tsc --noEmit -p packages/core`) independent of the rest of the monorepo —
useful now for isolating a bad copy during a sync, and a direct step towards
the "publish `@slay/core` as a private npm package" escape hatch `docs/SYNC.md`
§5 already describes.

Metro, Babel and Vitest continue to resolve `@slay/core` through the existing
root `tsconfig.json` paths / `vitest.config.mts` aliases exactly as before —
none of those were touched, and none needed to be. The new `package.json` and
`tsconfig.json` give the package an identity and a type-checkable boundary
without changing how anything currently imports it or requiring npm
workspaces, which the repository does not use.

## Changes by file

- `packages/core/package.json` — new. Declares `@slay/core` as a private,
  ESM, zero-build TypeScript package with `main`/`types` pointing at
  `src/index.ts` and an `exports` map covering the root barrel, the `/types`
  subpath, and a `./*` wildcard for everything else — matching the existing
  tsconfig alias surface. Adds a `type-check` script (`tsc --noEmit`) so the
  package can be checked in isolation.
- `packages/core/tsconfig.json` — new. Extends the root `tsconfig.json`,
  scoped to `include: ["src/**/*.ts"]`, `noEmit: true`, so
  `tsc --noEmit -p packages/core` type-checks just this package.

## Technical decisions

- **Did not re-copy or re-verify the 48 tracked files.** They were already
  ported correctly in WP-0.2 and re-verified in SCN-2 (including a real
  hashing bug fix in the drift script). Re-doing that work would risk
  reintroducing drift between the copy and upstream for no benefit — the
  acceptance criterion is that the copy and its hashes are correct, which they
  already were.
- **Did not add `package.json`/`tsconfig.json` to `packages/data` or
  `packages/tokens`.** The ticket asks specifically about `packages/core`,
  and `docs/SYNC.md` §5's publish-as-npm-package escape hatch is scoped to
  `@slay/core` only — `packages/data`'s functions take an injected Supabase
  client and `packages/tokens` is tracked by eye, neither is a sync-contract
  candidate for standalone packaging. Giving only `packages/core` this shape
  is the intentional asymmetry, not an oversight.
- **Did not introduce npm workspaces.** A workspace-linked package would let
  Node's real `exports` resolution kick in, but nothing in this repository
  currently needs that — Metro, Babel and Vitest all resolve `@slay/core` via
  path aliases already, and `AGENTS.md`'s layer-rules table treats
  `packages/core` as a source tree, not an installable dependency. Adding
  workspaces would be an unrequested, unreviewed restructuring of module
  resolution across the whole repo for a ticket about one package's metadata.
  The `package.json`/`exports` map added here is forward-compatible with
  workspaces or an eventual npm publish, should that decision get made later,
  without requiring either today.
- **`tsconfig.json` extends the root config rather than duplicating its
  `compilerOptions`.** The root config already carries `expo/tsconfig.base`,
  `strict: true`, and every path alias the copied modules need (`@/*` for
  their internal upstream-mirrored imports); redeclaring any of that in the
  package tsconfig would be a second place for it to drift out of sync with
  the root.

## Data, API and configuration

- No dependency, schema, RPC, or environment changes.
- No changes to `package.json` scripts at the repo root, `babel.config.js`,
  `metro.config.js`, or `vitest.config.mts` — all continue to resolve
  `@slay/core` exactly as before.
- No changes to any file under `packages/core/src/**` or
  `packages/core/.upstream.json`.

## How to verify

- `npx tsc --noEmit -p packages/core/tsconfig.json` — passes with no output,
  confirming the package type-checks standalone.
- `npm run type-check` — passes (root check, unaffected).
- `npm run lint` — passes with no warnings or errors.
- `npm test` — 184/184 tests pass across 16 files (unchanged from before this
  run; no test files were touched).
- Manual: `git status --porcelain` shows only the two new files under
  `packages/core/` from this run, plus the pre-existing `SCN-2` changes
  already in the working tree; no file under `packages/core/src` was
  modified.

## Limitations and follow-ups

- The `exports` map points directly at `.ts` sources (no build step), which
  is correct for how this repository consumes `@slay/core` today (via
  bundler/tsconfig path aliases) but would need a real build
  (`tsc --project packages/core --outDir dist`) before it could be published
  or `npm install`-ed by another repository, per the `docs/SYNC.md` §5
  escape hatch. Out of scope here — that section is explicit that the
  decision to actually publish is made on evidence (drift frequency, adapted
  file count), not preference.
- The one open drift finding noted in SCN-2
  (`packages/core/src/features/auth/roleRouting.ts`, confined to the
  non-shared, already-adapted-out `ensureRoleProfile`/`resolveHomePath`
  functions) remains unresolved, unchanged by this run — it is a manifest
  content decision per `docs/SYNC.md` §4, not part of either SCN-2 or SCN-3.
