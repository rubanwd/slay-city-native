# WP-2.3 reconciliation — teacher write risks vs. implemented coverage

> `SCN-28`. Answers one question in detail that
> [dependency-gates.md](dependency-gates.md) answers in one row: *exactly which
> teacher write flows are protected, by what, and what — if anything — is still
> missing before `P8` can start?* Read `dependency-gates.md` first for the
> phase-level view; this file is the flow-level drill-down behind its `WP-2.3`
> row. Where the two disagree, `dependency-gates.md` is the standup-facing
> summary and this file is the detail it summarizes — update both together.
>
> Audit base: [MIGRATIONS-NEEDED.md](MIGRATIONS-NEEDED.md) (`SCN-6`, upstream
> `7612da5`). Engineering base: [UPSTREAM-PR-WP-2.3.md](UPSTREAM-PR-WP-2.3.md)
> (`SCN-11`–`SCN-13`) and [UPSTREAM-PR-WP-5.6.md](UPSTREAM-PR-WP-5.6.md)
> (`SCN-14`, `SCN-15`, `SCN-18`).

## 1. Bottom line

**Every line of SQL, every RPC, and every regression test `WP-2.3` needs is
already written and verified in this repository.** Nothing identified by the
`SCN-6` audit is unimplemented. The entire remaining gap is procedural, not
technical: the `WP-2.3` pull request against `rubanwd/slay-city` has not been
opened, so none of this runs anywhere a device talks to. `P8` stays blocked
until it is merged — unchanged from `dependency-gates.md` §2 — and this file
adds one precision that table does not carry: **`P8`'s vocabulary flow also
needs `WP-5.6` merged**, not `WP-2.3` alone (see §4).

## 2. Flow-by-flow coverage

Per the ticket's instruction, classified `covered by RPC + test`, `covered by
RPC only`, or `not covered`. "Covered" below means the SQL and test exist and
were verified in this repository (`SCN-13`'s Docker run: 70 `PASS`, 0 `FAIL`,
0 `SKIP`) — it does **not** mean the boundary is live anywhere, because the
migration that enforces it (`…0004_revoke_direct_write_grants.sql`) has not
been applied to any real database. That distinction is what makes the
"Blocking impact on `P8`" column below non-trivial even for rows marked fully
covered.

| Flow | Writes (audit ids) | RPC(s) | Regression test | Thin caller (web) | State |
| --- | --- | --- | --- | --- | --- |
| **Teacher actions** — create/update/delete homework topic | W-01–W-03 (T1–T3) | `create_homework_topic`, `update_homework_topic`, `delete_homework_topic` | §1 (student rejected), §6 (non-owning teacher rejected), §7 (owning teacher unchanged), §8 (input validation) | Staged, `SCN-12` | **Covered by RPC + test**, staged |
| **Vocabulary** — publish/clear word lists | W-05–W-11 (V2–V8) | `cache_vocab_image`, `publish_homework_vocabulary`, `clear_homework_vocabulary` | §2, §6, §7, §8 | Staged, `SCN-12` | **Covered by RPC + test**, staged |
| **Vocabulary image upload** (`generateWordImage` → Storage) | W-04 (V1) | **None by design** — moves to the `generate-image` Edge Function (`WP-5.6`), not a Postgres RPC | N/A in `WP-2.3`'s own suite; covered by `WP-5.6`'s own test package instead | N/A | **Covered, but by a different, also-unmerged package** — see §4 |
| **Grammar** — publish/clear grammar points | W-12–W-17 (G1–G6) | `publish_homework_grammar`, `clear_homework_grammar` | §2, §6, §7, §8 | Staged, `SCN-12` | **Covered by RPC + test**, staged |
| **Homework Q&A** — post/read/delete thread messages | W-18–W-20 (Q1–Q3) | `post_topic_message`, `mark_topic_read`, `delete_topic_message` | §3 (student scope), §9 (moderation + self-delete) | Staged, `SCN-12` | **Covered by RPC + test**, staged |
| **Onboarding** — profile + stats row creation | W-21–W-22 (O1–O2) | `create_my_profile` | §5 (finding F1 regression), §10 (atomic creation), §11 (age range) | Staged, `SCN-12` | **Covered by RPC + test**, staged |
| **Anonymous caller** (no JWT) across all four RPC "shapes" | — | Same functions; grant-level, not per-function | §0 (4 of 12 functions sampled; reasoning in `SCN-13`'s change summary) | N/A | **Covered by RPC + test**, staged |

Every row with "staged" is identical: the artifact exists and is verified
against a replayed copy of the migration timeline, and is waiting on a human
to open `UPSTREAM-PR-WP-2.3.md` as an actual pull request. That single action
is the only thing separating every "staged" row from "merged."

## 3. Risk table

| # | Finding | Severity | State | Exact blocking impact on `P8` |
| --- | --- | --- | --- | --- |
| R1 | `WP-2.3` PR not opened against `rubanwd/slay-city` | 🔴 Blocking | Staged, verified, not submitted | **Hard block.** No RPC in §2 runs against any real database until this merges. `P8`'s teacher-authoring work packages (`WP-5.2`–`WP-5.5`) cannot start implementation against a live backend before this lands — building against the staged SQL only would mean re-pointing every call site later. |
| R2 | `WP-5.6` PR not opened against `rubanwd/slay-city` | 🔴 Blocking (for one flow only) | Staged, verified (`SCN-14`, `SCN-18`), not submitted | **Hard block on the vocabulary-image sub-flow specifically.** `WP-5.3` (`VocabularyManager`) needs `generate-image` live for the Storage write `WP-2.3` deliberately excludes (W-04), and needs `draft-vocabulary`/`draft-grammar` live for the §6.2 paid-generation gate. Not tracked as a distinct row in `dependency-gates.md` today — see §4. |
| R3 | Finding F1 (`user_stats` self-minting) is live on production **right now**, independent of mobile | 🔴 Live security hole | Fix written (`create_my_profile` + revoke), not deployed | Not an `P8` blocker in the dependency-graph sense — it is a live web bug — but it is the one item `UPSTREAM-PR-WP-2.3.md`'s own checklist flags as needing a maintainer decision before the PR opens at all (`MIGRATIONS-NEEDED.md` §10 step 1). Effectively gates R1. |
| R4 | `UPSTREAM-PR-WP-2.3.md` checklist items U-1, U-3, U-4 unresolved | 🟡 Procedural | Open | Each needs a human with production database access, not an agent: U-1 is a live-DB policy/grant diff against the migration timeline assumption, U-3 is a product decision on auditing pre-existing forged `user_stats` rows, U-4 is a one-line confirmation that Q&A moderation-by-owning-teacher is intended. None block writing code; all block *opening* the PR with a clean checklist. |
| R5 | `profiles.username` has no table-level `CHECK` (§6.4 follow-up) | 🟡 Hardening, deferred on purpose | Deliberately out of scope — validated inside `create_my_profile` instead | **Does not block `P8`.** Once `…0004` revokes direct-write grants, `create_my_profile` is the only path that can insert a profile, and it already validates. A table `CHECK` would only add defense-in-depth against a future direct-insert path being reopened. |
| R6 | `vocab_image_cache` / `content/homework/` remain teacher-wide, not teacher-scoped (§7.1) | 🟡 Accepted risk, deliberate | Documented, not fixed — explicitly out of scope for `WP-2.3` | **Does not block `P8`.** Blast radius is bounded by admin-vetted teacher accounts, per the audit's own reasoning. Revisit only if the teacher role is ever opened to self-service promotion. |
| R7 | `homework_topics.order_index` / `note_link_url` / `note_image_url` validation (§7.2) | 🟢 Resolved | **Already fixed** — `create_homework_topic`/`update_homework_topic` enforce `order_index >= 0` and `assert_optional_http_url()` in SQL (`…0001_teacher_authoring_rpcs.sql` lines 111–257) | None. Listed here only so it is not mistakenly re-opened as outstanding — the audit recorded it as a note, not yet as fixed, and the fix landed after the audit was written. |
| R8 | `ci-database-tests.yml` not merged into the web repo's own CI | 🟡 Procedural | Staged (`SCN-13`), not merged | Does not block `P8` directly — `WP-2.3`'s tests already passed in this repository's own verification run. It does mean a future regression in `rubanwd/slay-city` after merge would not be caught automatically until this job is also merged. |

## 4. The one gap `dependency-gates.md` doesn't carry: `WP-5.6` is a second, implicit `P8` gate

`dependency-gates.md` §2 lists exactly one upstream-PR gate for `P8`:
`WP-2.3`. That is correct for every table-write flow in §2 above. It is
incomplete for the vocabulary flow specifically: `MIGRATIONS-NEEDED.md` W-04
and §6.2 both conclude that the Storage upload and the paid-generation
authorization check are **explicitly not part of `WP-2.3`** — they were
deferred to the `generate-image`/`draft-vocabulary`/`draft-grammar` Edge
Functions instead, i.e. `WP-5.6`. `WP-5.6`'s own PR
([UPSTREAM-PR-WP-5.6.md](UPSTREAM-PR-WP-5.6.md)) carries the identical
"Status: NOT OPENED" banner `WP-2.3`'s does, and is not named anywhere in
`dependency-gates.md`'s gate table.

Practical effect: a maintainer who merges `WP-2.3` alone and reads
`dependency-gates.md` would reasonably conclude `P8` is unblocked. `WP-5.2`
(topic authoring), `WP-5.4` (`GrammarManager`) and `WP-5.5` (Q&A) would in fact
be fully safe to build at that point. `WP-5.3` (`VocabularyManager`) would not:
its image-generation step has no authorization boundary at all until `WP-5.6`
also merges (§6.2 — `requireTeacher()` is the *only* thing stopping a student
from spending the teacher's OpenRouter budget, and that check does not exist
off the Next.js server).

**Recommendation:** add a `WP-5.6` row to `dependency-gates.md` §2, scoped to
`P8` the same way `WP-2.3` is, so the two-minute phase check in that file's §3
reflects both dependencies for `P8` instead of one. This document does not
make that edit itself — `dependency-gates.md` is `SCN-27`'s deliverable, and
duplicating its maintenance here would be the drift that file's own header
warns against.

## 5. Next required upstream PR scope (unresolved items only)

Everything already staged and complete is deliberately **not** repeated here —
see §2 and §3 for what's done. This section is only what remains:

1. **Open the `WP-2.3` PR** against `rubanwd/slay-city` using
   `UPSTREAM-PR-WP-2.3.md` as the body. Human/maintainer action — not
   delegable to an agent (write access to the upstream repo).
2. **Resolve checklist items U-1, U-3, U-4** before or as part of opening that
   PR (R4 above) — each needs production database access a repo-local agent
   does not have.
3. **Decide on finding F1** (R3) explicitly, even though the fix already
   exists — `MIGRATIONS-NEEDED.md` §10 step 1 calls this out as the one item
   that should not wait for the rest of the package.
4. **Renumber the five migration timestamps** to the day the PR is actually
   opened (`UPSTREAM-PR-WP-2.3.md`'s own checklist, last item) and re-fetch
   upstream to confirm `7612da5` is still the right base commit.
5. **Open the `WP-5.6` PR** against `rubanwd/slay-city` using
   `UPSTREAM-PR-WP-5.6.md` as the body, in the same pass or immediately after
   — required for `WP-5.3` specifically, per §4. Not currently tracked as a
   named `P8` gate in `dependency-gates.md`; recommend adding it there (§4).
6. **Merge `ci-database-tests.yml`** into the web repo's own
   `.github/workflows/ci.yml` (R8) — not blocking, but closes the gap where a
   post-merge regression in `rubanwd/slay-city` would go uncaught.

Everything else in `MIGRATIONS-NEEDED.md` §6–§7 (R5, R6) is either already
fixed (R7) or a deliberately deferred hardening item with no `P8` dependency,
and needs no further action to unblock `P8`.
