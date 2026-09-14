# @slay/core

Shared domain logic: reward maths, map unlock rules, puzzle generation, content
parsers, streak and study-time logic, validation, i18n dictionaries.

**Every `.ts` file here except `src/index.ts` is a tracked copy of a file in
[rubanwd/slay-city](https://github.com/rubanwd/slay-city).** Fix shared bugs
upstream, then sync. See [docs/SYNC.md](../../docs/SYNC.md).

## Layout mirrors upstream

The tree reproduces upstream's `src/` exactly — `features/…`, `types/…`, `lib/…`
— rather than reorganising into a tidier shape. That is deliberate:

- Files stay **byte-identical** to upstream, so the recorded hashes mean
  something and resolving a drift alert is a `cp`, not a re-write.
- Their internal `@/…` imports resolve unchanged, because the repository's `@/`
  alias points at `packages/core/src`.
- A reviewer can diff a file here against `upstream/` directly.

46 of the 48 tracked files are byte-identical copies. Two are adapted.

## The two adapted files

| File | What was left behind | Where it goes instead |
| --- | --- | --- |
| `features/auth/roleRouting.ts` | `ensureRoleProfile`, `resolveHomePath` — both take a Supabase client and query `profiles` | `packages/data` (WP-0.3) |
| `lib/hiss.ts` | `playSnakeHiss` — drives the Web Audio API | expo-audio adapter (WP-6.2) |

A drift alert on an adapted file needs judgement rather than a copy: check
whether the upstream change touched the half that lives here. Each file says so
in its header.

## Not copied, and why

| Upstream file | Why not | Lands in |
| --- | --- | --- |
| `features/homework/vocabulary.ts`, `grammar.ts` | `"use server"` — Next.js Server Actions | `packages/data` (WP-0.3) |
| `features/map/previewMap.ts` | constructs a Supabase client | `packages/data` (WP-0.3) |
| `features/teacher/viewAs.ts` | reads `next/headers` cookies | React context (WP-5.7) |
| `features/i18n/navLabels.ts` | imports `NavIconName` from the web's component barrel | tab bar (WP-1.5) |

The first three carry their own tests, which travel with them.

## Importing

```ts
import { missionRewardFraction, buildLocationProgress, roleHome } from "@slay/core";
import type { Profile, Mission } from "@slay/core/types";
```

Database-derived type aliases are **not** re-exported from the root barrel.
Upstream declares `MissionTaskType` in both `types/index` and
`features/mission/types` — the same database enum, two declarations — and two
star exports providing one name make it ambiguous, which drops the name entirely
rather than re-exporting it. Import those types from `@slay/core/types`.

## Rules

- Nothing here may import React, React Native, Next.js, Expo or `@supabase/*`.
  Enforced by ESLint, not by convention.
- Never edit a tracked file to fix a shared bug. Fix it upstream and sync.
- The tests are upstream's, copied unchanged. They are what makes a blind sync
  safe, so they must keep passing exactly as written rather than being adjusted.
