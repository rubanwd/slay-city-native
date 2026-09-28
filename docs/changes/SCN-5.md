# SCN-5 — Create design-system UI components in src/components/ui

> Type: feature · Date: 2026-09-28

## Context

Every screen the app needs (student, teacher, parent) has to be built from the
same design-system primitives the web app already has — text, buttons, cards,
inputs, a screen container and a pressed-state primitive. Nothing under
`src/components` existed yet; this ticket built the seven components those
screens will import, matching the design reference at
`.atlas/assets/slay-city-native-ui-components-sy4x2w.html` (design/SCN-5) value
for value — colours, sizes, states, letter-spacing — rather than estimating
from the web app's rendered UI.

The reference's `<script id="slay-ui-spec">` JSON was the source of truth, and
its nine "decisions" (D1–D9) override parts of the ticket prompt: dark-only, no
`primary`/`secondary`/`tertiary` renaming, `md` button height is 52pt (not the
web's broken `h-13`), `sm` button gets a `hitSlop` to reach the 44pt touch
target, ripple is opt-in only, input errors don't restyle the field, and text
sizes come from a fluid `clamp(min, vw, max)` scale evaluated at the actual
viewport width.

## What was done

**Tokens** (`packages/tokens`) — extended, not replaced:

- `colors.ts` gained `surface` (`#1A1A1A`, the card background upstream writes
  as a raw hex), an `alpha` object of every `white/N` opacity the product
  actually uses (0.05–0.60, plus a `black10` for the button press overlay),
  and `withAlpha(hex, opacity)` — converts any brand hex to an `rgba(...)`
  string, so `SlayCard`'s five variant glows are computed from the seven brand
  tokens instead of being typed out as five more raw hex/rgba literals.
- `typography.ts` gained `typeScale` (one entry per `SlayText` variant — `min`,
  `vw`, `max`, `weight`, `lineHeightRatio`, `letterSpacingEm`, `uppercase`,
  taken straight from the reference's `type` block), `fluidFontSize(variant,
  width)` (reproduces the web's `clamp(min, vw/100 * width, max)` in points),
  and `fontFamilyByWeight` (maps each numeric weight to the specific Nunito
  font file `@expo-google-fonts/nunito` registers — React Native has no
  fake-bold for a custom font, so the family name itself carries the weight).
- `preset.js` gained `surface` in its NativeWind colour map, keeping the
  Tailwind and TypeScript sides of the token from drifting apart (decision D4:
  one preset, extended rather than duplicated).

**Components**, all under `src/components/ui` (plus `src/components/layout`
for the screen wrapper), each a thin wrapper over RN primitives and tokens
with no business logic:

- **`SlayPressable`** — the shared pressed-state primitive. Takes a
  style-callback `style` prop (same shape as RN's own `Pressable`), an opt-in
  `haptic` boolean that fires `expo-haptics`' light impact on press-in, and an
  opt-in `ripple` boolean (`android_ripple` is `undefined` unless set — off by
  default per decision D6, since the web has no ripple and doubling it on
  pink/green buttons would over-signal the press).
- **`SlayText`** — the only text primitive. `variant` selects a row of
  `typeScale`; `useWindowDimensions().width` feeds `fluidFontSize` so the
  rendered size tracks the viewport exactly like the web's `clamp()`. Line
  height is `lineHeightRatio × size`, letter spacing is `letterSpacingEm ×
  size` (recomputed every render, since both scale with the fluid size), and
  `label` gets `textTransform: "uppercase"`. A `weight` prop can override a
  variant's default weight while keeping its size — used by `SlayInput`'s
  error/success messages, which are `small`-sized text at web weight 600, not
  `small`'s own 500.
- **`SlayButton`** — `variant` is `"pink" | "green" | "ghost"` (default
  `"pink"`), `size` is `"sm" | "md" | "lg"` (default `"md"`), plus `loading`,
  `disabled`, `iconLeft`, `iconRight`. Sizes are the reference's fixed
  per-breakpoint values (not fluid — button labels aren't part of the type
  scale), so `md` renders at exactly 52pt tall. Pressed pink/green render an
  absolutely-positioned `rgba(0,0,0,0.10)` overlay on top of the base colour
  (the "10% black overlay" the web's `active:brightness-90` produces); pressed
  ghost swaps its transparent background for `rgba(255,255,255,0.05)`.
  `loading` swaps `iconLeft` for an `ActivityIndicator` in the label colour,
  hides `iconRight`, and disables the button (so the 0.4 disabled opacity
  applies to it too, matching the web). `sm` gets `hitSlop: {top: 2, bottom:
  2}` so its 40pt visual height still reaches a 44pt touch target (D9). Every
  press fires a light haptic via `SlayPressable`.
- **`SlayCard`** — `variant` is `"pink" | "green" | "cyan" | "purple" |
  "ghost"` (default `"pink"`), plus `pressable` (the web's "hoverable" — native
  has no hover, so pressing drives the same glow/scale/border-colour change)
  and `flush` (removes the 16pt padding, for full-bleed media). Structurally
  it's two nested views: an outer `View` carrying the RN `boxShadow` glow and
  the pressed `scale: 1.02` transform, and an inner `View` carrying
  `overflow: hidden`, the 16pt radius, the 1px border and the padding — iOS
  clips a shadow drawn by the same view that clips its children, so the two
  responsibilities can't share a view. `SlayCard.Header`, `.Content` and
  `.Footer` are attached as static properties (typed via an intersection cast,
  since TS won't infer statics assigned after a function declaration); `Header`
  and `Footer` take a `divided` prop that adds the 12pt padding + 1px
  `rgba(255,255,255,0.10)` border-bottom/top: `Content` is `flex: 1, minWidth:
  0` so it fills the remaining space in a row layout.
- **`SlayInput`** — a labelled `TextInput` (`forwardRef<TextInput, ...>` so
  callers can call `.focus()`) with optional `hint`, `error` and `success`
  text underneath. Focus state (tracked via local `useState`, set in wrapped
  `onFocus`/`onBlur` handlers) swaps the background to `white/15`, the border
  to neon-pink, and adds a 2pt spread `boxShadow` ring — CSS `0 0 0px 2px
  rgba(255,45,142,0.60)`, drawn outside the 1px border rather than replacing
  it. Per decision D7, an `error` does **not** restyle the field: it renders
  as a neon-pink `SlayText` with `accessibilityRole="alert"` underneath,
  exactly like the web's unstyled `aria-invalid` + a text-neon-pink message.
  `editable={false}` drops the field's opacity to 0.5. `selectionColor` is
  neon-pink for the caret.
- **`AppContainer`** (`src/components/layout`) — the safe-area screen wrapper.
  A `SafeAreaView` (`edges` prop, default `["top", "bottom"]`) on the
  `#111111` ground, containing a `View` capped at `maxWidth: 448`, centred,
  with a 20pt horizontal gutter that `flush` removes.

**Font loading** (`app/_layout.tsx`) — added `useFonts` from
`@expo-google-fonts/nunito` for all six weights `fontFamilyByWeight` maps to
(400/500/600/700/800/900), and `expo-splash-screen`'s `preventAutoHideAsync` /
`hideAsync` so the splash screen holds until Nunito is loaded (or fails to
load) — the root layout renders `null` until then, so no screen can flash
system-font text.

**Demo screen** (`app/dev/ui.tsx`) — renders every component in every state
from the design reference, grouped into the same sections (type scale, button
variants × states × sizes, card variants at rest / pressable / anatomy /
flush, input default / filled / focus-on-tap / disabled / error / success),
wrapped in `AppContainer` itself so it doubles as a live check of the screen
wrapper. Redirects to `/` via `expo-router`'s `<Redirect>` when `!__DEV__`, so
it's unreachable in a production build.

## Changes by file

- `packages/tokens/src/colors.ts` — modified. Added `surface`, `semantic.error`
  / `semantic.success` / `semantic.surface`, the `alpha` opacity-token object,
  and `withAlpha(hex, opacity)`.
- `packages/tokens/src/colors.test.ts` — new. Verifies `withAlpha` against the
  four brand colours `SlayCard`'s glows are computed from.
- `packages/tokens/src/typography.ts` — modified. Added `fontFamilyByWeight`,
  `typeScale` and `fluidFontSize`.
- `packages/tokens/src/typography.test.ts` — new. Verifies `fluidFontSize`
  lands on each variant's minimum at 390pt, grows below the max, and clamps at
  both ends.
- `packages/tokens/src/index.ts` — modified. Re-exports the new tokens above.
- `packages/tokens/preset.js` — modified. Added `surface` to the NativeWind
  colour map.
- `src/components/ui/SlayPressable.tsx` — new. The shared pressed-state /
  haptic / ripple primitive.
- `src/components/ui/SlayText.tsx` — new. Fluid-sized text primitive, eight
  variants.
- `src/components/ui/SlayButton.tsx` — new. `pink`/`green`/`ghost` ×
  `sm`/`md`/`lg`, loading/disabled/icon props.
- `src/components/ui/SlayCard.tsx` — new. Five variants, `pressable`/`flush`,
  `Header`/`Content`/`Footer` subcomponents.
- `src/components/ui/SlayInput.tsx` — new. Labelled field with
  hint/error/success and focus ring.
- `src/components/ui/index.ts` — new. Barrel export for the five `ui`
  components.
- `src/components/layout/AppContainer.tsx` — new. Safe-area screen wrapper.
- `src/components/layout/index.ts` — new. Barrel export.
- `app/_layout.tsx` — modified. Loads Nunito 400–900 via `useFonts` and holds
  the splash screen until fonts are ready (or have failed).
- `app/dev/ui.tsx` — new. Dev-only showcase of every component/state,
  redirects to `/` when `!__DEV__`.
- `package.json` / `package-lock.json` — modified. Added `expo-font` (already
  a transitive dependency, now direct), `expo-splash-screen`, `expo-haptics`,
  `@expo-google-fonts/nunito`, all via `npx expo install` for SDK-57
  compatibility.
- `app.json` — modified. `expo install` appended `"expo-font"` and
  `"expo-splash-screen"` to the `plugins` array.

## Technical decisions

- **Button label text is not `SlayText`.** `SlayText`'s sizes are fluid
  (`clamp`); the reference's button size table (`sizes.sm/md/lg`) gives fixed
  per-breakpoint values with no `vw` component. Styling the label inline with
  those exact numbers keeps a button's size deterministic and matches the
  reference's own framing — button sizing isn't part of the "heading / body /
  caption" type scale D8 describes.
- **`SlayCard`'s glow colours are computed with `withAlpha`, not five more
  literal `rgba(...)` strings.** The reference gives five variants × two
  glow states (rest/pressed) × border colour = 15 colour values, all derived
  from the same four brand hexes at different opacities. Computing them from
  `colors` keeps the only source of truth for "what pink/green/cyan/purple
  actually are" in one place, and is what let `packages/tokens/src/colors.test.ts`
  assert the math instead of eyeballing it.
- **`SlayCard`'s compound-component typing uses an intersection cast
  (`typeof SlayCard & { Header; Content; Footer }`) rather than a namespace or
  `Object.assign`.** Assigning `SlayCard.Header = Header` directly after a
  `function SlayCard(...)` declaration is a TS error (the inferred function
  type has no `Header` property); the cast is the smallest change that keeps
  `SlayCard.Header`/`.Content`/`.Footer` both type-safe and importable as one
  identifier, matching how the ticket's naming (`SlayCard.Header`) implies
  they should be used.
- **`SlayInput`'s field/message text sizing borrows `typeScale.body`/`.small`
  values directly instead of rendering the field through `SlayText`.**
  `TextInput` isn't `Text` — it can't wrap a `SlayText` child — so the field's
  14/21pt body styling is set inline from the same `typeScale` source `SlayText`
  reads, keeping one number, not two, if the scale changes. The label/hint/
  error/success rows *are* `SlayText`, since those genuinely are separate text
  nodes.
- **Focus state is local `useState`, not driven by NativeWind's `focus:`
  pseudo-class.** The focused style needs a `boxShadow` ring layered outside
  the border and a background swap together, which is simpler to express as a
  single conditional style object than as composed utility classes, and it
  keeps `SlayInput`'s visual states in the same place as `SlayButton`'s
  (props/state → a style array), rather than splitting the design system
  between two styling mechanisms.
- **`app.json`'s legacy top-level `splash` key was left as-is.** `expo
  install` registered the `expo-splash-screen` plugin without touching it;
  migrating `splash` into plugin-config options is a separate, unrelated
  change this ticket didn't ask for, and the existing key still configures the
  native splash image `SplashScreen.hideAsync()` dismisses.

## Data, API and configuration

- New dependencies (all via `npx expo install`, SDK-57-compatible versions):
  `expo-font@~57.0.4` (was already transitive; now a direct dependency since
  `SlayText`/`SlayInput`/`SlayButton` rely on the fonts it loads),
  `expo-splash-screen@~57.0.9`, `expo-haptics@~57.0.3`,
  `@expo-google-fonts/nunito@^0.4.2`.
- `app.json`'s `plugins` array gained `"expo-font"` and `"expo-splash-screen"`,
  appended automatically by `expo install`.
- No schema, RPC or Supabase-project changes; no new env vars.

## How to verify

- `npm run lint` — passes, no errors or warnings.
- `npm run type-check` — passes, no errors.
- `npm test` — 189/189 tests pass across 18 files (5 new: `fluidFontSize`
  hitting each variant's `min` at 390pt and clamping at both ends;
  `withAlpha` against the four brand colours `SlayCard` derives its glows
  from).
- `grep -rnE "#[0-9A-Fa-f]{3,8}\b" src/` and the same over `app/` — both
  return no matches; every colour in the new components comes from
  `@slay/tokens`.
- Manual, not run in this environment (no device/simulator attached): launch
  `npx expo start` and open `/dev/ui` to see every variant/state render, press
  a `SlayButton`/`pressable` `SlayCard` to see the pressed overlay/glow and
  feel the haptic, tap a `SlayInput` to see the focus ring, and confirm a
  `md` `SlayButton` measures 52pt tall (e.g. via the RN inspector).

## Limitations and follow-ups

- Not verified on a physical device or simulator in this environment — no
  device was available. Everything above is confirmed by `lint`/`type-check`/
  `test` and by reading the demo screen's JSX against the design reference;
  the pressed states (button overlay, card glow/scale, input focus ring) and
  the haptic feedback need a manual pass on iOS and Android before this is
  considered fully verified.
- `SlayCard`'s pressed `scale: 1.02` transform and glow only trigger through
  `pressable={true}` + an actual press — the demo screen's "Pressable" section
  has real `SlayCard` instances with `onPress` handlers, but their pressed
  visuals aren't screenshotted here.
- `SlayInput`'s "Focused" demo row is a real field, not a forced style — it
  only shows the focus ring once a person taps it on a device, matching how
  focus actually has to be demonstrated for a native `TextInput`.
- The reference's `SlayPressable` table also describes an opt-in ripple for
  future "list rows"; no list-row component exists yet, so `ripple` is
  implemented and typed but has no consumer yet.
