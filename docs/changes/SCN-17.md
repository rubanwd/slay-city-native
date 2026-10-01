# SCN-17 — Fix failing checks: npm run lint && npm run test

> Type: bug · Date: 2026-09-30

## Context

`npm run lint && npm run test` was failing in CI after the SCN-13 run with
four ESLint `import/export` errors and one `@typescript-eslint/no-redeclare`
warning, all pointing at `fluidFontSize` in `packages/tokens/src/typography.ts`
and its re-export in `packages/tokens/src/index.ts`. The last three change
summaries (SCN-11, SCN-11-1, SCN-12) had each noted this duplicate in passing
as pre-existing but out of scope for their own work, so it was never fixed —
this item was created specifically to fix it.

## What was done

`packages/tokens/src/typography.ts` declared `fluidFontSize` **twice**:

1. An older version (originally lines 17–37) taking a `FontSizeToken` and
   reading from a standalone `fontSize` lookup table (`{ min, vw, max,
   default }` per token).
2. The current version (now lines ~142–146, previously 178–182) taking a
   `TextVariant` and reading `min`/`vw`/`max` directly off `typeScale`, the
   table `SlayText` and the rest of the app actually use.

A `grep` across `src/`, `packages/`, and `docs/` confirmed `fontSize` and
`FontSizeToken` (the first version's dependencies) had no consumers anywhere
outside their own declaration and the `index.ts` re-export — they were dead
code left behind when the type scale was migrated from `fontSize` to
`typeScale`/`TextVariant` (see `docs/changes/SCN-5.md`). Every real call site
(`src/components/ui/SlayText.tsx`, `packages/tokens/src/typography.test.ts`)
calls `fluidFontSize(variant, width)` with a `TextVariant` like `"h1"` or
`"body"`, matching only the second declaration.

Fix: deleted the first, unused `fontSize` / `FontSizeToken` /
`fluidFontSize(token, width)` block from `typography.ts`, keeping the
`typeScale`-based `fluidFontSize(variant, width)` as the sole definition.
Folded the still-relevant parts of the deleted block's doc comment (the note
that every preferred value sits below its minimum at the 390pt design width)
into the file's top-of-file comment, which now describes `typeScale` directly
instead of the removed `fontSize` table. Updated `packages/tokens/src/index.ts`
to export `fluidFontSize` and the `TextVariant` type once instead of twice,
and dropped the `fontSize` / `FontSizeToken` exports since nothing imports
them.

No other file referenced `fontSize` or `FontSizeToken`, so no call sites
needed updating.

## Changes by file

- `packages/tokens/src/typography.ts` — modified. Removed the dead
  `fontSize` const, `FontSizeToken` type, and the first (unused)
  `fluidFontSize(token, width)` overload that read from it. Rewrote the
  top-of-file doc comment to describe the remaining `typeScale`-based code
  instead of the removed table.
- `packages/tokens/src/index.ts` — modified. Removed the duplicate
  `fluidFontSize` / `TextVariant` entries and the now-dead `fontSize` /
  `FontSizeToken` exports from the `./typography` re-export list.

## Technical decisions

- **Deleted the old overload rather than renaming or aliasing it.** Keeping
  both under different names was considered, but `fontSize`/`FontSizeToken`
  had zero consumers — keeping unused, parallel code around that seemed to
  belong to the same concept as `typeScale`/`TextVariant` is exactly the kind
  of drift that caused this bug, since `tsc` and Vitest never flagged it and
  only ESLint's `import/export` check caught it at all.
- **Did not touch `fontSize` usages in `SlayButton.tsx` / `SlayInput.tsx` /
  `SlayText.tsx`.** Those are unrelated `StyleSheet` property names
  (`fontSize: number` in RN styles), not references to the removed token
  table — confirmed by grep before editing.

## Data, API and configuration

None — this is a type-only/source-only change inside `packages/tokens`; no
schema, RPC, or env var changes.

## How to verify

- `npm run lint` — 0 problems (previously 4 errors, 1 warning).
- `npm run test` — 189/189 tests pass across 18 files, including
  `packages/tokens/src/typography.test.ts`'s `fluidFontSize` suite, unchanged
  and still passing against the surviving `typeScale`-based implementation.
- `npm run type-check` — `tsc --noEmit` passes with no errors.
- `npm run lint && npm run test` (the originally failing command) now exits 0
  end-to-end.

## Limitations and follow-ups

None — the duplicate was fully unused dead code; removing it required no
downstream changes.
