# SCN-56 — Build design-system primitives (SlayButton, SlayCard, Section, Grid, AppContainer, ScrollScreen, ProgressBar, CurrencyAmount, StreakBadge)

> Type: feature · Date: 2026-10-07

## Context

WP-1.3 is the design-system layer every screen in P5–P11 is built from. Nine
primitives have to exist natively and be visually indistinguishable from their
web counterparts, because the two apps share a Supabase project and a brand: a
card with the wrong radius or a button with the wrong pressed colour is a
visible inconsistency between the phone and the browser for the same account.

Four of the nine already existed from SCN-5 (`SlayButton`, `SlayCard`,
`SlayText`/`SlayInput`/`SlayPressable`, `AppContainer`). Five did not:
`Section`, `Grid`, `ScrollScreen`, `ProgressBar`, `CurrencyAmount`
(`CoinAmount`/`XpAmount`) and `StreakBadge`. `AppContainer` was also missing
upstream's `fixedHeight` prop.

The source of truth for the visual result is the design reference checked in at
`.atlas/assets/slay-city-design-system-k57bb7.html`, read alongside the web
implementations in `upstream/src/components/{ui,layout}` (fetched with
`npm run upstream:fetch`). Both were read before writing anything; every size,
radius, gap, colour and timing below is taken from them rather than estimated.

The repository also had no way to render-test a React Native component — the
vitest suite was node-only and covered `packages/**`. "Add render tests for the
main variants" therefore required standing that up as part of this item.

## What was done

### 1. Tokens for the colours that were still raw hex

`packages/tokens/src/colors.ts` gained the `artwork` namespace the design
reference §2.1 asks for, and the two white opacities the new primitives need:

- `artwork.coin.{rim,face,starShadow}` — `CoinIcon`'s own gold palette, which
  was inline hex in the ported component.
- `artwork.coin.text` (`#FDE047`) — the colour of a coin *number*, where the web
  passes Tailwind's `text-yellow-300` at every call site (reference X2).
- `artwork.coin.rain` (`#FACC15`) and `artwork.map.{skyTop,skyMid,skyline}` —
  named now so the reward rain (WP-3.7) and `MapBackground` (WP-3.1) have
  nowhere to introduce a raw hex later.
- `alpha.white70` and `alpha.white80` — `ProgressBar`'s right-hand label and
  `StreakBadge`'s tooltip text.

`src/components/ui/icons/CoinIcon.tsx` now reads its five fills from
`artwork.coin` and `colors`, so it contains no `#` at all.

### 2. The five new primitives

**`src/components/layout/Section.tsx`** — a column with a 12pt gap and a
padding scale on each end (`none` 0 · `xs` 8 · `sm` 16 · `md` 24 default ·
`lg` 32 · `xl` 48), `pt`/`pb` overriding `py`, and an optional `title` rendered
as a `label`-variant `SlayText` at white/50. The scale is upstream's rem values
converted to points, so a screen ported from the web keeps the same token and
lands on the same spacing.

**`src/components/layout/Grid.tsx`** — `cols` 1–4 (default 2) and `gap`
`none` 0 · `xs` 4 · `sm` 8 · `md` 12 default · `lg` 16. Each cell is exactly
`(W − gap·(cols−1)) / cols` wide, derived from the gap that was actually passed;
the web hardcodes those widths for the `md` gap only
(`basis-[calc(50%-0.375rem)]`), which is the bug reference D7/X7 asks not to
port. The width is produced with a negative outer margin (wrapper inset by
`-gap/2`, each cell `100/cols` percent wide with `gap/2` of padding, the two
cancelling at the outer edges) rather than by measuring the container, because
React Native cannot express `calc(50% - 6pt)`. Upstream's `grid` boolean is not
ported: a wrapping flex row already stretches every cell in a row to the tallest.

**`src/components/layout/ScrollScreen.tsx`** — a `flex: 1` screen holding a
`ScrollView` with an optional `footer` laid out *below* it, plus `topOffset`
(`VIEW_AS_BANNER_OFFSET` = 49 for the teacher "viewing as" banner) and
`bottomClearance`. Two of the web's workarounds are dropped: `h-dvh` becomes
`flex: 1`, and the fixed `pb-[calc(150px+env(safe-area-inset-bottom))]`
clearance becomes zero by default, because the footer no longer floats over the
content (reference X6). Per G8 the bottom safe-area inset goes to whatever is at
the bottom — the footer when there is one, the scroll content when there is not.

**`src/components/ui/ProgressBar.tsx`** — `value` 0–100 (clamped), `variant`
`green`/`pink`/`cyan`, `height` (10 default, 8 in score lists), `label`,
`labelRight`, `animate`. Track is white/10 at full radius; the fill carries
`0 0 8px 2px rgba(colour, .5)` whenever the value is above zero, inside the
clipped track exactly as the web's `overflow-hidden` track does. The fill is laid
out at full width and `scaleX`-ed from `transformOrigin: "left center"` over
600ms on `Easing.bezier(0.4, 0, 0.2, 1)` with `useNativeDriver: true` — the web
animates `width`, a layout property, which reference D10/X8 explicitly replaces
with a UI-thread transform. Exposes `accessibilityRole="progressbar"` with
`accessibilityValue`.

**`src/components/ui/CurrencyAmount.tsx`** — `CoinAmount` and `XpAmount`: a row,
gap 4, weight 700, `fontVariant: ["tabular-nums"]`, icon sized to the text.
Upstream takes colour and size through `className` because the icon scales to
`1em`; with no CSS inheritance or `em` here, the size comes from a `SlayText`
`variant` (default `bodyStrong`) and the icon is measured from it with
`fluidFontSize(variant, width)`. Coin numbers default to `artwork.coin.text`,
XP to `colors.cyan`. `label` makes the row one accessible element.

**`src/components/ui/StreakBadge.tsx`** — sizes `sm` 28 / `md` 40 / `lg` 56 tall
with the matching paddings, gaps, radii, flame sizes and count variants; a 90°
`purple → cyan` `expo-linear-gradient` fill; the count at weight 900 counting up
over 600ms ease-out-cubic (upstream's `useCountUp`, ported). The outer glow
`0 0 12px 2px rgba(106,0,255,.35)` is on the `Pressable`, which does not clip;
the `inset 0 1px 0 rgba(255,255,255,.15)` highlight is on the gradient, which
does — iOS drops a shadow drawn by the same view that clips its children. The
web's hover tooltip becomes a tap toggle that auto-hides after 3s (reference X4),
224pt wide, above and centred. `sm` gets an 8pt vertical `hitSlop` so its touch
target reaches 44 (G6).

**`src/components/layout/AppContainer.tsx`** gained upstream's `fixedHeight`
prop. Natively `flex: 1` already pins the container to the screen, so what the
prop adds is the clip (`overflow: hidden`) — children that overflow are cut off
rather than bleeding past the safe area.

**`src/hooks/useReducedMotion.ts`** — reads `AccessibilityInfo` and subscribes to
`reduceMotionChanged`, so `ProgressBar` and `StreakBadge` jump straight to their
final value when Reduce Motion is on (G10).

### 3. The dev gallery

`app/dev/primitives.tsx` renders every primitive in every variant and state,
grouped the way the reference groups them — buttons by variant × size plus
disabled/loading/icon states, all five card variants static and pressable plus
header/content/footer and flush, every progress variant/height/label
combination and the 0 and 100 edges, both currency amounts across five type
variants, all three streak sizes with a `+1 day` button that shows the count-up,
the whole `Section` `py` scale inside a visible frame, `Grid` at every column
count and gap, and a note on the container. The screen is itself an
`AppContainer edges={["top"]}` wrapping a `ScrollScreen` with a pinned footer,
so those two are exercised by being used. It redirects to `/` when `__DEV__` is
false.

### 4. Render tests

`vitest.config.mts` was split into two projects. `packages` is the existing
node-environment suite, unchanged. `components` renders `src/**/*.test.tsx` in
jsdom through `react-native-web` — the same substitution `expo start --web`
makes, and the only way to render these components without a device, since React
Native's own source is Flow-typed and vitest cannot parse it. `.web.*` files win
over their native siblings so each native module's web build is picked up, as
Metro resolves for the web platform.

Tests cover: every `SlayButton` variant and size plus disabled, loading and the
icon slots; every `SlayCard` variant plus pressable, flush and the three
sections; every `ProgressBar` variant's fill colour, the `scaleX` value, the
clamp at both ends, the glow appearing only above zero, both labels and the 8pt
height; both currency amounts across variants and accessible labels; every
`StreakBadge` size plus the tooltip toggling and auto-hiding on fake timers;
`AppContainer`, `Section`, `Grid` and `ScrollScreen` across their whole prop
matrices; and the gallery route rendering all eight of its sections at once.

## Changes by file

- `packages/tokens/src/colors.ts` — (modified) added the `artwork` namespace
  (`coin.rim/face/starShadow/text/rain`, `map.skyTop/skyMid/skyline`) and
  `alpha.white70`/`alpha.white80`.
- `packages/tokens/src/index.ts` — (modified) re-export `artwork`.
- `packages/tokens/src/colors.test.ts` — (modified) added suites asserting the
  `artwork` values, that no artwork value collides with a locked brand colour,
  and the full key list of the white-opacity scale.
- `src/components/ui/icons/CoinIcon.tsx` — (modified) five inline hex fills
  replaced with `artwork.coin.*` and `colors.white`; the file now has no raw hex.
- `src/components/layout/Section.tsx` — (new) the `py`/`pt`/`pb` spacing scale,
  12pt gap and optional label title.
- `src/components/layout/Grid.tsx` — (new) 1–4 equal columns with the gap scale
  and exact cell widths.
- `src/components/layout/ScrollScreen.tsx` — (new) scrolling screen with a
  pinned footer, `topOffset`, `bottomClearance` and the `VIEW_AS_BANNER_OFFSET`
  constant.
- `src/components/layout/AppContainer.tsx` — (modified) added the `fixedHeight`
  prop and its `overflow: hidden` style.
- `src/components/layout/index.ts` — (modified) export `Section`, `Grid`,
  `ScrollScreen`, `VIEW_AS_BANNER_OFFSET` and their types.
- `src/components/ui/ProgressBar.tsx` — (new) the three-variant bar with
  native-driver `scaleX` animation, glow and progressbar accessibility.
- `src/components/ui/CurrencyAmount.tsx` — (new) `CoinAmount` and `XpAmount`.
- `src/components/ui/StreakBadge.tsx` — (new) the gradient streak pill with
  count-up and tap tooltip.
- `src/components/ui/index.ts` — (modified) export `ProgressBar`, `CoinAmount`,
  `XpAmount`, `StreakBadge` and their types.
- `src/hooks/useReducedMotion.ts` — (new) the Reduce Motion hook both animated
  primitives read.
- `app/dev/primitives.tsx` — (new) the dev-only gallery route.
- `src/components/ui/SlayButton.test.tsx` — (new) variant, size, disabled,
  loading and icon-slot render tests.
- `src/components/ui/SlayCard.test.tsx` — (new) variant, pressable, flush and
  section render tests.
- `src/components/ui/ProgressBar.test.tsx` — (new) variant colour, scale, clamp,
  glow, label and height tests.
- `src/components/ui/CurrencyAmount.test.tsx` — (new) value, variant and
  accessible-label tests.
- `src/components/ui/StreakBadge.test.tsx` — (new) size, glyph and tooltip
  toggle/auto-hide tests.
- `src/components/layout/layout.test.tsx` — (new) `AppContainer`, `Section`,
  `Grid` and `ScrollScreen` prop-matrix tests.
- `src/components/primitives-gallery.test.tsx` — (new) renders the gallery route
  and asserts all eight sections, every progress bar and every streak badge.
- `vitest.config.mts` — (modified) split into `packages` and `components`
  projects; the latter adds the jsdom environment, the `react-native-web` alias,
  web-first resolve extensions, the `react-native-svg` web entry alias,
  `__DEV__` and the setup file.
- `scripts/test/setup-components.ts` — (new) `window.matchMedia` polyfill for
  `expo-haptics`' web build and a `react-native-safe-area-context` mock holding
  a notched phone's insets.
- `package.json`, `package-lock.json` — (modified) added
  `expo-linear-gradient@~57.0.2` (dependency) and `jsdom`,
  `@testing-library/react` (dev dependencies).

## Technical decisions

- **`Grid` cell width by negative margin, not measurement.** `onLayout`
  measurement would be exact too, but it costs a layout pass and a first frame
  at the wrong width. Percentage `flexBasis` cannot work, because RN style
  values cannot mix percent and points the way `calc(50% - 6pt)` does. The
  negative-margin arithmetic gives the exact value synchronously; the trade-off
  accepted is that the wrapper extends `gap/2` past its parent on every side
  (padding only, nothing drawn there).
- **RN `Animated` with the native driver, not Reanimated, for `ProgressBar`.**
  `scaleX` on the native driver already satisfies reference D10/X8 ("transforms
  on the UI thread"), and it does not need Reanimated's babel worklet plugin,
  which would have made the component untestable outside Metro. Reanimated
  remains the right tool for the looping animations `src/animations/` will hold.
- **`react-native-web` in jsdom for the render tests.** `@testing-library/
  react-native` needs `react-test-renderer` plus a babel transform for React
  Native's Flow-typed source — a large amount of test infrastructure for a repo
  with no babel test pipeline. `react-native-web` is already a dependency (Expo
  web) and is plain JS, so it renders in jsdom with no transform work. The cost
  is what the tests can assert: structure, text and accessibility, not computed
  pixels, since `react-native-web` turns styles into CSS classes. Where a pixel
  value really matters (`ProgressBar`'s fill colour, `scaleX` and track height)
  it survives as an inline style and is asserted directly.
- **`react-native-safe-area-context` is mocked, not inlined.** Its entry point
  resolves a native view manager through Metro's platform extensions, which
  vitest does not reproduce. The mock supplies a notched phone's insets; the
  library's own inset measurement is not this repo's to test.
- **Upstream's `grid` prop on `Grid` is not ported**, and `ProgressBar` gained no
  `glow` prop. Both would be API surface with no caller; a wrapping flex row
  already gives equal-height cells, and the reference's "plain bars without
  glow" are other components (parent map progress, practice share, study-time
  chart), not `ProgressBar` instances.
- **Spacing stays as plain point numbers in per-component maps**, matching
  `SlayButton`'s `SIZES` and `SlayCard`'s padding from SCN-5 and upstream's own
  per-component records. The "tokens only" rule (G2) is about colour; adding a
  spacing token module now would leave the existing primitives inconsistent with
  it.
- **`artwork.map.*` is added although nothing uses it yet.** The reference lists
  the `artwork` namespace as one addition; the three map values are declarative
  data, and naming them here is what stops `MapBackground` reaching for a raw
  hex in WP-3.1.
- **`fixedHeight` is implemented as a clip.** The web's `h-dvh` half of the prop
  is already what `flex: 1` does natively, so reproducing it literally would have
  been a no-op prop; the `overflow-hidden` half is real behaviour and is kept.

## Data, API and configuration

- **New dependencies:** `expo-linear-gradient@~57.0.2` (installed with
  `npx expo install`, for `StreakBadge`'s purple→cyan gradient),
  `jsdom@^30` and `@testing-library/react@^16` (dev, for the render tests).
- **New public exports:** `artwork` from `@slay/tokens`; `Section`, `Grid`,
  `ScrollScreen`, `VIEW_AS_BANNER_OFFSET` from `~/components/layout`;
  `ProgressBar`, `CoinAmount`, `XpAmount`, `StreakBadge` from `~/components/ui`;
  `useReducedMotion` from `~/hooks/useReducedMotion`.
- **New route:** `/dev/primitives`, dev-only (redirects to `/` when `__DEV__` is
  false), alongside the existing `/dev/ui`.
- No migrations, no schema or RPC changes, no env vars, no feature flags.
  `packages/core` was not touched; `npm run drift:check` still reports 48 tracked
  files in sync.

## How to verify

- `npm run lint` — clean.
- `npm run type-check` — clean.
- `npm test` — 35 files, 332 tests passing: 267 in the `packages` project (263
  pre-existing plus 4 new token suites) and 65 new in the `components` project.
- `npx expo export --platform ios` and `--platform android` — both bundle, so
  the new route and `expo-linear-gradient` resolve on both platforms.
- `npm run drift:check` — 48 tracked files in sync.
- Manually: `npm start`, open `/dev/primitives`, and compare it side by side
  with the web app's Storybook stories (`SlayButton.stories.tsx`,
  `SlayCard.stories.tsx`, `ProgressBar.stories.tsx`,
  `StreakBadge.stories.tsx` in `upstream/src/components/ui`). Press and hold a
  card to see the glow and 1.02 scale, tap a streak badge for its tooltip and
  watch it auto-hide after 3s, and tap `+1 day` to see the 600ms count-up.

## Limitations and follow-ups

- `ScrollScreen`'s `bottomClearance` is a number the caller passes, not
  `useBottomTabBarHeight()`, because there is no `Tabs` layout yet. WP-1.5
  (SCN-57, the router skeleton and per-role tab bars) should wire the real tab
  bar height in at the call sites.
- `ProgressBar`'s glow is clipped by the track on native exactly as it is by
  `overflow-hidden` on the web, which is the parity this item is judged on. If
  the design later wants the glow to read outside the track, it needs the glow
  moved to an outer unclipped view, which changes its shape from the fill's to
  the track's.
- The `components` vitest project asserts structure, text and accessibility
  rather than computed layout. A pixel-accurate check is the screenshot
  comparison the gallery exists for, not a unit test.
- `react-native-web` does not forward RN's nested `accessibilityValue` to
  `aria-valuenow`, so `ProgressBar`'s value is asserted through the fill's
  `scaleX` instead. The `accessibilityValue` prop itself is correct for native
  and is what a screen reader on a device reads.
- `packages/tokens/preset.js` (the NativeWind/Tailwind preset) was not given the
  `artwork` colours. Every primitive here styles with `StyleSheet`, so there is
  no `className` that needs them; add them when a `className` first does.
- Prettier reports pre-existing formatting drift in ~80 files across the repo.
  Only the files touched here were formatted; a repo-wide `npm run format` is a
  separate, mechanical change.
