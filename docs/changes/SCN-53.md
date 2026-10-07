# SCN-53 — Configure Expo Router and path aliases to core, data and tokens packages

> Type: task · Date: 2026-10-07

## Context

WP-1.1 asks for `@/*`, `@slay/core`, `@slay/data` and `@slay/tokens` (plus the
app's own `~/*`) to resolve everywhere that matters: `tsc`, Metro's bundler,
and the test runner — not just in the editor. The ticket's own framing says
"the bootstrap already exists, so do not recreate it; only extend the
configuration", which matches `SCN-45`'s scaffold: `tsconfig.json` already
carried every alias and `app.json` already had the `slaycity` scheme, the
`expo-router` plugin and `typedRoutes`/`tsconfigPaths` experiments turned on
from day one. This run's job was to find whatever part of that configuration
genuinely doesn't resolve yet — specifically Metro bundling, which is a
different resolution path from `tsc` and easy to assume works when it
doesn't — and close only that gap.

## What was done

Audited each of the ticket's five steps against the current tree and the
installed toolchain (Expo SDK 57, Metro 0.84.5, expo-router ~57.0.21) instead
of assuming the ticket's checklist was still outstanding:

1. **`tsconfig.json` `paths`** — already complete. `@slay/core`,
   `@slay/core/*`, `@slay/data`, `@slay/data/*`, `@slay/tokens`,
   `@slay/tokens/*`, `@/*` (→ `packages/core/src/*`, for the copied modules'
   own internal imports) and `~/*` (→ `src/*`) were all present.
2. **Mirroring the aliases in Metro/Babel** — turned out to need no new
   config at all, once traced through the installed `@expo/cli`. Expo's
   Metro integration (`withMetroMultiPlatform.js`, inside
   `node_modules/expo/node_modules/@expo/cli`) wires a
   `createTypescriptResolver` into Metro's resolver chain whenever
   `isTsconfigPathsEnabled` is true — which it already is here, both by the
   `@expo/cli` default (`exp.experiments?.tsconfigPaths ?? true`) and by the
   explicit `"tsconfigPaths": true` already in `app.json`. That resolver
   reads `tsconfig.json`'s `paths` directly, so every alias Metro needs is
   the same list TypeScript already has — there is no second alias map to
   keep in sync, and adding `babel-plugin-module-resolver` or
   `resolver.extraNodeModules` on top would have been redundant (the latter
   would also have been the wrong tool for `@/*`: Metro's bare-specifier
   parser treats `@/<first-segment>` as the "package name" for
   `extraNodeModules` purposes, so a wildcard `@/*` can't be expressed that
   way without enumerating every top-level folder under `packages/core/src`).
3. **`app.json`** — already complete: `scheme: "slaycity"`, `"expo-router"`
   in `plugins`, and `experiments: { typedRoutes: true, tsconfigPaths: true }`
   were all already set.
4. **Smoke-proving resolution** — `@slay/core` and `@slay/tokens` already
   have real production call sites (`src/components/ui/*`,
   `src/lib/supabase.ts`, `app/_layout.tsx`, `app/dev/ui.tsx`), so Metro
   bundling them was already exercised every time the app runs. `@slay/data`
   had no consumer anywhere in `app/` or `src/` yet (nothing in the UI calls
   its RPC wrappers before `WP-1.5`/`WP-2.x` land), so it was the one alias
   genuinely unproven against Metro. Added a temporary `import "@slay/data";`
   to `app/dev/ui.tsx`, ran `npx expo export --platform android`, confirmed a
   clean bundle (1665 modules, no resolution error), then removed the import
   — per the ticket's own step 4 ("remove it... if it adds noise"), since an
   unused side-effect import of a package nothing in the app consumes yet
   would be exactly that: noise with no ongoing test value. `git status` is
   clean; nothing from the smoke check was left behind.
5. **Jest aliases** — this project has never used Jest; `npm test` runs
   Vitest, a decision `SCN-45` already made and documented explicitly against
   this same literal ticket wording. `vitest.config.mts` already has
   `resolve.alias` entries for `@/`, `@slay/core`, `@slay/data` and
   `@slay/tokens` mirroring `tsconfig.json`, and `packages/data/src/*.test.ts`
   already import from `@slay/core` through that alias. Ran `npm test` to
   confirm rather than trust the config file alone: 263 tests across 28 files
   passed, no alias-resolution failures.

Net result: no source change was needed. Every acceptance criterion was
already met by the `SCN-45` bootstrap; this run's contribution is verifying
that explicitly (including the one alias — `@slay/data` — that had no
existing proof) and recording *why* no Metro/Babel/Jest config edit was
correct, so a future reader doesn't re-open this as a gap.

## Changes by file

- `docs/changes/SCN-53.md` — new. This file.

No other files changed. The temporary `import "@slay/data";` added to
`app/dev/ui.tsx` for the Metro bundling check was reverted in the same run;
`git status` shows a clean tree.

## Technical decisions

- **Did not add `babel-plugin-module-resolver` or `resolver.extraNodeModules`
  to `metro.config.js`.** Both were explicitly offered as options in the
  ticket's step 2, but Expo's built-in `tsconfigPaths` resolver already
  covers every alias Metro needs by reading `tsconfig.json` directly,
  confirmed by a real `npx expo export` bundling `@slay/core`, `@slay/data`
  and `@slay/tokens` together with no resolver config beyond what already
  existed. Adding either would have created a second alias list to keep in
  sync with `tsconfig.json` for no behavioural gain, and
  `resolver.extraNodeModules` specifically can't express a `@/*` wildcard
  correctly (Metro's specifier parser folds the first path segment after
  `@/` into the "package name", so each top-level folder under
  `packages/core/src` would need its own explicit entry).
- **Did not introduce Jest.** Consistent with `SCN-45`'s precedent: the
  project standardised on Vitest for `npm test` before this ticket existed,
  and the ticket's acceptance criteria only require that aliased imports are
  testable, not that the test runner is specifically Jest. Flagged here
  rather than silently reinterpreted, same as `SCN-45`.
- **Removed the `@slay/data` smoke import after verifying, rather than
  keeping it as a permanent test.** The ticket's own step 4 allows either;
  since nothing in the app consumes `@slay/data` yet, a bare side-effect
  import would be unused-import noise with no future regression value — the
  next ticket that actually calls one of its RPC wrappers from a screen will
  exercise this resolution path for real.

## Data, API and configuration

None. No schema, auth, or public API changes; no new dependencies; no
`supabase/` directory added.

## How to verify

- `npx tsc --noEmit` — passes with no errors (all four aliases plus `~/*`
  resolve for the type checker).
- `npx expo export --platform android` — bundled 1665 modules with no
  resolution error, run twice: once with a temporary `@slay/data` smoke
  import in `app/dev/ui.tsx` to prove that specific alias bundles through
  Metro, and once after reverting it to confirm the baseline app (which
  already exercises `@slay/core`/`@slay/tokens`) still bundles clean.
- `npm test` — 263 tests across 28 files passed, including
  `packages/data/src/*.test.ts`, which imports from `@slay/core` through
  Vitest's alias config.
- `git status` — clean; confirms the temporary smoke import left no trace.

## Limitations and follow-ups

- No screen yet imports `@slay/data` for real; its Metro resolution is
  proven by this run's temporary check but has no permanent regression
  coverage. The first ticket that wires a real screen to one of its RPC
  wrappers (`WP-1.5` onward) will cover it as a side effect.
- Test runner remains Vitest, not Jest, despite the ticket's step 5 wording —
  see Technical decisions. Unchanged from `SCN-45`'s decision; raise it to a
  maintainer only if a future dependency specifically requires Jest's
  transform pipeline.
