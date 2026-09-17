# SLAY CITY Native

Native iOS and Android build of SLAY CITY (Expo + React Native), covering the
**student**, **teacher** and **parent** experiences. The admin console stays
web-only.

## Read first

- **[AGENTS.md](AGENTS.md)** — the operating manual. Layer rules, styling,
  security, definition of done. Read it before writing code.
- **[docs/SYNC.md](docs/SYNC.md)** — read before touching `packages/core`.
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — phases M0–M8 and where we are.
- **[docs/WORK-PACKAGES.md](docs/WORK-PACKAGES.md)** — the task you are probably
  being asked to do, with its acceptance criteria.

## The one thing that surprises people

This repository shares a live Supabase project, and `packages/core` is a
**tracked copy** of ~6 800 lines that also live in
[rubanwd/slay-city](https://github.com/rubanwd/slay-city).

**Never edit a file under `packages/core` to fix a shared bug.** Fix it upstream,
then sync. A local edit is how the phone starts paying different XP than the
browser for the same mission. `packages/core/.upstream.json` records what is
tracked; `npm run upstream:check` fails when upstream moves.

There is no `supabase/` directory here on purpose. The web repository owns the
migration timeline — new RPCs and Edge Functions go there as pull requests.

## Commands

```bash
npm start                  # Expo dev server
npm run lint               # eslint — also enforces the layer rules
npm run type-check         # tsc --noEmit
npm test                   # vitest (packages/**)
npm run upstream:fetch     # check the web app out to ./upstream (read-only)
npm run upstream:check     # fail if shared logic drifted from upstream
```

`./upstream` is gitignored and fetched on demand. Read it constantly while
porting — the diff between `upstream/src/features/mission/QuizTask.tsx` and
`src/features/mission/QuizTask.tsx` is what a reviewer wants to see. Never import
from it, never edit it, never commit it.

## Aliases

| Alias | Resolves to | Use for |
| --- | --- | --- |
| `@slay/core` | `packages/core/src` | shared domain logic |
| `@slay/core/types` | `packages/core/src/types` | database-derived types |
| `@slay/data` | `packages/data/src` | Supabase queries and RPC wrappers |
| `@slay/tokens` | `packages/tokens/src` | brand palette, type scale |
| `@/…` | `packages/core/src/…` | **inside the copied modules only** — it is what lets them stay byte-identical to upstream |
| `~/…` | `src/…` | this app's own screens and components |

## Before you commit

`npm run lint`, `npm run type-check` and `npm test` all pass; no raw hex colours;
no business logic added to `src/` that the web would also need; no secrets. The
full list is in [AGENTS.md](AGENTS.md).
