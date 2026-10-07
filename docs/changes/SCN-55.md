# SCN-55 — Port web icon set to react-native-svg components

> Type: task · Date: 2026-10-07

## Context

WP-1.4 asks for the web app's icon set to exist natively, as `react-native-svg`
components the design-system primitives and screens can use. The web repository's
`AGENTS.md`/work-package line for WP-1.4 names the icons explicitly:
`CoinIcon`, `XpIcon`, `ShareIcon` → `react-native-svg`, and ties the acceptance
criteria to colour being driven by a token prop rather than hardcoded, and to
rendering cleanly at 1×/2×/3×.

This repository is still early in P4 (`src/` has only `SlayButton`, `SlayCard`,
`SlayInput`, `SlayPressable` and `SlayText` so far — no screens for map,
mission, homework, parent or teacher yet). `upstream/src` has many more inline
`<svg>` blocks than the three WP-1.4 names (bottom-nav tab icons, admin-only
icons, per-task mission icons, the PWA "Add to Home Screen" flow, Storybook
icons), but those belong to screens this app hasn't built yet. Porting their
icons now, with no consumer to prove the prop shape against, would be exactly
the kind of ahead-of-need abstraction `AGENTS.md` warns against — so this run
scoped to the three icons the roadmap actually calls out for WP-1.4, which are
also the only icons the currently-planned WP-1.3 primitives need (`CoinAmount`
and `XpAmount`, inside `CurrencyAmount.tsx` upstream, not yet ported here).

`StreakBadge` upstream renders a 🔥 emoji, not an SVG icon, so no streak icon
exists to port — confirmed by reading `upstream/src/components/ui/StreakBadge.tsx`.
`SlayButton`'s loading state already ported to `ActivityIndicator` rather than
upstream's inline spinner SVG, so no spinner icon was needed either.

## What was done

1. Ran `npm run upstream:fetch` and read `upstream/src/components/ui/CoinIcon.tsx`,
   `XpIcon.tsx`, `ShareIcon.tsx` and their only two call sites
   (`CurrencyAmount.tsx`, `WardrobeGrid.tsx`/`RewardScreen.tsx` via `CoinAmount`/
   `XpAmount`) to confirm scope and copy the exact path data and fill/stroke
   values.
2. Installed `react-native-svg` via `npx expo install react-native-svg`
   (resolved to `15.15.4`, the version Expo SDK 57 expects).
3. Created `src/components/ui/icons/`, one file per icon, each a typed
   function component built from `Svg`/`Path`/`Circle` (`react-native-svg`),
   with web SVG attributes converted to the RN equivalents (numeric
   `strokeWidth`/`opacity` instead of string attributes, `transform="translate(...)"`
   kept as the one SVG transform `CoinIcon` needs, `class`/`className` dropped
   entirely since `react-native-svg` has no CSS cascade).
4. Added `src/components/ui/icons/types.ts` with a shared `IconProps` —
   `size` (default `24`), `color`, `title`, plus the rest of
   `react-native-svg`'s `SvgProps` — so every icon in the folder has the same
   call shape, and `<CoinIcon size={32} color={colors.cyan} />` type-checks
   even though `CoinIcon` itself ignores `color`.
5. Added `src/components/ui/icons/index.ts` as the barrel, and re-exported the
   three icons plus `IconProps` from `src/components/ui/index.ts` alongside
   the other primitives, matching upstream's own `ui/index.ts`, which exports
   `CoinIcon`/`XpIcon` as flat named components rather than through a
   `<Icon name="..." />` registry. The web app only does name-keyed icon
   lookup once, inside `BottomNav.tsx`'s local `NAV_ICONS` record for the five
   tab icons — not a reusable component, and not in this ticket's scope — so
   no generic `<Icon name="..." />` registry was added here; the ticket's own
   instruction for it was conditional ("if the web app does this"), and for
   the icons actually in scope it doesn't.
6. Added an "Icons — size × colour (WP-1.4)" section to the existing dev
   showcase screen, `app/dev/ui.tsx`, rendering each icon at 16/24/32/48pt
   (covering 1×/2×/3× and then some) and `XpIcon`/`ShareIcon` at a couple of
   extra `color` overrides, next to the showcase's existing `SlayButton`/
   `SlayCard`/`SlayInput` sections. This is the project's existing pattern for
   visually proving a new `ui/` component (see `design/SCN-5`), and gives a
   human reviewer the same screenshot-based proof WP-1.3's `AC4` asks for.

## Changes by file

- `src/components/ui/icons/types.ts` — new. Shared `IconProps` (`size`,
  `color`, `title`, rest of `SvgProps`) used by every icon component.
- `src/components/ui/icons/CoinIcon.tsx` — new. Ported from
  `upstream/src/components/ui/CoinIcon.tsx`: two-tone gold disc, engraved
  ring, lime-green brand-star emblem (`colors.limeGreen` from `@slay/tokens`
  instead of the web's `rgb(var(--color-lime-green))`), white shine. `color`
  prop accepted but unused — the palette is fixed by design, same as upstream.
- `src/components/ui/icons/XpIcon.tsx` — new. Ported from
  `upstream/src/components/ui/XpIcon.tsx`: the cyan progression bolt.
  `color` defaults to `colors.cyan`, replacing the web's CSS `currentColor` +
  `text-cyan` className, since React Native has no colour inheritance.
- `src/components/ui/icons/ShareIcon.tsx` — new. Ported from
  `upstream/src/components/ui/ShareIcon.tsx`: the iOS share-sheet glyph.
  `color` defaults to `colors.white`, same `currentColor`-to-prop treatment
  as `XpIcon`. Kept for icon-set parity even though the native app has a real
  install and nothing calls this yet; noted under Limitations.
- `src/components/ui/icons/index.ts` — new. Barrel re-exporting the three
  icons and `IconProps`.
- `src/components/ui/index.ts` — modified. Added
  `export { CoinIcon, XpIcon, ShareIcon, type IconProps } from "./icons";`
  alongside the existing primitive exports.
- `app/dev/ui.tsx` — modified. Added `IconSection`, rendering all three icons
  at four sizes plus a couple of colour overrides, wired into the showcase
  screen's render tree; imports `CoinIcon`/`XpIcon`/`ShareIcon` from
  `~/components/ui`.
- `package.json` / `package-lock.json` — modified. Added `react-native-svg`
  (`15.15.4`) via `npx expo install react-native-svg`.

## Technical decisions

- **Scoped to the three icons WP-1.4 names, not every inline `<svg>` in
  `upstream/src`.** The alternative — inventorying and porting every icon
  across student/teacher/parent screens — would include icons for features
  this repository hasn't built yet (bottom-nav tabs, mission tasks, map,
  parent/teacher dashboards). Without a real consumer, their prop shape and
  even which ones survive the port are guesses; those WPs (`WP-1.5` routing,
  and the later mission/map/dashboard tickets) are the right place to port
  each icon alongside the screen that needs it.
- **No generic `<Icon name="..." />` registry.** The ticket asked for one
  conditionally ("if the web app does this"); the web app doesn't, for the
  icons in scope — `CoinIcon`/`XpIcon`/`ShareIcon` are flat named exports
  there too. A three-entry name-keyed registry with no second consumer yet
  would be the premature abstraction `AGENTS.md`/`CLAUDE.md` both warn
  against. If `WP-1.5`'s bottom-nav tabs want name-based lookup (upstream's
  own `BottomNav.tsx` does this locally, for its five tab icons), that ticket
  can introduce the registry pattern the same way upstream did — scoped to
  its own icons.
- **`color` prop present but unused on `CoinIcon`.** Kept for a uniform call
  shape across the three icons (and any that follow) rather than special-casing
  its type; documented inline so a future reader doesn't assume it's a bug.
- **No new automated render test.** `vitest.config.mts` scopes `test.include`
  to `packages/**/*.test.ts` and `scripts/**/*.test.mjs` only, with a comment
  stating screen/component tests arrive with the design system at a later
  milestone; there is no `react-test-renderer`, `@testing-library/react-native`
  or Jest/RN preset installed anywhere in the repo. `SCN-53`'s change summary
  records the same deliberate choice ("Did not introduce Jest... consistent
  with `SCN-45`'s precedent") for the equivalent Metro-bundling verification
  problem. Introducing a render-test framework as a side effect of a 0.5-day
  icon-porting ticket would pre-empt that milestone's own tooling choice, so
  this run instead (a) ran `npx expo export --platform android` to prove the
  three icons resolve and bundle through Metro with `react-native-svg` linked
  (1741 modules, no resolution error — same technique `SCN-53` used), and
  (b) added the dev showcase section in `app/dev/ui.tsx` as the visual,
  human-reviewable proof this project already uses in place of automated
  component tests (`design/SCN-5`, WP-1.3 `AC4`). This satisfies the stated
  acceptance criteria ("type-check and tests pass" — vacuously true, nothing
  new added that could fail) without inventing an untested test harness.

## Data, API and configuration

New dependency: `react-native-svg@15.15.4`, installed through
`npx expo install` so the version matches what Expo SDK 57 expects. No native
config plugin was needed — this ticket only uses the base `Svg`/`Path`/`Circle`
primitives, not the SVG-file-import transformer, which is the only part of
`react-native-svg` that needs an Expo config plugin. No schema, RPC, Edge
Function or env var changes.

## How to verify

- `npm run type-check` — passes clean.
- `npm run lint` — passes clean.
- `npm test` — 263 tests across 28 files pass (unchanged; this ticket added
  no new `*.test.ts`, see Technical decisions).
- `npx expo export --platform android` — bundled 1741 modules with no
  resolution error, confirming `react-native-svg` is linked correctly and the
  three new icon modules resolve through Metro.
- Manual: `npx expo start` → open the dev showcase route (`/dev/ui`, guarded
  by `__DEV__`) → scroll to "Icons — size × colour (WP-1.4)" → confirms
  `CoinIcon` (fixed gold/lime palette), `XpIcon` (cyan default, overridden to
  pink/white) and `ShareIcon` (white default, overridden to lime/pink) all
  render cleanly at 16/24/32/48pt with no artefacts at any size.

## Limitations and follow-ups

- `ShareIcon` has no caller yet — it exists for icon-set parity with upstream,
  but the native app's install flow (an actual App Store / Play Store
  install) has no equivalent to the web's manual "Add to Home Screen" Safari
  walkthrough that upstream uses it for. Whoever designs the native onboarding
  flow should confirm whether it's needed at all before wiring it up.
- Bottom-nav tab icons (map, wardrobe, homework, profile, dashboard — all
  inline SVGs in `upstream/src/components/layout/BottomNav.tsx`) are not
  ported. They belong with `WP-1.5` (routing skeleton), where the tab layout
  that consumes them actually gets built.
- No automated render/snapshot test exists for any `src/components/ui`
  component yet, icons included — tracked under Technical decisions above.
  The first ticket that sets up `M1`'s screen-testing story should add
  coverage for `CoinIcon`/`XpIcon`/`ShareIcon` alongside everything else in
  `src/components/ui`.
