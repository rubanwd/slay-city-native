# SCN-52 — Verify Foundations exit criteria and record the results

> Type: task · Date: 2026-10-07

## Context

The Foundations phase (P3 in [docs/ROADMAP.md](../ROADMAP.md)) spans WP-0.1
through WP-0.5 — repository bootstrap, `packages/core`, `packages/data`,
`packages/tokens`, and the drift contract — and all five work packages had
already landed (SCN-45 through SCN-51). Before the project moves on to P4
(mobile shell), the roadmap's own exit line for P3 needed to be checked
against a real, current run rather than assumed true because the individual
work-package tickets had each closed out: "`npm run lint`, `type-check` and
`test` pass; the drift check reports every tracked file in sync; a bare Expo
app builds; `rubanwd/slay-city` has zero commits from this work." This ticket
is a checklist verification, explicitly scoped not to fix whatever it finds
failing.

## What was done

Ran each clause of the P3 exit line as a live command against a fresh
install, rather than inspecting config files and inferring the outcome:

1. **Clean install.** `npm ci` failed twice with `EPERM` deleting a locked
   native binary
   (`node_modules/react-native-css-interop/node_modules/lightningcss-win32-x64-msvc/lightningcss.win32-x64-msvc.node`)
   — a Windows-machine-local lock, not a repository issue. Fell back to
   `npm install`, which succeeded (840 added, 64 changed, 906 audited) without
   needing to delete `node_modules` first.
2. **`npm run lint`, `npm run type-check`, `npm test`** — all three green:
   0 lint problems, 0 type errors, 263/263 tests across 28 files.
3. **`npm run upstream:fetch` then `npm run drift:check`.** Fetch succeeded
   (current upstream head `beba39d`). The drift check **failed**: 7 of 48
   files tracked in `packages/core/.upstream.json` have drifted from upstream
   since the last sync (`21b4d87c`, 2026-09-17) — `types/database.ts`,
   `types/index.ts`, the already-`adapted` `features/auth/roleRouting.ts`,
   and the four i18n message files (`messages.ts`, `en.ts`, `ru.ts`,
   `uk.ts`). This is the drift mechanism (WP-0.5, SCN-50/51) doing exactly
   what it's designed to do — upstream genuinely moved — not a defect in the
   check itself. Per this ticket's scope, the drift was recorded, not
   resolved.
4. **`npx expo export --platform web`.** Exit 0; produced a `dist/` bundle
   (860 modules, web JS/CSS bundles, assets, `index.html`). `git status` was
   clean afterward — `dist/` is gitignored, confirming no build artifact
   leaks into the tree.
5. **No `supabase/migrations/`; `upstream/` isolation.** Confirmed directly:
   no `supabase/` directory exists and none ever has (`git log --all --
   supabase` is empty); `upstream/` is gitignored with an explanatory comment
   and excluded from `tsconfig.json` (`exclude`), `eslint.config.js`
   (top-level `ignores` plus a `no-restricted-imports` ban on importing it
   from `app/`/`src/`), and `vitest.config.mts` (`test.include` scoped to
   `packages/**` and `scripts/**`, so `upstream/` is excluded by
   construction).
6. **`rubanwd/slay-city` has zero commits from this work.** Cannot be
   verified from this repository or by this agent — it requires auditing the
   separate web repository's commit history for authorship intent, which is
   outside what a read-only `upstream/` checkout can confirm. Flagged as a
   manual check for the maintainer in the report, with a suggested command.

Wrote all five results, with the exact command output backing each one, to
`docs/foundations-exit-report.md`.

## Changes by file

- `docs/foundations-exit-report.md` — new. The exit-criteria checklist: one
  row per P3 exit clause (pass/fail/manual-check), followed by a section per
  criterion with the command run and its output, and — for the one failing
  criterion — a concrete next step (resolve each of the 7 drifted files per
  `docs/SYNC.md` §4, update their hashes in `packages/core/.upstream.json`)
  rather than a fix applied in this ticket.
- `docs/changes/SCN-52.md` — new. This file.

No source, config, or dependency files were changed — this ticket is
verification-only, and its own scope note says not to fix whatever the
checks turn up.

## Technical decisions

- **Reported the drift failure instead of resolving it.** The ticket
  explicitly separates "verify exit criteria" from "fix arbitrary failing
  checks," and the acceptance criteria require failures to be described with
  a next step rather than silently fixed outside scope. Resolving 7 drifted
  files (one of them `adapted`, needing judgement about whether the upstream
  change still applies through the adaptation) is real work with its own
  review surface — it belongs in a dedicated ticket, not folded into a
  checklist report.
- **`npm install` over forcing `npm ci` to succeed.** The `EPERM` was a file
  lock on this specific Windows machine (a native `.node` binary, likely held
  by antivirus or another process), reproduced identically on a second
  attempt. Deleting `node_modules` by hand to force `npm ci` through would
  have been a destructive workaround for a local environment quirk, not
  something worth encoding as a repository fix; `npm install` gives the same
  dependency tree from `package-lock.json` without first requiring a clean
  removal.
- **Flagged criterion 5 rather than guessing at it.** Checking "zero commits
  from this work" against `rubanwd/slay-city` needs the web repository's own
  history and an authorship judgement call this agent isn't positioned to
  make correctly — a wrong "pass" here would be worse than an honest
  "needs a human."

## Data, API and configuration

None. No schema, dependency, or environment changes.

## How to verify

- Re-run the six commands listed at the end of
  `docs/foundations-exit-report.md` (`npm install`, `npm run lint`,
  `npm run type-check`, `npm test`, `npm run upstream:fetch`,
  `npm run drift:check`, `npx expo export --platform web`) and compare
  against the output recorded there.
- `git status --short` after the export shows only
  `docs/foundations-exit-report.md` as untracked — confirms `dist/` and
  `upstream/` stayed out of the tree.

## Limitations and follow-ups

- **Drift must be resolved before P3 can be called fully closed.** A
  follow-up ticket should sync the 7 drifted files listed in
  `docs/foundations-exit-report.md` §2 against upstream commit `beba39d` (or
  whatever upstream head is current when that ticket runs), including
  re-checking the `roleRouting.ts` adaptation note.
- **Criterion 5 (zero commits in `rubanwd/slay-city`) is an open manual
  check** for the maintainer — see `docs/foundations-exit-report.md` §5 for
  the suggested verification command.
- `npm ci`'s `EPERM` on this Windows machine was not root-caused (likely an
  antivirus or indexing process holding a lock on a native `.node` file under
  `node_modules`); worth a look if CI ever needs to reproduce a Windows build
  environment, though it did not block this ticket since `npm install` is an
  adequate substitute for verification purposes.
