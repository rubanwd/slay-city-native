# Shared-Logic Sync Contract

Two repositories, one product. This document is the price of that choice and the
plan for keeping it bounded.

Read it before M0. `WP-0.5` implements it.

---

## 1. The problem, stated plainly

`packages/core` in this repository is a **copy** of logic that also lives in
`rubanwd/slay-city`. Reward maths, unlock rules, puzzle generation, streak logic,
username validation, i18n dictionaries — roughly 6 000 lines.

If someone fixes a bug in `missionReward.ts` on the web and nobody copies it here,
the phone pays different XP for the same mission than the web does. That is not a
cosmetic drift. A child completes a mission on their phone, opens the web app, and
the numbers disagree.

Copies drift. Always. The only question is whether drift is **detected** or
**discovered by a user**.

## 2. The contract

**The web repository is upstream.** `rubanwd/slay-city` is authoritative for every
tracked file. A change to shared logic is made there first, in the live product, and
then pulled here.

**Never edit a tracked file in this repository to fix a shared bug.** Fix it
upstream, then sync. A local edit to a tracked file is how the two copies stop being
copies.

**Every tracked file records where it came from.** `packages/core/.upstream.json`
maps each local file to its upstream path and the SHA-256 of the upstream content at
the moment it was copied.

**CI fails when upstream moves.** Nightly, and on every pull request, the drift check
compares recorded hashes against upstream's current content. A mismatch is a failing
build with a list of files, not a silent divergence.

## 3. The manifest

```json
{
  "upstream": "https://github.com/rubanwd/slay-city",
  "syncedAt": "2026-09-12T00:00:00Z",
  "syncedFrom": "98327f5",
  "files": [
    {
      "local": "packages/core/mission/reward.ts",
      "upstream": "src/features/mission/missionReward.ts",
      "sha256": "…",
      "adapted": false
    },
    {
      "local": "packages/core/audio/hiss.ts",
      "upstream": "src/lib/hiss.ts",
      "sha256": "…",
      "adapted": true,
      "note": "playback split behind an adapter; sequencing identical"
    }
  ]
}
```

`adapted: true` marks a file that could not be copied verbatim — the platform forced
a change. These are the dangerous ones: a drift alert on an adapted file needs a
human to decide whether the upstream change applies. Keep the count as close to zero
as possible; an adapted file is a small monorepo's worth of maintenance in one place.

## 4. The check

`scripts/check-upstream-drift.mjs`, run against a checkout of the web repository.

```bash
# locally
git clone --depth 1 https://github.com/rubanwd/slay-city /tmp/upstream
node scripts/check-upstream-drift.mjs --upstream /tmp/upstream

# CI: actions/checkout the web repo into ./upstream, then
node scripts/check-upstream-drift.mjs --upstream ./upstream
```

Exit codes: `0` in sync · `1` drift detected · `2` manifest or path error.

Output names every drifted file, its upstream path, and whether it is adapted — so
the person reading a red build knows immediately whether this is a copy-paste or a
judgement call.

### Resolving drift

1. Read the upstream change. `diff -u <local file> upstream/<upstream path>` —
   this needs no git history and answers the question directly: what differs from
   the copy we hold. `fetch-upstream.mjs` makes a **shallow** clone, so
   `git -C upstream log` sees nothing before its tip; when you do want the
   commits and their messages, deepen it first with
   `git -C upstream fetch --depth=100 origin main`.
2. **Not adapted, logic changed** → copy the file, run the tests, update the hash.
3. **Not adapted, cosmetic only** → copy it anyway. Divergence for style reasons is
   how real divergence gets hidden.
4. **Adapted** → apply the change by hand to the adapted file, then update the hash.
   Say in the commit message what you carried across and what you deliberately did
   not.
5. **The change does not apply to mobile at all** → update the hash and record why in
   the manifest `note`. This is the only case where a hash moves without the file
   moving, and it needs a sentence of justification.

Run `npm test` after every sync. The tests came across with the logic; they are the
thing that makes a blind copy safe.

## 5. When to stop doing this

The manual contract is right while the port is in flight and shared logic is
relatively stable. It stops being right at any of these signals:

- **More than one drift resolution per week**, sustained for a month.
- **More than 10 adapted files** — the copies have become two implementations.
- **A drift bug reaches a user.** One is the budget. There is no second.
- **Mission task types start changing regularly.** They are the largest shared
  surface and the most likely to churn.

The escape hatch: publish `packages/core` from the web repository as a private npm
package (`@slay/core`) and have both apps depend on a version. One week of work,
most of it in CI. The web app gains a release step; both apps gain one source of
truth.

Nothing in this plan forecloses that. `packages/core` here already has the shape a
published package needs — no React, no platform imports, its own tests. Make the
call on evidence from the signals above, not on preference.

## 6. What is not tracked

| | Why |
| --- | --- |
| `packages/data` | Signatures change — every function takes an injected client. Related to upstream, not a copy of it. |
| `packages/tokens` | The six brand colours are locked by `AGENTS.md` and effectively never change. Tracked by eye. |
| `src/**` | Screens. Rewritten for React Native by definition. |
| `upstream/` | A read-only checkout, fetched on demand and gitignored. It is the thing tracked files are compared *against*, not a thing that is tracked. |

## 7. Migrations and Edge Functions

Not a sync question — an ownership question, and the answer is in
[CONCEPT.md](CONCEPT.md) §4.

This repository contains no `supabase/` directory. When the native app needs a new
RPC or Edge Function, that migration is opened as a pull request **against
`rubanwd/slay-city`**, which owns the migration timeline and whose CI applies it to
production.

Two repositories writing migrations to one database produce conflicting version
numbers and a schema history nobody can reconstruct.
