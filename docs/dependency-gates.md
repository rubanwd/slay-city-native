# Dependency-gate tracker

Single source of truth for phase execution order and the work that must clear
*before* a phase, not during it. [ROADMAP.md](ROADMAP.md) describes the plan;
this file tracks whether its gates are actually open, so a standup can answer
"what's blocked" without re-reading the roadmap's prose every time.

If this file and `ROADMAP.md` ever disagree on an order or a gate, `ROADMAP.md`
is wrong or this file is stale — fix the drift, don't pick a side silently.

For the `WP-2.3` row specifically, [WP-2.3-RECONCILIATION.md](WP-2.3-RECONCILIATION.md)
(`SCN-28`) is the flow-by-flow drill-down: which teacher write flows are
`covered by RPC + test` vs. still open, and a finding this file's gate table
does not yet carry — `P8`'s vocabulary flow (`WP-5.3`) also depends on
`WP-5.6` merging, not `WP-2.3` alone. That file recommends adding a `WP-5.6`
row to §2 below; it hasn't been added here yet, so treat `P8` as gated on both
PRs until it is.

## 1. Phase sequence

```
P3 → P4 → P5 → P6 → P7 → P9 → P10 → P11
```

`P8` is a **branch off `P5`**, not a step in the main chain. It runs
concurrently with `P6`/`P7` and rejoins the main chain at `P9` — `P9` needs
both `P7` and `P8` done:

```
P3 ── P4 ── P5 ──┬── P6 ── P7 ──┐
                 │              ├── P9 ── P10 ── P11
                 └───── P8 ─────┘
```

Two gates do not sit on the chain at all — they are deliberately pulled
*earlier* than the phase that needs them, per [ROADMAP.md](ROADMAP.md#p2---dependency-graph):

- **`WP-7.1`** (developer accounts) starts at `P3`, required by `P10`.
- **`WP-2.3`** (teacher RLS audit, upstream PR) starts early, gates `P8`
  specifically (not `P5`, not the main chain).

`OD-1` and `OD-2` are one-time decisions, each required before the phase that
depends on it: `OD-1` before `P7`, `OD-2` before `P5`.

## 2. Gate rows

| Gate | Owner | Status | Evidence | Unblock criteria | Target date |
| --- | --- | --- | --- | --- | --- |
| **`WP-7.1`** — Apple & Google developer accounts | **you** (human — Apple org verification needs a legal entity and D-U-N-S lookup; not delegable to an agent) | 🔴 **Not confirmed** — no evidence in this repo that either account exists. Repo work cannot prove or disprove this; ask the owner directly before treating `P10` as open. | None yet. Will be a screenshot/confirmation from the owner, or an EAS project linked under an Apple Team ID / Google Play Console account. | Apple Developer Program membership active (not just enrolled — org verification complete) **and** Google Play Console account active. | Started `P3` (week 1 of the roadmap clock); Apple verification alone can take weeks, so treat any slip here as a direct slip to `P10`. |
| **`WP-2.3`** — teacher/parent RLS audit, upstream PR | Staged by this repo (`SCN-6`, `SCN-11`–`SCN-13`); **opening and merging the PR against `rubanwd/slay-city` is a human/maintainer action**, not an agent one | 🟡 **Staged, not landed.** All SQL, rollbacks, thin-caller diffs, and the CI job are written and verified (see evidence); the PR itself is explicitly marked **NOT OPENED**. | [`MIGRATIONS-NEEDED.md`](MIGRATIONS-NEEDED.md) (audit) · [`UPSTREAM-PR-WP-2.3.md`](UPSTREAM-PR-WP-2.3.md) (staged PR body, status banner) · [`migrations/wp-2.3/`](migrations/wp-2.3/README.md) (the actual SQL and tests) | PR opened against `rubanwd/slay-city`, reviewed, and merged to `main`; web app's own actions call the new RPCs (`AC5`); no RLS policy weakened in the diff (`AC6`). | Must land before `P8` starts in earnest. No calendar date fixed — depends on review bandwidth in the web repo, which this repo does not control. |
| **`OD-1`** — move OpenRouter calls into Edge Functions | Project owner (decision authority) | 🟢 **Answered — Approved**, 2026-09-29, option (a). Gate satisfied. | [`EDGE-FUNCTIONS-PLAN.md`](EDGE-FUNCTIONS-PLAN.md#2-od-1--approved) §2 | None remaining — decision made. Follow-on implementation work (`WP-5.6`) is tracked separately in [`UPSTREAM-PR-WP-5.6.md`](UPSTREAM-PR-WP-5.6.md), itself still **NOT OPENED** upstream, which is why `P8`'s AI-drafting package is not fully released even though the decision is. | Closed 2026-09-29. |
| **`OD-2`** — Sign in with Apple | Project owner (decision authority) | 🟢 **Answered — Approved**, 2026-09-30, option (a). Gate satisfied. | [`OD-2-DECISION.md`](OD-2-DECISION.md#1-od-2--approved) | None remaining — decision made. | Closed 2026-09-30. |

Legend: 🟢 gate open / satisfied · 🟡 in progress, partially satisfied · 🔴 not
started or unverified · ⚪ not yet applicable.

## 3. Two-minute phase check

Read only this table to answer "is `P5`/`P7`/`P8`/`P10` blocked right now?"
without opening any other document.

| Phase | Gate(s) it depends on (beyond the previous phase) | Blocked? |
| --- | --- | --- |
| **`P5`** | `OD-2` answered | **No** — `OD-2` closed 2026-09-30. `P5` is gated only by the ordinary `P4` completion, not by an open cross-cutting gate. |
| **`P7`** | `OD-1` answered | **No** — `OD-1` closed 2026-09-29. `P7` is gated only by ordinary `P6` completion. |
| **`P8`** | `P5` done **and** `WP-2.3` merged upstream | **Yes** — `WP-2.3` is staged but its PR is not yet opened against `rubanwd/slay-city`, let alone merged. `P8` cannot be called unblocked until that PR lands. |
| **`P10`** | `P9` done **and** `WP-7.1` accounts active | **Unverified — treat as blocked until confirmed.** Nothing in the repo proves the Apple/Google accounts exist. Ask the owner; do not assume. |

## 4. Weekly standup checklist

Run through this in order; each item should take under a minute.

1. **`WP-7.1`** — ask the owner directly: "Are the Apple and Google developer
   accounts active yet?" Update row 1's status and evidence. This is the one
   gate that never shows up in a diff — it has to be asked, not grepped.
2. **`WP-2.3`** — check whether [`UPSTREAM-PR-WP-2.3.md`](UPSTREAM-PR-WP-2.3.md)'s
   status banner still says `NOT OPENED`. If a PR now exists against
   `rubanwd/slay-city`, link it here and move the row to 🟡/🟢 depending on
   review state.
3. **`OD-1` / `OD-2`** — no recurring check needed once 🟢; re-open only if a
   later decision overturns one (would show up as a new `OD-*` entry in
   [ARCHITECTURE.md](ARCHITECTURE.md) or [CONCEPT.md](CONCEPT.md)).
4. **Re-run the two-minute phase check (§3)** — if any phase's gate status
   changed this week, update its row and the "Blocked?" column together so
   they never drift apart.
5. **Check for new gates** — does this week's work introduce a new
   cross-repository PR, a new `OD-*` decision, or a new human-only
   prerequisite? If so, add a row to §2 and reference it from §1's sequence
   description.
