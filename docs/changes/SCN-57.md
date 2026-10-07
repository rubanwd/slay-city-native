# SCN-57 — Create role-group route skeleton with placeholder screens and role-aware layouts

> Type: feature · Date: 2026-10-07

## Context

WP-1.5 asks for the full Expo Router tree for the three in-app roles —
student, teacher, parent — laid out with placeholder screens, so navigation
can be exercised on a physical device before any real feature exists. The
`(auth)`, `(student)`, `(teacher)` and `(parent)` route groups already existed
as empty stubs (`SCN-45`/`SCN-53`), each with a `_layout.tsx` rendering a bare
`<Slot />` and a one-line comment pointing at this ticket. `app/index.tsx` was
still SCN's original "toolchain smoke screen" (WP-0.1), explicitly commented
"WP-1.5 replaces it with the real route skeleton." This ticket is that
replacement: real tab layouts, real (placeholder) screens per role, and a
dev-only way to jump between roles until the auth milestone (WP-2.6) adds a
real role-based redirect.

## What was done

**Route inventory, derived from `upstream/src/app/**` and
`upstream/src/components/layout/navigation.ts`** (the web's own tab model,
`navItemsForRole`/`consoleItems`), not guessed:

- **Student** — Map, Wardrobe, Homework, Profile. Matches
  `STUDENT_ITEMS`/`STUDENT_HOMEWORK_ITEM`/`STUDENT_PROFILE_ITEM` in
  `navigation.ts` and the bare top-level `upstream/src/app/{map,wardrobe,homework,profile}`
  directories.
- **Teacher** — Groups (the `/teacher` dashboard, which lists the teacher's
  groups — `upstream/src/app/teacher/page.tsx`), Map, Profile. Matches
  `consoleItems("/teacher")`.
- **Parent** — Progress (the `/parent` dashboard, showing the linked
  student's progress — `upstream/src/app/parent/page.tsx`), Map, Profile.
  Matches `consoleItems("/parent")`.

The ticket's own example list additionally named Q&A, Vocabulary and Grammar
for the teacher. Those live three directory levels deep in upstream
(`teacher/groups/[groupId]/topics/[topicId]`), are dynamic-param routes tied
to real group/topic content, and would need either business logic or invented
placeholder data to render meaningfully — both ruled out by this ticket's own
"no business logic, no data fetching" constraint. They were left for the
teacher console's group/topic detail work package instead of built as
flat, disconnected placeholders here. See **Technical decisions** below.

**Route-name collision, found and resolved before writing any screens:**
Expo Router strips a route group's parenthesized name from the resulting
URL, so an unqualified `(student)/map.tsx`, `(teacher)/map.tsx` and
`(parent)/map.tsx` would all resolve to the same pathname, `/map` — same for
`profile`. A static file-tree build keeps group subtrees distinct internally,
but there is currently no guard that mounts only one role's group at a time
(that is WP-2.6), so the dev switcher built in this ticket can reach any
group from `/`, making the collision real in practice, not just hypothetical.
Resolved by keeping the student group's names bare (`map`, `wardrobe`,
`homework`, `profile` — matching upstream's own bare URLs, since the student
role is native's un-prefixed default, same as the web) and qualifying the
teacher and parent groups' shared screens as `teacher-map` /
`teacher-profile` and `parent-map` / `parent-profile`. Tab *labels* still read
"Map" / "Profile" in the UI — only the underlying route/file name carries the
role prefix. Verified empirically: `npx expo export --platform android`
bundled cleanly (1774 modules, no route-conflict error) and
`.expo/types/router.d.ts` regenerated with exactly one unambiguous pathname
per screen, confirmed by reading the file after the export.

**Files added, by layer:**

- A shared presentational shell, `RoutePlaceholder` (`src/features/dev/`),
  renders a `ScrollScreen` + `AppContainer` with a role eyebrow, the screen's
  title, a one-line "no data yet" note, and a `Section` of `Link`s to every
  other placeholder in that role's tree — satisfying the ticket's "title and
  a link to the other placeholders" requirement without 10 copies of the same
  layout code.
- Ten role-specific placeholder components (`src/features/student/*`,
  `src/features/teacher/*`, `src/features/parent/*`), each a thin default
  export that calls `RoutePlaceholder` with its own title/role/links.
- Ten route files under `app/(student)/`, `app/(teacher)/`, `app/(parent)/`,
  each exactly `export { default } from "~/features/<role>/<Name>Placeholder";`
  — the "route files stay thin, only import from `src/features/<role>/...`"
  rule applied literally.
- Three `_layout.tsx` files (`(student)`, `(teacher)`, `(parent)`), each a
  `Tabs` navigator with brand-token colours (`colors.limeGreen` active tint,
  `alpha.white50` inactive, `colors.black`/`alpha.white10` bar
  background/border) and no icons — `BottomNav`'s tab icons were never ported
  to `src/components/ui/icons` (WP-1.4 only covers the shared icon set
  CoinIcon/XpIcon/ShareIcon), so this ticket ships text-only tabs rather than
  inventing icon assets out of scope.
- `app/index.tsx` now renders `RoleSwitcher` (`src/features/dev/`): a
  dev-only screen linking into each role's home route (`/map`, `/groups`,
  `/progress`), headed "Dev only — removed at the auth milestone (WP-2.6)".

**Tests** (see **How to verify** for why these run under Vitest/jsdom rather
than `expo-router/testing-library`):

- `app/layouts.test.tsx` — renders all three `_layout.tsx` files with `Tabs`
  mocked to a text stub, asserts each declares the expected tab titles.
- `app/index.test.tsx` — renders the dev switcher, asserts the three role
  links resolve to `/map`, `/groups`, `/progress`.
- `src/features/{student,teacher,parent}/placeholders.test.tsx` — renders
  every placeholder, asserts its title and that every sibling link's `href`
  matches the route file actually on disk for that role.

## Changes by file

- `src/features/dev/RoutePlaceholder.tsx` — new. Shared placeholder shell
  (title, role eyebrow, sibling links) every role screen calls into.
- `src/features/dev/RoleSwitcher.tsx` — new. Dev-only `/` screen content;
  links into each role group's home route.
- `src/features/dev/index.ts` — new. Barrel for the two above.
- `src/features/student/{Map,Wardrobe,Homework,Profile}Placeholder.tsx` — new.
  Student placeholder screens.
- `src/features/student/index.ts` — new. Barrel.
- `src/features/student/placeholders.test.tsx` — new. Renders each, asserts
  title + sibling links.
- `src/features/teacher/{Groups,Map,Profile}Placeholder.tsx` — new. Teacher
  placeholder screens.
- `src/features/teacher/index.ts` — new. Barrel.
- `src/features/teacher/placeholders.test.tsx` — new.
- `src/features/parent/{Progress,Map,Profile}Placeholder.tsx` — new. Parent
  placeholder screens.
- `src/features/parent/index.ts` — new. Barrel.
- `src/features/parent/placeholders.test.tsx` — new.
- `app/(student)/_layout.tsx` — modified. `<Slot />` stub → `Tabs` navigator
  declaring `map`, `wardrobe`, `homework`, `profile`.
- `app/(student)/{map,wardrobe,homework,profile}.tsx` — new. Thin re-exports
  of the matching student placeholder.
- `app/(teacher)/_layout.tsx` — modified. `<Slot />` stub → `Tabs` navigator
  declaring `groups`, `teacher-map`, `teacher-profile`.
- `app/(teacher)/{groups,teacher-map,teacher-profile}.tsx` — new. Thin
  re-exports of the matching teacher placeholder.
- `app/(parent)/_layout.tsx` — modified. `<Slot />` stub → `Tabs` navigator
  declaring `progress`, `parent-map`, `parent-profile`.
- `app/(parent)/{progress,parent-map,parent-profile}.tsx` — new. Thin
  re-exports of the matching parent placeholder.
- `app/index.tsx` — modified. Toolchain smoke screen (WP-0.1) replaced by the
  `RoleSwitcher` dev route-switcher.
- `app/index.test.tsx` — new. Asserts the switcher's three role links.
- `app/layouts.test.tsx` — new. Asserts each role layout's declared tabs.
- `vitest.config.mts` — modified. Added `"app/**/*.test.tsx"` to the
  `components` project's `include`, so route-level tests run through the same
  jsdom/`react-native-web` setup as `src/**/*.test.tsx` (SCN-56).

## Technical decisions

- **Role-prefixed route names for the teacher/parent "Map"/"Profile" screens,
  bare names for student.** Alternatives considered: (a) bare names
  everywhere and rely on a future role guard to make the collision moot —
  rejected, because that guard doesn't exist yet (`WP-2.6`) and the dev
  switcher this ticket adds can reach any group from `/` today, so the
  collision would be live immediately, not theoretical; (b) nest teacher and
  parent under literal `teacher/` and `parent/` path segments, matching
  upstream's own URL prefixes exactly — rejected because the group folders
  `(student)`, `(teacher)`, `(parent)` already existed from an earlier ticket
  (`SCN-45`), and un-parenthesizing them was a larger, out-of-scope change
  this ticket didn't need to make. The chosen fix is a file/route rename only
  — `teacher-map`/`parent-map` instead of `map` — with no effect on the tab
  bar's visible label, confirmed collision-free by both reading
  `getRoutesCore.js`'s directory-building logic and, more conclusively, by
  running a real `npx expo export --platform android` and inspecting the
  regenerated `.expo/types/router.d.ts`.
- **Did not add the teacher's Q&A/Vocabulary/Grammar as flat placeholder
  routes**, despite the ticket's example text naming them. They are nested,
  dynamic-param routes in upstream, not top-level ones, and placeholders for
  them would need invented group/topic IDs to be reachable at all — which
  reads as business logic (deciding what content exists) rather than a route
  skeleton. Flagged explicitly rather than silently dropped; a future ticket
  building the teacher group/topic detail routes is the natural place for
  them.
- **No tab bar icons.** `BottomNav.tsx` upstream draws its tab icons as
  inline SVGs, not through the shared icon component library `SCN-55` ported
  (`CoinIcon`/`XpIcon`/`ShareIcon`). Porting five more icons (map, wardrobe,
  profile, homework, dashboard) was out of this ticket's scope — it asks for
  placeholder *screens*, not a finished tab bar — so the `Tabs` layouts use
  `options.title` text only.
- **Tests run through the existing Vitest `components` project
  (jsdom + `react-native-web`), not `expo-router/testing-library`.** That
  library's `renderRouter` requires `@testing-library/react-native` (not a
  dependency here) and calls bare `jest.useFakeTimers()`/`jest.setSystemTime()`
  — `jest` is not a global under Vitest. Introducing Jest to get one test
  helper working would reopen a decision `SCN-53` already made explicitly
  (Vitest-only, no Jest). Followed the precedent already set by
  `src/components/primitives-gallery.test.tsx`: `vi.mock("expo-router", ...)`
  stubs exactly the exports a given screen/layout touches (`Link`, or
  `Tabs`/`Tabs.Screen`), and the test asserts on rendered text/links, not on
  real React Navigation state. This also matches the `components` project's
  documented constraint recorded in prior-session memory — importing
  `expo-router` unmocked into a jsdom test fails immediately with the same
  stackless `SyntaxError: Unexpected token 'typeof'` as the four other known
  react-native-web config pitfalls, reproduced and confirmed during this run
  before settling on the mock-based approach.
- **Route-tree correctness proven by actually bundling, not by reasoning
  about it.** Rather than trust a reading of `expo-router`'s internal
  `getRoutesCore.js` for whether sibling route groups may reuse a leaf name,
  ran `npx expo export --platform android` after writing the real route
  files and inspected `.expo/types/router.d.ts` (gitignored, not part of this
  diff) to confirm every screen resolved to exactly one pathname with no
  "routes conflict" error from the bundler.

## Data, API and configuration

None. No schema, auth, or public API changes; no new dependencies (the only
non-source change is the one-line `vitest.config.mts` include addition); no
secrets.

## How to verify

- `npx tsc --noEmit` — passes with no errors, including every new `Link
  href="/..."` against the regenerated typed-routes declaration.
- `npx eslint .` — passes with no errors or warnings.
- `npm test` — 346 tests across 40 files pass, including the three new
  `placeholders.test.tsx` files, `app/index.test.tsx` and
  `app/layouts.test.tsx`.
- `npx expo export --platform android` — bundled 1774 modules with no
  resolution or route-conflict error (run once during this ticket to verify
  the route tree; its `dist/` output was deleted afterward and is not part of
  this diff).
- Manual: `npm start`, open `/` — see the dev switcher, tap "Enter as
  Student" → lands on `/map` with a working tab bar to Wardrobe/Homework/
  Profile, each screen's "Other placeholders" section links back to its
  siblings; repeat for Teacher (`/groups`) and Parent (`/progress`).

## Limitations and follow-ups

- This is a placeholder skeleton: no data fetching, no auth, no real role
  guard. `app/index.tsx`'s dev switcher is explicitly temporary and must be
  removed once WP-2.6 lands a real role-based redirect out of `/` — at that
  point revisit whether `teacher-map`/`teacher-profile`/`parent-map`/
  `parent-profile` can be renamed back to bare `map`/`profile` now that only
  one role group would ever be mounted at a time.
- Teacher's Q&A/Vocabulary/Grammar screens (nested under
  `teacher/groups/[groupId]/topics/[topicId]` upstream) are not represented
  anywhere in this route tree yet — left for the teacher group/topic detail
  work package, which will need real dynamic-param routes rather than flat
  placeholders.
- No tab bar icons; tabs are text-only until the remaining `BottomNav` icons
  (map, wardrobe, profile, homework, dashboard) are ported to
  `src/components/ui/icons`.
- `(auth)` still renders a bare `<Slot />` with no screens — unchanged from
  before this ticket, since the ticket scopes "the three roles" (student,
  teacher, parent) and auth screens are `WP-2.2`'s job.
