# design/

**`design/index.html` is the single design reference for SLAY CITY Native.** Attach it
to any design-related ticket (Atlas "Design & References": `design/index.html`).

It covers global rules, tokens (colour, type, spacing, glow, motion), icons, brand
assets, sound and haptics, layout and navigation, overlays, every primitive, shared
patterns, every student screen, all 32 task types, the teacher and parent consoles, the
web → native mapping and every deliberate deviation from the web. A ticket index near
the top says which section to read for which work package.

Per-ticket folders hold material the index builds on and agrees with:

| Folder | Contents |
|---|---|
| `SCN-5/` | Tokens + SlayText/Button/Card/Input/Pressable/AppContainer, with a JSON spec |
| `SCN-56/` | Section, Grid, ScrollScreen, ProgressBar, CurrencyAmount, StreakBadge, icon paths |
| `SCN-58/` | App icon, Android adaptive icon, splash artwork and `app.json` config |

`tools/build_index.py` regenerates `index.html` (`python3 design/tools/build_index.py`,
Python 3.11+). Edit the data in the script, re-run, and commit both files. Design-time
tool only — not part of the app, not run in CI.
