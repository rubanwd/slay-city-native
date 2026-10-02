# SCN-28 — Reconcile WP-2.3 status: map remaining teacher write risks vs implemented RPC/test coverage

> Type: task · Date: 2026-10-02

## Context

`WP-2.3` (`SCN-6`, `SCN-11`–`SCN-13`) replaced 21 phone-unsafe direct table
writes across the teacher authoring, vocabulary, grammar, homework Q&A and
onboarding flows with twelve `SECURITY DEFINER` RPCs and a negative-test
harness, all staged under `docs/migrations/wp-2.3/` for a pull request against
`rubanwd/slay-city` that has not yet been opened. `SCN-27` (the previous item)
built `docs/dependency-gates.md`, a phase-level tracker that already records
`WP-2.3` as the single gate blocking `M5` — but that tracker represents the
whole work package as one row. Nobody could tell from it, or from any other
single document, which specific teacher write flow is `covered by RPC + test`
versus still open, or whether a flow the tracker calls "staged" has a
dependency the tracker doesn't name. `SCN-28` was opened to do that
flow-by-flow reconciliation: confirm precisely what's done, flag anything the
phase-level view missed, and hand the maintainer a gap list they can act on
without re-deriving it from `MIGRATIONS-NEEDED.md`'s 462-line audit and
`UPSTREAM-PR-WP-2.3.md`'s 329-line staged PR body every time.

## What was done

Read the full chain of existing evidence rather than re-auditing from
scratch: `MIGRATIONS-NEEDED.md` (the original `SCN-6` write inventory, 21
table writes across five files), `UPSTREAM-PR-WP-2.3.md` (the staged PR body
and its "Checklist before opening this" with three still-unchecked items:
`U-1`, `U-3`, `U-4`), `docs/migrations/wp-2.3/README.md` and the five staged
migration files themselves (to confirm what each RPC actually enforces, not
just what the audit originally recommended), `docs/migrations/wp-2.3/tests/negative-tests.sql`
(enumerated its twelve numbered sections, §0 through §11, to map each one to
the flow it regression-tests), `docs/changes/SCN-13.md` (the verified-in-Docker
test run: 70 `PASS`, 0 `FAIL`, 0 `SKIP`), `docs/dependency-gates.md` and
`docs/UPSTREAM-PR-WP-5.6.md` (to check whether the Storage/paid-AI edge
`WP-2.3` explicitly excludes, W-04 and finding §6.2, is actually covered
somewhere else). Confirmed against `src/` that the native app has not yet
built any teacher/homework/vocabulary/grammar screens — `M5` genuinely has not
started, so this reconciliation is pre-work, not a check against code already
built against a wrong assumption.

Found one thing worth flagging that no existing document stated: `WP-2.3`
deliberately does **not** cover the vocabulary image-generation sub-flow
(the Storage upload, W-04, and the paid-generation authorization gate, finding
§6.2 — both pushed to the `generate-image`/`draft-vocabulary`/`draft-grammar`
Edge Functions instead, i.e. `WP-5.6`). `WP-5.6`'s own PR
(`UPSTREAM-PR-WP-5.6.md`) carries the identical "Status: NOT OPENED" banner
`WP-2.3`'s does, and is not listed anywhere in `dependency-gates.md`'s gate
table as something `M5` depends on. Practically: merging `WP-2.3` alone would
be enough to safely start `WP-5.2`, `WP-5.4` and `WP-5.5`, but not `WP-5.3`
(`VocabularyManager`) — its image step would still have no authorization
boundary off the Next.js server until `WP-5.6` also merges.

Wrote `docs/WP-2.3-RECONCILIATION.md`, the deliverable, with five sections: a
one-paragraph bottom line, a flow-by-flow coverage table (teacher actions,
vocabulary, the vocabulary-image sub-flow called out separately, grammar,
Q&A, onboarding, and the anonymous-caller case — each marked against its RPC,
its regression-test section(s), and its thin-caller status), a risk table
(eight rows, `R1`–`R8`, each with severity and the *exact* blocking impact on
`M5` rather than a generic "risk" label — including one row, `R7`, recorded
specifically so a fixed item from the original audit is not mistaken for
still-open), a section explaining the `WP-5.6` finding above, and a "next
required upstream PR scope" section listing only the six items that are
genuinely unresolved (open the `WP-2.3` PR; resolve checklist items `U-1`,
`U-3`, `U-4`; decide on finding F1 explicitly; renumber migration timestamps
and re-verify the base commit; open the `WP-5.6` PR; merge the staged CI job)
— explicitly not re-listing anything `SCN-11`–`SCN-15`/`SCN-18` already
finished.

Added a four-line pointer in `docs/dependency-gates.md`, after its existing
"if this file and `ROADMAP.md` disagree" note, directing a reader to the new
reconciliation file for the `WP-2.3` row's detail and naming the `WP-5.6`
finding explicitly — including that the gate table itself has *not* been
edited to add a `WP-5.6` row, since that table is `SCN-27`'s deliverable and
this item's job is to report the gap, not to silently absorb another item's
file into its own scope.

## Changes by file

- `docs/WP-2.3-RECONCILIATION.md` — new. The flow-by-flow reconciliation:
  bottom line, coverage table, risk table (`R1`–`R8`), the `WP-5.6` gap
  finding, and the unresolved-items-only "next required upstream PR scope"
  list.
- `docs/dependency-gates.md` — modified. Added a four-line pointer after the
  existing "if this file and `ROADMAP.md` disagree" paragraph, linking to the
  new file and flagging that its `WP-5.6` recommendation has not been applied
  to this file's own gate table yet.
- `docs/changes/SCN-28.md` — new. This file.

## Technical decisions

- **A new standalone file, not an edit inside `MIGRATIONS-NEEDED.md` or
  `UPSTREAM-PR-WP-2.3.md`.** Both of those are source documents this file
  reconciles *against* — `MIGRATIONS-NEEDED.md` is the original audit (frozen
  at `7612da5`) and `UPSTREAM-PR-WP-2.3.md` is the literal text staged to
  become a PR body. Editing either to add a coverage table would blur "what
  the audit found" and "what the PR will say" with "what's true right now,"
  which is exactly the drift this item exists to prevent.
- **A pointer in `dependency-gates.md`, not a merged-in row.** The ticket's
  acceptance criteria require no duplicate recommendation of already-completed
  work; editing another item's (`SCN-27`'s) deliverable to add the `WP-5.6`
  row myself would risk exactly that kind of silent, hard-to-attribute
  overlap between two tickets' outputs. A short cross-reference lets a reader
  find the finding from either document without this item rewriting `SCN-27`'s
  table under its own ticket number.
- **`R7` included even though it's resolved.** The ticket's acceptance
  criteria call for distinguishing completed work from unresolved scope
  precisely; `MIGRATIONS-NEEDED.md` §7.2 reads as an open hardening note
  because the fix (the `order_index >= 0` check and `assert_optional_http_url`
  in `…0001_teacher_authoring_rpcs.sql`) landed after the audit was written.
  Leaving it out entirely risked someone re-discovering it as "still open"
  from the audit alone; recording it as resolved, with the exact file and
  lines, closes that off.
- **No code or migration changes.** This item's scope is reconciliation of
  existing, already-verified work — not new RPCs, not new tests, not a change
  to any staged migration. Nothing under `docs/migrations/wp-2.3/` was
  touched.

## Data, API and configuration

None. No schema, RPC, migration, or application code changed — this item adds
two documentation files and a four-line cross-reference, nothing else.

## How to verify

- Read `docs/WP-2.3-RECONCILIATION.md` §2 against `docs/migrations/wp-2.3/tests/negative-tests.sql`'s
  section headers (`grep -n "^-- [0-9]*\. " docs/migrations/wp-2.3/tests/negative-tests.sql`
  — twelve sections, §0–§11) and confirm each flow in the coverage table cites
  a section that actually exists and actually tests that flow.
- Read `docs/WP-2.3-RECONCILIATION.md` §3 row `R7` against
  `docs/migrations/wp-2.3/20260930000001_teacher_authoring_rpcs.sql` lines
  111–257 and confirm `assert_optional_http_url` and the `order_index >= 0`
  check are both present, as cited.
- Read `docs/UPSTREAM-PR-WP-5.6.md`'s banner and confirm it independently
  states "Status: NOT OPENED," supporting §4's claim that `WP-5.6` is an
  unmerged PR in the same state as `WP-2.3`.
- This repository's own gates: `git status --short` shows only the two `docs/`
  files above plus this change summary — no `src/`, `packages/`, or config
  file changed, so `npm run lint`, `npm run type-check` and `npm test` are
  unaffected and were not re-run, consistent with how `SCN-13`'s own
  docs-only changes were verified.

## Limitations and follow-ups

- **The `WP-5.6` row is not added to `dependency-gates.md`'s gate table.**
  This item recommends it (§4 of the new file) but deliberately leaves the
  edit to a future pass over `SCN-27`'s own deliverable, per the technical
  decision above.
- **`U-1`, `U-3`, `U-4` remain genuinely unresolved** and are not something
  this item, or any repo-local agent, can close — they need production
  database access and a maintainer decision, as `UPSTREAM-PR-WP-2.3.md`'s own
  checklist already states.
- **No new evidence was gathered against a live database.** This is a
  reconciliation of existing, already-committed artifacts and their own prior
  verification runs (`SCN-13`'s Docker session), not a fresh audit — it does
  not supersede the instruction in `UPSTREAM-PR-WP-2.3.md`'s checklist to
  re-verify against the live project before opening the PR.
