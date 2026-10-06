# SCN-47 — Create `packages/tokens` with brand palette and type scale

> Type: feature · Date: 2026-10-06

## Context

SCN-47 is badged "Goal: WP-0.4" and asks for `packages/tokens`: a typed package
holding the six brand colours and the type scale from the web app's
`src/styles/theme.css` / `src/styles/typography.css`, shared by NativeWind and
plain React Native `StyleSheet` code, plus a Tailwind preset wired into the
app's `tailwind.config.js`, and unit tests pinning the palette to exactly six
hex values.

By the time this run started, `packages/tokens` already existed in full —
`colors.ts`, `typography.ts`, `radii.ts`, `index.ts` and `preset.js` were
created as part of the WP-0.1 bootstrap (`f3b5e04`) and extended by SCN-5
(`76f04ca`, `d2d8ef6`) when the `src/components/ui` design system was built on
top of them. `tsconfig.json` already carried the `@slay/tokens` /
`@slay/tokens/*` aliases, `tailwind.config.js` already loaded
`packages/tokens/preset.js` as a preset, and `app/index.tsx` — the WP-0.1 smoke
screen — already used token-driven NativeWind classes (`bg-neon-pink`,
`text-neon-pink`, `bg-lime-green`, `bg-cyan`, `bg-purple`, `bg-neon-orange`).
`SlayButton.tsx` and the rest of `src/components/ui` already import `colors`,
`alpha`, `radii` and `fontFamilyByWeight` from `@slay/tokens` for their plain
`StyleSheet` values. So three of this ticket's four steps, and all three of
its acceptance criteria, were already satisfied by existing code — verified
directly rather than assumed, by reading `packages/tokens/src/*`,
`tailwind.config.js`, `tsconfig.json`, `app/index.tsx` and
`src/components/ui/SlayButton.tsx`.

The one gap was step 4: "add unit tests asserting that the palette has exactly
six brand colours with the expected hex values." The existing
`colors.test.ts` only tested the `withAlpha()` helper — nothing pinned the
palette to the AGENTS.md-locked six hexes. The existing `colors.ts` comment
also claimed "these seven values are locked," which doesn't match upstream:
the web repository's `AGENTS.md` "What Not to Change Without Permission"
section locks exactly six hex values (`#FF2D8E`, `#9DFF00`, `#00F0FF`,
`#6A00FF`, `#111111`, `#FFFFFF`). `neonOrange` (`#FF8A00`) is a real token —
it's declared in upstream `theme.css` and used for admin-only accents — but it
is not part of the locked set, so a test asserting "exactly six" would fail if
written against the full `colors` object, which has eight keys including
`neonOrange` and the non-brand `surface`.

## What was done

Added a `lockedBrandColors` export to `packages/tokens/src/colors.ts`: a
six-key object (`neonPink`, `limeGreen`, `cyan`, `purple`, `black`, `white`)
derived from the existing `colors` constants, in the same order AGENTS.md
lists them. This gives tests (and any future code that needs to check "is
this hex one of the locked six") something to assert against without
`neonOrange` or `surface` drifting into the count. `colors` itself is
unchanged — `neonOrange` and `surface` stay exactly where they were, since
`app/index.tsx` and admin-style accents still need them.

Rewrote the header comment on `colors.ts` to state the six locked colours by
name, call out that `neonOrange` is upstream-declared but *not* locked, and
keep the existing `surface`-is-not-a-brand-colour note. This replaces the
previous comment's incorrect "these seven values are locked" claim.

Exported `lockedBrandColors` from `packages/tokens/src/index.ts` alongside the
existing `colors` export.

Added three tests to `packages/tokens/src/colors.test.ts`, in a new
`describe("lockedBrandColors", ...)` block ahead of the existing `withAlpha`
tests:
- asserts `Object.keys(lockedBrandColors)` has length 6;
- asserts `lockedBrandColors` deep-equals the six AGENTS.md hex values exactly;
- asserts `lockedBrandColors` does not carry a `neonOrange` or `surface` key,
  so a future edit that widens the exported object's shape fails loudly
  instead of silently inflating the locked count.

No other files were touched — `packages/tokens/src/typography.ts`,
`radii.ts`, `preset.js`, `tailwind.config.js`, `tsconfig.json` and the
`app/index.tsx` / `src/components/ui/*` consumers already satisfied every
other part of the ticket and needed no changes.

## Changes by file

- `packages/tokens/src/colors.ts` — modified. Added the `lockedBrandColors`
  export (the six AGENTS.md-locked hexes, keyed by name) and rewrote the
  header comment to correctly describe which values are locked versus which
  (`neonOrange`, `surface`) are not.
- `packages/tokens/src/index.ts` — modified. Added `lockedBrandColors` to the
  package's public exports.
- `packages/tokens/src/colors.test.ts` — modified. Added a
  `describe("lockedBrandColors", ...)` block with three tests: exact count of
  six, exact hex-value match against AGENTS.md, and absence of `neonOrange`/
  `surface` from the locked set.

## Technical decisions

- Added a new `lockedBrandColors` export rather than shrinking `colors` to six
  keys, because `neonOrange` and `surface` are real, actively-used tokens —
  `app/index.tsx`'s `bg-neon-orange` dot and the upstream admin accent both
  depend on `colors.neonOrange`, and multiple `src/components/ui` components
  depend on `colors.surface`-equivalent values. Removing them to satisfy a
  "six" test would have broken working code to chase a number.
- Did not touch `packages/tokens/preset.js` (the NativeWind preset). It
  already derives its `colors` object from the same six-plus-two hex values
  and is already wired into `tailwind.config.js`; the ticket's AC3 ("a
  brand-token class renders the correct colour on both platforms") is already
  proven by `app/index.tsx`'s `bg-neon-pink`/`text-neon-pink`/etc. classes.
  Duplicating that in a new sample component would not have added coverage.
- Did not re-run `npm run upstream:fetch` as a destructive step — `./upstream`
  was already checked out from a prior task (SCN-46) and matches the current
  `rubanwd/slay-city` `theme.css`/`typography.css` used to verify the hex
  values and type scale in this task.

## Data, API and configuration

None — no schema, endpoint, env var or dependency changes. `@slay/tokens`'s
public surface gained one new named export (`lockedBrandColors`); nothing
existing changed shape.

## How to verify

- `npm test` — 192 tests pass across 18 files (3 new, all in
  `packages/tokens/src/colors.test.ts`).
- `npm run type-check` — passes with no errors.
- `npm run lint` — passes with no errors.
- Manual: `colors.neonPink === "#FF2D8E"`, `colors.limeGreen === "#9DFF00"`,
  `colors.cyan === "#00F0FF"`, `colors.purple === "#6A00FF"`,
  `colors.black === "#111111"`, `colors.white === "#FFFFFF"` all match
  `upstream/src/styles/theme.css`'s `--color-*` variables (converted from
  space-separated RGB to hex) verbatim. `lockedBrandColors` surfaces exactly
  those six under the same key names.
- Manual: `app/index.tsx`, already in the tree, renders `bg-neon-pink`,
  `bg-lime-green`, `bg-cyan`, `bg-purple` and `bg-neon-orange` dots via
  `packages/tokens/preset.js`'s Tailwind colours — this is the "sample
  component uses a token-driven NativeWind class" acceptance criterion,
  satisfied by pre-existing code and re-confirmed in this task by reading the
  file and the preset it depends on.

## Limitations and follow-ups

- The `colors.ts` comment previously claimed seven locked values; this task
  corrected the comment but did not audit other docs/comments in the
  repository for the same miscount — none were found during this task's
  review of `packages/tokens`, `tailwind.config.js` and `src/components/ui`,
  but a broader doc sweep was out of scope.
- None of this task's acceptance criteria required changing `typography.ts`,
  `radii.ts` or the NativeWind preset — they were already correct against
  upstream, verified by direct comparison with
  `upstream/src/styles/typography.css` and `upstream/tailwind.config.ts`.
