# SCN-58 — App icon, Android adaptive icon and splash artwork

Design reference for **SCN-58: Configure portrait lock, splash screen, app icon and
dark `#111111` base**. Every file the task needs is in `assets/` at final size —
copy them, do not redraw them.

## Source and provenance

All artwork is derived from the web app's PWA icon
(`rubanwd/slay-city` → `public/icons/icon-512x512.png`): the Slay mascot (lime snake,
pink headphones, black "slay" cap and hoodie) on the brand pink `#FF2D8E` → purple
`#6A00FF` diagonal gradient. It is the same character users already see on the
installed PWA, so the native app is recognisably the same product.

> **Resolution caveat.** The largest existing source is 512×512. `icon.png` is a
> Lanczos upscale to 1024×1024 — sharp enough for the home screen and for
> development builds, but soft in the App Store / Play listing. Before store
> submission (WP-7.x), replace the files in `assets/` with a ≥1024 re-export of the
> original mascot art; the file names, sizes and safe-zone layout below stay the
> same, so it is a drop-in swap with no code change.

`tools/make_icons.py` regenerates every file from the 512 source
(`python3 tools/make_icons.py <icon-512x512.png> <out-dir>`, needs Pillow + numpy).
It is a design-time tool — not part of the app, not run in CI.

## Files

| File in `design/SCN-58/assets/` | Copy to | Size | Notes |
|---|---|---|---|
| `icon.png` | `assets/icons/icon.png` | 1024×1024 RGB, **no alpha** | iOS icon + store icon. Full bleed; iOS applies its own corner mask. Apple rejects icons with transparency, hence RGB. |
| `android-icon-foreground.png` | `assets/icons/android-icon-foreground.png` | 1024×1024 RGBA | Mascot cut out of the gradient, transparent background. Mascot's longest side is 54% of the layer, centred, so it stays inside the 66/108 safe circle under every launcher mask (circle, squircle, rounded square, teardrop). |
| `android-icon-background.png` | `assets/icons/android-icon-background.png` | 1024×1024 RGB | Same pink → purple diagonal gradient as the iOS icon, so both platforms show the same icon. |
| `android-icon-monochrome.png` | `assets/icons/android-icon-monochrome.png` | 1024×1024 RGBA | White silhouette of the foreground, same layout. Used by Android 13+ themed icons, which tint it. |
| `splash-icon.png` | `assets/splash/splash-icon.png` | 1024×1024 RGBA | Mascot cutout, transparent, 86% of the canvas. Shown centred on `#111111`. |

These replace the Expo-template placeholders that SCN-45 left at the same paths, so
`app.json` keeps its current paths.

## `app.json` configuration

```jsonc
{
  "expo": {
    "orientation": "portrait",
    "userInterfaceStyle": "dark",
    "backgroundColor": "#111111",
    "icon": "./assets/icons/icon.png",
    "ios": {
      "supportsTablet": false
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/icons/android-icon-foreground.png",
        "backgroundImage": "./assets/icons/android-icon-background.png",
        "monochromeImage": "./assets/icons/android-icon-monochrome.png",
        "backgroundColor": "#111111"
      },
      "edgeToEdgeEnabled": true
    },
    "plugins": [
      [
        "expo-splash-screen",
        {
          "image": "./assets/splash/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#111111"
        }
      ]
    ]
  }
}
```

Keys the agent must merge into what is already there, not overwrite wholesale —
`app.json` carries scheme, bundle identifiers and other plugins (`expo-router`,
`expo-secure-store`, `expo-audio`, `expo-font`) from earlier tasks. Two real changes
versus the current file: the splash config moves from the top-level `splash` key
(remove it) into the `expo-splash-screen` plugin entry, and the adaptive icon gains
`backgroundImage`.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Icon = the existing PWA mascot icon, not new art. | One identity across web and native; no art dependency blocks SCN-58. |
| D2 | iOS icon is opaque RGB, full bleed. | App Store rejects alpha in the 1024 icon; the gradient already fills the square. |
| D3 | Android adaptive icon uses the gradient as `backgroundImage`; `backgroundColor` stays `#111111`. | Same look as iOS. `backgroundColor` is the fallback only and keeps the dark base the task asks for. |
| D4 | Foreground mascot at 54% of the layer. | Android shows the centre 72/108 and guarantees only the 66/108 circle; 54% keeps cap and tail clear of every mask (see previews). |
| D5 | Splash = mascot on flat `#111111`, no wordmark, no gradient. | Splash must match the app's first frame (dark base) to avoid a colour flash; `expo-splash-screen` takes one centred image on a solid colour. Slay is the emotional centre, so the mascot alone. |
| D6 | Splash `imageWidth: 200`, `resizeMode: contain`. | Expo's default; ≈51% of a 390pt-wide screen — prominent without crowding. |
| D7 | Portrait only, `userInterfaceStyle: "dark"`, `supportsTablet: false`. | The app is designed mobile-first at 390pt, dark only (design tokens have no light theme). |
| D8 | Root view background `#111111` in addition to the splash colour. | Prevents a white flash between splash hide and first render. Set via `expo.backgroundColor` and the root layout's container (`bg-black` token = `#111111`). |

## Previews

`previews/preview-adaptive-circle.png` and `previews/preview-adaptive-squircle.png`
show the adaptive icon under the two most common launcher masks;
`previews/preview-splash-390.png` shows the splash on a 390×844 screen.

## Acceptance checks for SCN-58

- `npx expo config --type public` shows the paths above and `orientation: "portrait"`.
- `npx expo prebuild --clean` (or an EAS dev build) completes without icon warnings.
- On device: launcher icon matches the previews; splash is the mascot on `#111111`
  with no white flash before the first screen; rotating the device does not rotate the app.
