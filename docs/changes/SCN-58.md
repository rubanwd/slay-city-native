# SCN-58 — Configure portrait lock, splash screen, app icon and dark #111111 base

> Type: task · Date: 2026-10-07

## Context

WP-1.6 ("App chrome") asks for the native shell's first impression to be
correct before any real screens land: locked to portrait, a splash screen and
app icon that are actually SLAY CITY's brand (`AC2`: "Splash and icon use
brand assets from `public/icons/`"), and a `#111111` base with no white flash
between the native splash and the first React frame.

`SCN-45` (the Expo bootstrap) had already set most of the *configuration*
shape — `orientation: "portrait"`, `userInterfaceStyle: "dark"`,
`backgroundColor: "#111111"`, an `adaptiveIcon.backgroundColor` of
`#111111`, a root `app/_layout.tsx` that holds the splash until fonts finish
loading, and a `ScrollScreen`/`Stack` background of `colors.black`. What it
had *not* done: the five PNGs under `assets/icons/` and `assets/splash/`
were still the generic placeholder art `npx create-expo-app` ships by
default (a blue chevron-on-light-blue icon and a grey-circles-on-white
splash image) — never swapped for the real mascot. The white splash image in
particular is the one thing in the whole chain that could still cause a
white flash on a slow device, since `expo-splash-screen` paints
`backgroundColor` behind the image but the image itself was opaque white
edge-to-edge. Running `npx expo-doctor` also turned up three app.json schema
errors caused by SDK 57 removing fields `SCN-45` had set under an earlier
SDK: `newArchEnabled`, `android.edgeToEdgeEnabled`, and the top-level
`splash` key.

## What was done

**1. Replaced the placeholder icon/splash art with the real brand mascot.**
`upstream/public/wardrobe/slay_mascot.png` (1024×1024, transparent
background, the neon-green snake-in-a-hoodie-and-headphones character used
across the web app's wardrobe) is the only clean, high-resolution,
transparent-background source of the brand mark in the upstream repo — the
web app's own `public/icons/icon-*.png` files are that same mascot already
flattened onto a pink/purple gradient, which is wrong for an adaptive-icon
foreground or a splash image that needs to sit on `#111111`. A one-off
Pillow script (run locally, not checked in) cropped the mascot to its
opaque bounding box (609×1007) and re-composited it four ways:
  - `assets/icons/icon.png` — flattened onto an opaque `#111111` canvas,
    mascot at ~74% of the 1024px height. This is the iOS/fallback app icon;
    iOS icons must be fully opaque, so this one has no alpha channel.
  - `assets/icons/android-icon-foreground.png` — the mascot at 50% scale,
    transparent background, centered. Android's adaptive-icon safe zone is
    the center 66dp of a 108dp canvas (~61% of the diagonal); at 50% scale
    the mascot's bounding-box diagonal is ~589px against a 1024px canvas,
    comfortably inside the ~626px safe circle, so the launcher's mask
    (circle, squircle, rounded-square, whatever the OEM uses) can't clip the
    head or tail.
  - `assets/icons/android-icon-monochrome.png` — the same 50%-scale
    silhouette, recolored to solid white-on-transparent (`(255,255,255,
    alpha)`), for Android 13+ themed/monochrome icons, which recolor
    whatever is opaque to match the user's wallpaper palette.
  - `assets/splash/splash-icon.png` — the mascot at the same ~74% scale as
    the app icon, transparent background. `expo-splash-screen` paints its
    own `backgroundColor` (`#111111`) behind this image, so transparency
    here is what makes the splash screen dark instead of white.
  All four are still 1024×1024 PNGs at the same paths `app.json` already
  pointed at, so no config path changed — only the pixels did.

**2. Fixed three `app.json` schema errors `expo-doctor` reported.** SDK 57
removed three fields that were valid when `SCN-45` wrote them:
  - `newArchEnabled` — the New Architecture is mandatory as of SDK 54+ and
    the field no longer exists in the schema; removed.
  - `android.edgeToEdgeEnabled` — edge-to-edge is mandatory as of SDK 54+
    (Android 16 forces it); `@expo/prebuild-config`'s own edge-to-edge
    plugin now emits an explicit warning telling you to delete this key.
    Removed.
  - Top-level `splash` — deprecated in favor of configuring the
    `expo-splash-screen` config plugin directly. Moved `image`,
    `resizeMode` and `backgroundColor` into a `["expo-splash-screen", {...}]`
    plugin-array entry; the values themselves (`./assets/splash/splash-icon.png`,
    `"contain"`, `"#111111"`) are unchanged.

**3. Verified, did not change, the parts of WP-1.6 already in place.**
`app/_layout.tsx` already calls `SplashScreen.preventAutoHideAsync()` at
module scope and only calls `hideAsync()` once `useFonts()` resolves
(fonts-loaded or fonts-errored), and renders `null` until then — so the
native splash stays up for the whole font-load window, never handing off to
a blank/white React tree. `ScrollScreen` (`src/components/layout/ScrollScreen.tsx`)
and the root `Stack`'s `contentStyle` both already use `colors.black`
(`#111111`) from `@slay/tokens`, and `packages/tokens/src/colors.ts`'s six
locked brand colors were not touched. None of this needed a code change.

## Changes by file

- `app.json` — modified. Removed `newArchEnabled` and
  `android.edgeToEdgeEnabled` (no longer valid/configurable keys as of
  Expo SDK 57). Moved the `splash` object's three keys into a
  `["expo-splash-screen", { image, resizeMode, backgroundColor }]` plugin
  config entry, replacing the bare `"expo-splash-screen"` string in
  `plugins`. No path or color value changed.
- `assets/icons/icon.png` — replaced. Was the generic Expo template icon
  (blue chevron on light blue); now the SLAY CITY mascot on an opaque
  `#111111` ground, 1024×1024.
- `assets/icons/android-icon-foreground.png` — replaced. Was the same
  generic chevron art; now the mascot at 50% scale, transparent background,
  centered inside Android's adaptive-icon safe zone.
- `assets/icons/android-icon-monochrome.png` — replaced. Now a solid-white
  silhouette of the mascot at the same scale/position as the foreground,
  for Android 13+ themed icons.
- `assets/splash/splash-icon.png` — replaced. Was a grey-circles-on-white
  placeholder (opaque white background — the one real white-flash risk in
  the chain); now the mascot on a transparent background so
  `expo-splash-screen`'s `#111111` shows through.
- `docs/changes/SCN-58.md` — new. This file.

## Technical decisions

- **Source the mascot from `upstream/public/wardrobe/slay_mascot.png`, not
  `upstream/public/icons/icon-512x512.png`.** The `icons/` folder's PNGs are
  the web favicon/PWA icons, already flattened onto a pink-to-purple
  gradient — reusable for a browser tab icon, wrong for a native app icon
  that needs either a clean `#111111` ground (iOS) or a fully transparent
  layer the OS composites itself (Android adaptive icon). `wardrobe/slay_mascot.png`
  is the only upstream asset that is both high-resolution (1024²) and
  genuinely transparent, so it's the correct source to re-composite from.
- **Scaled down for the adaptive-icon foreground instead of reusing the
  app-icon crop at 1:1.** The mascot's bounding box is tall and narrow
  (609×1007, 1.65:1), and Android's launcher mask only guarantees the
  center 66dp of 108dp is never clipped. Pasting it at the same ~74% scale
  used for the flat app icon would let OEM masks (circular, squircle) crop
  the character's head or tail on real devices. Scaling to 50% keeps the
  bounding-box diagonal inside the safe circle with margin to spare, at the
  cost of a visually smaller mark on the home screen — a real trade-off,
  but adaptive-icon clipping is worse than a smaller icon.
- **Did not touch `expo-asset`/`react-native-worklets` peer-dependency
  warnings or the four SDK patch-version mismatches `expo-doctor` also
  reports.** Both are pre-existing, unrelated to orientation/splash/icon/
  background (they're about `expo-audio`/`reanimated` native-module peer
  deps and `expo`/`expo-constants`/`expo-linking`/`expo-router` patch
  versions), and fixing them means touching packages this ticket has no
  reason to pull in. Left as-is; see Limitations.
- **Left `assets/icons/favicon.png` untouched.** It is also still the
  generic Expo placeholder, but it is not referenced anywhere in `app.json`
  and only ever matters for `expo start --web`'s browser tab — outside
  WP-1.6's "native shell" scope (orientation/splash/icon/background all
  target iOS+Android).

## Data, API and configuration

- `app.json`: `expo-splash-screen`'s plugin config now carries `image`/
  `resizeMode`/`backgroundColor` instead of the removed top-level `splash`
  key; `newArchEnabled` and `android.edgeToEdgeEnabled` removed as they are
  no longer configurable (both behaviors are now unconditional in SDK 57).
  No schema, auth, API, or dependency changes.

## How to verify

- `npx expo config --type public` — resolves cleanly; `plugins` shows
  `expo-splash-screen` with its `image`/`resizeMode`/`backgroundColor`
  options, `android.adaptiveIcon` and top-level `icon`/`backgroundColor`
  are unchanged paths.
- `npx expo-doctor` — the "Check Expo config schema" check now passes
  (was failing on `newArchEnabled`, `splash`, `android.edgeToEdgeEnabled`
  before this change). 19/21 checks pass overall; the 2 remaining failures
  (missing `expo-asset`/`react-native-worklets` peer deps, 4 SDK patch-version
  mismatches) are pre-existing and unrelated to this ticket.
- `npm run lint`, `npm run type-check`, `npm test` — all pass (346/346
  tests, no regressions; this ticket touched no `.ts`/`.tsx` source).
- Manual: inspected all four regenerated PNGs (corner-pixel and
  alpha-histogram checks) to confirm `icon.png` is a fully opaque
  `#111111`-backed RGB image, `android-icon-foreground.png` and
  `splash-icon.png` are transparent (`alpha=0`) outside the mascot, and
  `android-icon-monochrome.png`'s opaque pixels are pure white
  `(255,255,255)`. A real device/simulator launch was not run in this
  environment — `npx expo start` needs a connected device or simulator,
  which isn't available here.

## Limitations and follow-ups

- `expo-doctor`'s two remaining failures (missing `expo-asset` and
  `react-native-worklets` peer dependencies for `expo-audio`/
  `react-native-reanimated`; `expo`/`expo-constants`/`expo-linking`/
  `expo-router` patch-version drift) are real and worth a follow-up ticket,
  but are orthogonal to WP-1.6 — fixing them means an `npx expo install
  --check` pass across unrelated native modules.
- `assets/icons/favicon.png` is still the generic Expo placeholder;
  harmless for the native builds this ticket covers, but worth swapping if
  `expo start --web` is ever used for anything beyond ad-hoc debugging.
- No real device or simulator was available to confirm the splash-to-first-frame
  transition visually; verification here is limited to config validation,
  pixel-level asset inspection, and the existing automated test suite.
