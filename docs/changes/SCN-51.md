# SCN-51 — Add drift-check CI job with nightly schedule

> Type: task · Date: 2026-10-07

## Context

`docs/SYNC.md` (WP-0.5) commits this repository to detecting the moment
`rubanwd/slay-city` changes a file `packages/core` holds a tracked copy of,
rather than letting a phone/browser XP mismatch be how a user finds out.
WP-0.5's own acceptance criteria (`docs/WORK-PACKAGES.md` AC3) already called
for "a CI job [that] checks out `rubanwd/slay-city` and runs [the drift check]
on every pull request and nightly," and SCN-1 had wired exactly that up as the
`upstream-drift` job in `.github/workflows/ci.yml`. SCN-51 asked for the same
outcome through a different, more specific mechanism — `npm ci` +
`npm run upstream:fetch` + `npm run drift:check` instead of a second
`actions/checkout` — plus three things the existing job didn't have:
`workflow_dispatch` for on-demand runs, a `$GITHUB_STEP_SUMMARY` report readers
can see without opening logs, and no secret requirement, since
`rubanwd/slay-city` is a public repository and the existing job's
`secrets.UPSTREAM_READ_TOKEN` was both undocumented anywhere (checked
`AGENTS.md`, `README.md`, every `docs/*.md`) and unnecessary — confirmed with
`git ls-remote https://github.com/rubanwd/slay-city.git HEAD`, which succeeds
with no credentials.

## What was done

Replaced the `upstream-drift` job in `.github/workflows/ci.yml` with a `drift`
job built on the npm-script path the ticket specified, rather than running two
jobs that both check the same thing on every push, PR and night:

1. `actions/checkout@v4` — this repository.
2. `actions/setup-node@v4` (Node 20, npm cache) + `npm ci` — needed because
   `npm run upstream:fetch` and `npm run drift:check` are npm scripts, unlike
   the old job's direct `node scripts/...` invocation which didn't need
   dependencies installed.
3. `npm run upstream:fetch` — clones `rubanwd/slay-city` (public, depth 1,
   current head) into `./upstream`. No `actions/checkout` against the second
   repo and no token, since the clone is a plain anonymous HTTPS git clone.
4. `npm run drift:check` (id: `drift`), redirected to `drift-output.txt` and
   run with `continue-on-error: true` so a later step can still build a
   summary and the job can still be made to fail deliberately rather than
   stopping mid-workflow. `drift:check` finds `./upstream` already present
   from step 3 and compares against it directly — it only re-fetches when the
   directory is missing, so this doesn't clone twice.
5. "Publish drift summary" (`if: always()`) — writes a `##` heading, a ✅/❌
   line keyed off `steps.drift.outcome`, and the captured `drift-output.txt`
   in a fenced code block to `$GITHUB_STEP_SUMMARY`, so the drifted files (or
   the in-sync confirmation) are visible on the workflow run's summary page
   without opening a single step's log.
6. "Fail the job if drift was found" (`if: steps.drift.outcome == 'failure'`)
   — exits 1, which is what actually fails the `drift` job; `continue-on-error`
   on step 4 otherwise reports the job as green regardless of what the drift
   check found.

Added `workflow_dispatch:` to the workflow's top-level `on:` block (next to the
existing `push`, `pull_request` and nightly `schedule: cron: "0 4 * * *"`), so
the same `check` and `drift` jobs that already run on every push/PR/night can
also be triggered on demand from the Actions tab.

Updated `docs/SYNC.md` §4's code sample and surrounding prose, which had
described the old job's explicit `--upstream ./upstream` / `actions/checkout`
form as "the CI form" — that text now matches what CI actually runs
(`npm run upstream:fetch` then `npm run drift:check`), names the `drift` job
and `workflow_dispatch` trigger, and states plainly that the job needs no
secret because the upstream repo is public. §2's "CI fails when upstream
moves" paragraph got the same update (nightly, PR, *and* on-demand; job name;
no secret).

`docs/SYNC.md` §4 already had a "Resolving drift" subsection (five numbered
cases: not-adapted/logic-changed, not-adapted/cosmetic, adapted, doesn't apply
to mobile, plus how to diff and deepen the shallow `./upstream` clone for
history) from earlier work — this satisfied the ticket's step 5 ("document how
to resolve drift") with no further changes needed beyond keeping its
CI-mechanism description accurate.

## Changes by file

- `.github/workflows/ci.yml` — modified. Removed the `upstream-drift` job
  (second `actions/checkout` against `rubanwd/slay-city` gated on
  `secrets.UPSTREAM_READ_TOKEN`, direct `node scripts/check-upstream-drift.mjs
  --upstream ./upstream` invocation, no `npm ci`). Added the `drift` job
  (`npm ci` → `npm run upstream:fetch` → `npm run drift:check` → step-summary
  publish → explicit fail-on-drift step) and a top-level `workflow_dispatch:`
  trigger. The `check` job (lint/type-check/test) is untouched.
- `docs/SYNC.md` — modified. §2 and §4 updated to describe the `drift` job's
  actual mechanism (npm scripts, no secret, three triggers including manual
  dispatch) instead of the superseded `actions/checkout`-based job; the
  "Resolving drift" subsection and everything else in the file is unchanged.

## Technical decisions

- **Replaced the old job rather than adding `drift` alongside `upstream-drift`.**
  Both jobs would check the exact same manifests against the exact same
  upstream repository on every push, PR and night — running it twice buys
  nothing and doubles the clone/compute cost for no new signal. The ticket's
  acceptance criteria ("the job runs on PR, nightly and manual dispatch";
  "existing lint/type-check/test jobs are unchanged") name the `check` job as
  the one that must stay untouched, not the drift job, so replacing it is
  consistent with what's actually being protected.
- **Dropped `secrets.UPSTREAM_READ_TOKEN` rather than documenting it.** The
  ticket's own instruction was conditional — document a token only if upstream
  is private. Verified upstream is public via an unauthenticated
  `git ls-remote`, so the documented-token path doesn't apply, and the right
  fix is removing the unused, unnecessary secret reference rather than writing
  docs for a requirement that doesn't exist.
- **`continue-on-error` + explicit fail step over letting `drift:check` fail
  the job directly.** A step that fails outright stops the job before the
  summary step runs (summary steps need `if: always()` plus a step that
  survives to read `outcome` from). Capturing the outcome and failing
  deliberately in a later step is what makes "drift detected" both visible in
  the summary *and* a red job, instead of having to choose one.
- **`npm run upstream:fetch` then `npm run drift:check`, not
  `drift:check`'s own auto-fetch alone.** Ticket step 1 named both commands
  explicitly as separate steps, which also keeps the "clone the reference
  checkout" and "compare against it" failures distinguishable in the Actions
  log (a `upstream:fetch` failure means GitHub/network/clone trouble; a
  `drift:check` failure means an actual content mismatch).

## Data, API and configuration

None. No schema, RPC, or environment variable changes. No new dependencies.
The removed `secrets.UPSTREAM_READ_TOKEN` reference was never documented as a
required repository secret, so nothing needs to be unset in GitHub's secret
store (if it happens to exist there from before, it's simply unused now).

## How to verify

- `npm run lint`, `npm run type-check`, `npm test` — all pass (263/263 tests;
  the "upstream checkout not found" line in the test output is an expected
  assertion from `scripts/check-upstream-drift.test.mjs`'s own error-path
  test, not a failure).
- `node -e "require('js-yaml').load(...)"` against the edited
  `.github/workflows/ci.yml` — parses cleanly with exactly two top-level jobs,
  `check` and `drift`.
- `git ls-remote https://github.com/rubanwd/slay-city.git HEAD` — succeeds
  unauthenticated, confirming the `drift` job's token-free clone will work in
  CI.
- Manual verification once pushed (not done here, no push/commit was made):
  trigger the workflow via `workflow_dispatch` from the Actions tab and
  confirm the `drift` job's summary renders the ✅/❌ line and captured
  `drift:check` output; temporarily mutate a tracked file's recorded hash in
  `packages/core/.upstream.json` to confirm the job goes red and the summary
  names the drifted file.

## Limitations and follow-ups

- The `drift` job's token-free design depends on `rubanwd/slay-city` staying
  public. If it's ever made private, `npm run upstream:fetch`'s plain
  `git clone` will start failing with an auth error, and a
  `UPSTREAM_READ_TOKEN`-style secret plus an authenticated clone step (or an
  `actions/checkout` with `token:`) would need to come back — at that point it
  should also be documented in the README, which the ticket already
  anticipated and which this change deliberately does not add until it's
  actually needed.
- No change was made to notification/alerting on a red nightly run (e.g.
  posting to Slack) — out of scope for this ticket, which only asked for the
  job itself plus a readable in-workflow summary.
