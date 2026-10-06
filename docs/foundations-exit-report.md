# Foundations (P3) exit report

> Verification run: 2026-10-07. Ticket: SCN-52 (re-verified after SCN-52-1).

P3's exit line, from [docs/ROADMAP.md](ROADMAP.md#p3---foundations):

> `npm run lint`, `type-check` and `test` pass; the drift check reports every
> tracked file in sync; a bare Expo app builds; `rubanwd/slay-city` has zero
> commits from this work.

This report checks each clause against a real run, not against what the code
is supposed to do.

**Update (2026-10-07):** the first pass of this report (below, superseded)
found criterion 2 failing — 7 of 48 tracked files had drifted from upstream.
That was handed off as follow-up ticket **SCN-52-1**, which resolved the
drift (commit `2a04a77`). This report re-runs the full checklist against the
post-fix state. All automatically-verifiable criteria now pass.

## Summary

| # | Criterion | Result | Evidence |
| - | --- | --- | --- |
| 1 | `lint`, `type-check`, `test` pass | ✅ Pass | §1 |
| 2 | Drift check reports every tracked file in sync | ✅ Pass | §2 |
| 3 | A bare Expo app builds/exports | ✅ Pass | §3 |
| 4 | No `supabase/migrations/`; `upstream/` gitignored and tool-excluded | ✅ Pass | §4 |
| 5 | `rubanwd/slay-city` has zero commits from this work | ⚠️ Manual check required | §5 |

## 1. `lint`, `type-check`, `test`

```
> npm run lint
> eslint .
(no output — 0 problems)

> npm run type-check
> tsc --noEmit
(no output — 0 errors)

> npm test
> vitest run
 Test Files  28 passed (28)
      Tests  263 passed (263)
   Duration  1.57s
```

The line printed during the test run —
`upstream checkout not found: ...\scn-50-cli-HOeEft\does-not-exist` — is
`scripts/check-upstream-drift.test.mjs` exercising its own missing-checkout
error path on purpose, not a failure (exit summary is 28/28 files, 263/263
tests, no non-zero exit).

(`npm ci` still fails with `EPERM` on a locked `lightningcss` native binary on
this Windows machine — a local environment quirk, not a repo problem; see
`npm-ci-eperm-locked-on-this-machine` project memory. `npm install` works and
was used instead.)

**Result: pass.**

## 2. Drift check — tracked files in sync

```
> npm run upstream:fetch
cloning https://github.com/rubanwd/slay-city.git (current upstream head)
upstream ready at ./upstream (beba39d)

> npm run drift:check
✓ 48 tracked files in sync
  https://github.com/rubanwd/slay-city — last synced from beba39da099685c1a8af39364e997e265c0642ca on 2026-10-06T21:14:59.973Z
```

Upstream head is still `beba39d` (same commit the original report measured
drift against). `packages/core/.upstream.json` now records
`syncedFrom: beba39da...` matching that head exactly — SCN-52-1 (commit
`2a04a77`, 2026-10-06) pulled in the 7 files that had drifted (`types/database.ts`,
`types/index.ts`, `features/auth/roleRouting.ts`, and the four i18n message
files) and updated their recorded hashes.

**Result: pass.** All 48 tracked files report in sync as of this run.

## 3. Bare Expo app builds/exports

```
> npx expo export --platform web
Web Bundled 32837ms index.ts (860 modules)
...
Exported: dist
```

Exit code 0, `dist/` produced (web bundle, assets, `index.html`,
`metadata.json`). `dist/` is gitignored (`.gitignore` line `dist/`) and
`git status` is clean after the export — no build output leaked into the
tree. Per the ticket, this check intentionally avoids `expo prebuild`/EAS,
which would need native toolchains or store credentials not required at this
phase.

**Result: pass.**

## 4. No `supabase/migrations/`; `upstream/` isolated

- No `supabase/` directory exists at the repo root, and `git log --all --
  supabase` returns no history — matching `CLAUDE.md`'s "there is no
  `supabase/` directory here on purpose."
- `.gitignore` — `upstream/` is ignored, with a comment explaining why a
  snapshot is never committed.
- `tsconfig.json` — `"exclude": ["node_modules", "upstream", "docs"]`.
- `eslint.config.js` — top-level `{ ignores: ["node_modules/", ".expo/",
  "upstream/", "dist/", "android/", "ios/", "docs/"] }`, plus a
  `no-restricted-imports` rule on `app/**` and `src/**` banning `upstream/*`
  and `../upstream/*` imports outright.
- `vitest.config.mts` — `test.include: ["packages/**/*.test.ts",
  "scripts/**/*.test.mjs"]`; `upstream/` is excluded by construction, not by
  an explicit ignore pattern.

**Result: pass.**

## 5. `rubanwd/slay-city` has zero commits from this work

This cannot be verified from inside `slay-city-native` — it requires looking
at the commit history/PRs of the separate `rubanwd/slay-city` repository,
which this agent has no write access to and no ability to independently
audit for *authorship intent* (a legitimate upstream PR from the sync
workflow would look identical, in a diff, to an accidental one).

**Result: flagged as a manual check for the maintainer.** Suggested check:
`git -C upstream log --oneline --since=2026-09-17` (the last `packages/core`
sync date prior to SCN-52-1) against the author list, confirming nothing
authored by this project's agents/branches landed there outside the normal
`docs/SYNC.md` §4 pull-from-upstream workflow.

## How to reproduce this report

```bash
npm install            # npm ci may hit an EPERM on native binaries on Windows; see §1
npm run lint
npm run type-check
npm test
npm run upstream:fetch
npm run drift:check
npx expo export --platform web
```
