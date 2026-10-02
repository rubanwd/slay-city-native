# SCN-27 — Create dependency-gate tracker for M0–M8 blockers and prerequisites

> Type: task · Date: 2026-10-02

## Context

[ROADMAP.md](../ROADMAP.md) describes the phase sequence `M0`–`M8` and names a
handful of gates that sit outside the normal "finish the previous phase" order:
`WP-7.1` (developer accounts) and `WP-2.3` (the teacher RLS audit's upstream PR)
both start earlier than the phase that needs them, and `OD-1`/`OD-2` are
one-time decisions each phase depends on. That information was scattered across
`ROADMAP.md`'s ASCII dependency graph, `WORK-PACKAGES.md`'s per-package
dependency lines, `EDGE-FUNCTIONS-PLAN.md` and `OD-2-DECISION.md` (the `OD-1`/
`OD-2` write-ups), and `UPSTREAM-PR-WP-2.3.md` (the `WP-2.3` PR's actual
status). A maintainer standup needed to open four files and cross-reference
dates to answer "is `M5` blocked right now?" This item adds one document that
answers that in under two minutes, with an owner, a status, an evidence link
and an unblock criterion per gate, so the answer doesn't require re-deriving
state from prose scattered across the planning docs every week.

## What was done

Added `docs/dependency-gates.md`, a standalone tracker with four sections:

1. **Phase sequence** — the main chain `M0 → M1 → M2 → M3 → M4 → M6 → M7 → M8`,
   with `M5` drawn explicitly as a branch off `M2` that rejoins at `M6`
   (matching `ROADMAP.md`'s existing ASCII graph exactly, not a re-derivation),
   plus a note that `WP-7.1` and `WP-2.3` are pulled earlier than their phase
   and that `OD-1`/`OD-2` gate `M4`/`M2` respectively.
2. **Gate rows** — one row each for `WP-7.1`, `WP-2.3`, `OD-1` and `OD-2`, with
   owner, status (🟢/🟡/🔴), an evidence link into the existing planning docs,
   the unblock criterion, and a target date (or "closed `<date>`" for the two
   already-answered `OD-*` decisions).
3. **Two-minute phase check** — a four-row table mapping `M2`, `M4`, `M5`, `M7`
   directly to the gate(s) that could block them and today's answer: `M2`/`M4`
   are not blocked (`OD-2`/`OD-1` both closed), `M5` is blocked (`WP-2.3`'s PR
   is staged but not opened against `rubanwd/slay-city`), and `M7` is marked
   "unverified — treat as blocked" because nothing in the repository can prove
   the Apple/Google developer accounts exist.
4. **Weekly checklist** — five steps a maintainer runs in standup: ask the
   owner about `WP-7.1` directly (the one gate no grep can answer), check
   `UPSTREAM-PR-WP-2.3.md`'s status banner for `WP-2.3`, confirm `OD-1`/`OD-2`
   are still closed, re-run the phase check, and watch for new gates.

Also added a one-line pointer from `ROADMAP.md`'s existing dependency-graph
section to the new tracker, so the roadmap's ASCII diagram (which stays static)
and the tracker's live status (which updates weekly) don't drift apart without
either file saying so.

## Changes by file

- `docs/dependency-gates.md` — new. The gate tracker: phase sequence, four gate
  rows (`WP-7.1`, `WP-2.3`, `OD-1`, `OD-2`), the `M2`/`M4`/`M5`/`M7` two-minute
  blocking check, and the weekly standup checklist.
- `docs/ROADMAP.md` — modified. Added one paragraph after the existing
  dependency-graph ASCII art pointing to `dependency-gates.md` for live gate
  status, with an explicit instruction to update that file rather than the
  diagram when a gate changes.

## Technical decisions

- **Reused the existing ASCII dependency graph verbatim** rather than drawing
  a new one, so the tracker cannot silently disagree with `ROADMAP.md` on
  phase order. The only addition is making the `M5` branch-and-rejoin shape
  explicit in prose, since the ticket called for "the branch through `M5`
  exactly as described."
- **Treated `WP-2.3`'s gate as "staged, not landed"** rather than "done" or
  "not started." The SQL, rollbacks, thin-caller diffs and CI job are all
  written and verified in `docs/migrations/wp-2.3/` (per `SCN-11`–`SCN-13`),
  but `UPSTREAM-PR-WP-2.3.md`'s own status banner says the PR against
  `rubanwd/slay-city` is **NOT OPENED**. Calling it done would hide the one
  thing actually gating `M5`: review and merge in a repository this one
  doesn't control.
- **Marked `WP-7.1` as "not confirmed" rather than guessing a status.** No
  file in this repository can prove or disprove whether the Apple/Google
  developer accounts exist — the memory directive against inventing facts
  applies here directly. The checklist tells a maintainer to ask the owner
  instead of trusting a status this document can't actually verify.
- **Kept `OD-1`/`OD-2` as closed gates with dates, not deleted rows.** Both
  are answered, but the ticket's acceptance criteria explicitly asked for rows
  for both, and a closed gate with its approval date is still useful context
  for why `M2`/`M4` are currently unblocked.

## Data, API and configuration

None — documentation only, no code, schema, or config changes.

## How to verify

- Open `docs/dependency-gates.md` and confirm the four acceptance-criteria
  gates (`WP-7.1`, `WP-2.3`, `OD-1`, `OD-2`) each have owner, status, evidence
  link, unblock criteria and target date filled in.
- Compare §1's phase sequence against `docs/ROADMAP.md`'s "Dependency graph"
  section — the chain and the `M5` branch-and-rejoin shape match exactly.
- Time reading §3 ("Two-minute phase check") — it should answer whether `M2`,
  `M4`, `M5`, `M7` are blocked without opening any other file.
- Cross-checked every status claim against source docs before writing:
  `WP-2.3` against `docs/UPSTREAM-PR-WP-2.3.md`'s "NOT OPENED" banner, `OD-1`
  against `docs/EDGE-FUNCTIONS-PLAN.md` §2, `OD-2` against
  `docs/OD-2-DECISION.md` §1. No test suite applies to a documentation-only
  change; `npm run lint` / `type-check` / `test` are unaffected since no
  source file changed.

## Limitations and follow-ups

- `WP-7.1`'s status is genuinely unknown from inside the repository — it needs
  a human answer, not a future audit. The weekly checklist names this
  explicitly so it doesn't get silently treated as resolved.
- The tracker's "Status" column will go stale the moment `WP-2.3`'s PR is
  opened or merged, or the Apple/Google accounts are confirmed. The weekly
  checklist in §4 exists specifically to catch that; it is only as good as
  whether maintainers actually run it.
