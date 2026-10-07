# SCN-54 — Load Nunito via expo-font and build typography components matching typography.css

> Type: feature · Date: 2026-10-07

## Context

WP-1.2 asks for the Nunito font family to be loaded natively and for typography
components whose sizes, weights and line heights match the web app's
`src/styles/typography.css`, with no flash of a fallback font on cold start.
The ticket's suggested steps describe this as new work: run
`npm run upstream:fetch`, pull the type scale out of `typography.css`, load
Nunito via `expo-font`/`@expo-google-fonts/nunito` in `app/_layout.tsx`, and
build `src/components/ui/typography/` with `Heading`, `Title`, `Body`,
`Caption` and `Label` components on NativeWind classes.

Investigating the repository before writing code showed that this entire
scope was already delivered — under a different, deliberately-chosen shape —
by **SCN-5** ("Create design-system UI components in `src/components/ui`"),
merged 2026-09-28, three weeks before this ticket entered the backlog.

## What was done

No code changes. This was a research-first pass that confirmed the ticket's
acceptance criteria are already met by existing code, and that completing the
ticket's literal steps would mean building a second, conflicting typography
system rather than closing a gap. Specifically:

- **Font loading** (steps 1–2) is already in `app/_layout.tsx`: it calls
  `useFonts` from `@expo-google-fonts/nunito` for all six weights
  (`Nunito_400Regular` … `Nunito_900Black`), calls
  `SplashScreen.preventAutoHideAsync()` at module scope, and renders `null`
  until `fontsLoaded || fontError`, only then calling `hideAsync()`. No screen
  can render before the real font is registered, so there is no flash of a
  fallback font.
- **The type scale** (step 1) is already ported from
  `upstream/src/styles/typography.css` into `packages/tokens/src/typography.ts`
  as `typeScale` — one entry per CSS utility class (`display`, `h1`, `h2`,
  `h3`, `body`, `bodyStrong`, `small`, `label`) carrying `min`/`vw`/`max`
  (the `clamp()` triplet), `weight`, `lineHeightRatio`, `letterSpacingEm` and
  `uppercase`, plus `fluidFontSize(variant, width)`, which reproduces the
  web's `clamp(min, vw, max)` at a concrete viewport width in points, and
  `fontFamilyByWeight`, which maps each numeric weight to the specific loaded
  Nunito font file (step 4 — React Native has no `font-weight` fake-bolding
  for a custom font, so the family name itself has to carry the weight).
  Re-fetching upstream (`npm run upstream:fetch`, head `beba39d`) and diffing
  `upstream/src/styles/typography.css` against `typeScale` confirms every
  value still matches; nothing has drifted since SCN-5.
- **The typography component** (step 3) already exists as
  `src/components/ui/SlayText.tsx` — a single component with a `variant` prop
  (`TextVariant`, defaulting to `"body"`) and an optional `weight` override,
  which reads `useWindowDimensions().width` and calls `fluidFontSize` so the
  rendered size tracks the viewport exactly like the web's `clamp()`, computes
  `lineHeight` as `lineHeightRatio × size` and `letterSpacing` as
  `letterSpacingEm × size`, and sets `textTransform: "uppercase"` for `label`.
  Its own doc comment calls it "the design system's only text primitive."

This shape was not an oversight — it is a recorded decision. The design
reference `design/SCN-5/index.html` (`<script id="slay-ui-spec">`, decision
**D8**) explicitly overrides the "Heading, body, caption" component split:

> promptSays: "Heading, body, caption using the web app's type scale." doInstead:
> "Size text with fluidFontSize(token, width) from packages/tokens using
> useWindowDimensions(). At the 390pt design width every style renders at its
> minimum." why: "The web scale is clamp(min, vw, max); at 390 each preferred
> value sits below its minimum... Heading → display/h1/h2/h3, body →
> body/bodyStrong, caption → small/label."

Building the `Heading`/`Title`/`Body`/`Caption`/`Label` set this ticket
describes, styled with static NativeWind `className`s as the ticket suggests,
would not just duplicate `SlayText` — it would be **less** accurate than it:
a static Tailwind text-size utility can't express the per-frame `clamp()`
evaluation `fluidFontSize` does against the live window width, so a
className-based component would only hit the web's rendered size at exactly
the 390pt design width and drift at every other width, failing WP-1.2's own
AC3 ("match the web's rendered sizes within 1 pt") on any other device.

Step 5 (render tests) is also not currently buildable without a separate,
repo-wide decision: `vitest.config.mts` scopes `test.include` to
`packages/**/*.test.ts` / `scripts/**/*.test.mjs` only, runs under
`environment: "node"`, and its own top-of-file comment states "Screen tests
arrive with the design system in M1" — i.e. component render-testing was
already identified and deliberately deferred to a dedicated future milestone,
not left as an incidental gap for this ticket to fill. There is no
`@testing-library/react-native`, `react-test-renderer` test setup, or
`jest-expo` preset wired into the project; introducing one is a test-runtime
architecture decision (which runner, which native-module mocking strategy)
that affects every future component ticket, not something to improvise inside
a single typography ticket.

## Changes by file

None.

## Technical decisions

- Did not create `src/components/ui/typography/` or new `Heading`/`Title`/
  `Body`/`Caption`/`Label` components. Doing so would duplicate `SlayText`
  (already the sole text primitive per SCN-5 decision D8) with a strictly
  less accurate, className-based implementation, and would give the codebase
  two competing typography APIs for the same eight CSS classes.
- Did not add a render-test harness. Choosing and wiring up a React Native
  component test runner is a project-wide decision `vitest.config.mts`
  already flags as deferred to a future milestone ("M1"), not something to
  decide unilaterally while closing a single typography ticket.
- Re-ran `npm run upstream:fetch` and diffed `typography.css` against
  `packages/tokens/src/typography.ts` to confirm no drift before concluding
  the ticket was already satisfied, rather than trusting the three-week-old
  SCN-5 change summary alone.

## Data, API and configuration

None.

## How to verify

- `npm run type-check` — passes, no errors, on the unmodified tree.
- Compared `upstream/src/styles/typography.css` (fetched fresh at upstream
  head `beba39d`) line-by-line against `packages/tokens/src/typography.ts`'s
  `typeScale`: every `min`/`vw`/`max`/weight/line-height/letter-spacing value
  still matches.
- Read `app/_layout.tsx` to confirm `useFonts` covers all six weights
  `fontFamilyByWeight` maps to, and that the splash screen is held until
  `fontsLoaded || fontError`.

## Limitations and follow-ups

- This ticket's underlying need (WP-1.2) is already satisfied by SCN-5's
  `SlayText` + `packages/tokens` typography work. The backlog item should be
  closed as already-done, or re-scoped if there is a genuine, separate gap
  (e.g. a product decision to split `SlayText` into named per-variant
  components, or to stand up component render tests) a maintainer wants
  pursued on purpose.
- If a maintainer does want named components (`Heading`, `Body`, etc.) as a
  thin, more ergonomic layer over `SlayText` (not a replacement), that is a
  design decision — which variants map to which name, whether they're
  `SlayText` wrappers with a fixed `variant` or something NativeWind-driven —
  that should be made explicitly rather than guessed here.
- If component render tests are wanted, the test-runtime choice
  (`@testing-library/react-native` + a jsdom-less RN environment, vs.
  `jest-expo` as a second test runner alongside vitest) needs a decision, since
  it affects every future UI-component ticket, not just this one.
