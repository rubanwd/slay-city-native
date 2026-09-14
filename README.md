# SLAY CITY Native

Native iOS and Android build of [SLAY CITY](https://github.com/rubanwd/slay-city),
built with Expo and React Native.

Covers the **student**, **teacher** and **parent** experiences. The admin console
stays web-only. Both apps run against the same Supabase project — same schema, same
RLS, same RPCs — so progress made on a phone is the same progress the web app shows.

## Getting started

```bash
npm install
npm start                 # then scan the QR code with Expo Go
```

| Command | |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run ios` / `npm run android` | dev build on a connected device |
| `npm run lint` / `type-check` / `test` | the gate every change must pass |
| `npm run upstream:fetch` | check out the web app at `./upstream` for reference |
| `npm run upstream:check` | fail if shared logic has drifted from upstream |

## How this repository relates to the web app

`rubanwd/slay-city` is in production and is **not** restructured by this project. It
owns `supabase/` and is the only repository that applies migrations; new RPCs and
Edge Functions this app needs are opened as pull requests there.

`packages/core` is a **tracked copy** of shared logic, not a fork. Fix shared bugs
upstream, then sync — a local edit to a tracked file is how the phone starts paying
different XP than the browser for the same mission. The contract is in
[docs/SYNC.md](docs/SYNC.md) and CI enforces it.

## Documentation

| | |
| --- | --- |
| [docs/CONCEPT.md](docs/CONCEPT.md) | What is being built and why it lives here |
| [docs/SYNC.md](docs/SYNC.md) | The shared-logic contract — read before touching `packages/core` |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layout, layer rules, backend boundary, auth |
| [docs/MIGRATION-MAP.md](docs/MIGRATION-MAP.md) | Where every file from the web app ends up |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phases M0–M8 and their exit criteria |
| [docs/WORK-PACKAGES.md](docs/WORK-PACKAGES.md) | 54 tasks with acceptance criteria |
| [docs/RISKS.md](docs/RISKS.md) | Store review, kids privacy, drift |
| [AGENTS.md](AGENTS.md) | Operating manual — read before writing code |

## Status

**M0 — Foundations.** `WP-0.1` complete: Expo Router, NativeWind and the upstream
reference mechanism are in place and the app bundles for both platforms.
`WP-0.2`–`WP-0.5` are next: populate `packages/core` and `packages/data`, and wire
the drift check into CI.
