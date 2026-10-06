# Foundations (P3) exit report

> Verification run: 2026-10-07. Ticket: SCN-52.

P3's exit line, from [docs/ROADMAP.md](ROADMAP.md#p3---foundations):

> `npm run lint`, `type-check` and `test` pass; the drift check reports every
> tracked file in sync; a bare Expo app builds; `rubanwd/slay-city` has zero
> commits from this work.

This report checks each clause against a real run, not against what the code
is supposed to do. One clause fails (see §2) — it is recorded here as a
finding with a concrete next step, not silently fixed, per this ticket's
scope.

## Summary

| # | Criterion | Result | Evidence |
| - | --- | --- | --- |
| 1 | `lint`, `type-check`, `test` pass | ✅ Pass | §1 |
| 2 | Drift check reports every tracked file in sync | ❌ **Fail** | §2 |
| 3 | A bare Expo app builds/exports | ✅ Pass | §3 |
| 4 | No `supabase/migrations/`; `upstream/` gitignored and tool-excluded | ✅ Pass | §4 |
| 5 | `rubanwd/slay-city` has zero commits from this work | ⚠️ Manual check required | §5 |

## 1. `lint`, `type-check`, `test`

Install: `npm ci` failed on this Windows machine with `EPERM` while deleting
`node_modules/react-native-css-interop/node_modules/lightningcss-win32-x64-msvc/lightningcss.win32-x64-msvc.node`
(a native binary, repeatable across two attempts — a locked file on this
machine, not a repository problem). Used `npm install` instead, which does not
require removing `node_modules` first; it completed cleanly (840 added, 64
changed, 906 audited).

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
   Duration  2.01s
```

The one line printed during the test run —
`upstream checkout not found: ...\scn-50-cli-nERI2w\does-not-exist` — is
`scripts/check-upstream-drift.test.mjs` exercising its own missing-checkout
error path on purpose, not a failure (confirmed: exit summary is 28/28 files,
263/263 tests, no non-zero exit).

**Result: pass.** All three commands are green on a fresh `npm install`.

## 2. Drift check — tracked files in sync

```
> npm run upstream:fetch
cloning https://github.com/rubanwd/slay-city.git (current upstream head)
upstream ready at ./upstream (beba39d)

> npm run drift:check
packages\core\.upstream.json (https://github.com/rubanwd/slay-city):
✗ 7 of 48 tracked files drifted
  packages/core/src/types/database.ts
  packages/core/src/types/index.ts
  packages/core/src/features/auth/roleRouting.ts [adapted — needs judgement]
  packages/core/src/features/i18n/messages.ts
  packages/core/src/features/i18n/messages/en.ts
  packages/core/src/features/i18n/messages/ru.ts
  packages/core/src/features/i18n/messages/uk.ts
```

`packages/core/.upstream.json` records `syncedFrom: 21b4d87c` (2026-09-17).
Current upstream head is `beba39d` (2026-10-04, "feat(placement): show which
answer was tapped before moving on (#112)"). Upstream moved 7 of the 48
tracked files' content since the last sync, including one file already marked
`adapted: true` (`roleRouting.ts`) whose existing note says the adaptation
only concerns two functions outside this file — that note has not been
re-checked against the `beba39d` diff.

**Result: fail, as of this run.** This is the mechanism working as designed —
WP-0.5 exists precisely to turn silent drift into a visible, actionable
list — not a defect in the drift script or CI job (SCN-50, SCN-51). But the
exit criterion is "every tracked file in sync," and today it is not.

**Next step (not done here, out of scope for this ticket):** resolve each of
the 7 files per `docs/SYNC.md` §4 — diff against
`upstream/src/types/database.ts` etc., copy or hand-apply the change, run
`npm test`, and update the corresponding `sha256` (and, for `roleRouting.ts`,
re-confirm the adaptation note still holds) in
`packages/core/.upstream.json`. Until that lands, the nightly `drift` job
(SCN-51) will report this same failure.

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

- `find . -maxdepth 1 -iname supabase` — no match. `git log --all -- supabase`
  — no history. There is no `supabase/` directory and never has been, matching
  `CLAUDE.md`'s "there is no `supabase/` directory here on purpose."
- `.gitignore` — `upstream/` is ignored, with a comment explaining why a
  snapshot is never committed.
- `tsconfig.json` — `"exclude": ["node_modules", "upstream", "docs"]`.
- `eslint.config.js` — top-level `{ ignores: ["node_modules/", ".expo/",
  "upstream/", "dist/", "android/", "ios/", "docs/"] }`, plus a
  `no-restricted-imports` rule on `app/**` and `src/**` banning `upstream/*`
  and `../upstream/*` imports outright (belt-and-suspenders against someone
  importing from it even if the ignore were ever narrowed).
- `vitest.config.mts` — `test.include: ["packages/**/*.test.ts",
  "scripts/**/*.test.mjs"]`; `upstream/` is excluded by construction, not by
  an explicit ignore pattern.

**Result: pass.** (This duplicates part of what SCN-46 already verified for
WP-0.1 specifically; re-checked here directly rather than trusted, since this
ticket's exit criterion names it independently.)

## 5. `rubanwd/slay-city` has zero commits from this work

This cannot be verified from inside `slay-city-native` — it requires looking
at the commit history/PRs of the separate `rubanwd/slay-city` repository,
which this agent has no write access to and no ability to independently
audit for *authorship intent* (a legitimate upstream PR from the sync
workflow would look identical, in a diff, to an accidental one).

**Result: flagged as a manual check for the maintainer.** Suggested check:
`git -C upstream log --oneline --since=2026-09-17` (the last
`packages/core` sync date) against the author list, confirming nothing
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
