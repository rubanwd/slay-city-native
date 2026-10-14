# SCN-67 — Implement WP-2.6 route guard redirecting each role to its home via roleHome() from core

> Type: feature · Date: 2026-10-14

## Context

Until this ticket there was no real post-auth navigation: `app/index.tsx`
renders the WP-1.5 `RoleSwitcher` dev screen, and every auth action
(`AuthForm.tsx`, `ResetPasswordForm.tsx`, Google/Apple sign-in) lands on `/`
afterwards — a stand-in every one of those screens' own comments describes as
temporary, pending WP-2.6. There is also no enforcement at all that a signed-in
user stays inside their own role's route group: a parent could navigate
straight into `(student)/map` and nothing would stop them (server-side RLS is
the real security boundary, per `AGENTS.md`, but the native shell should still
land people in the right place and not let them wander into a UI meant for a
different role). WP-2.6 closes that gap: a single root-level guard reads the
session and the profile's role and redirects to `roleHome()` (`@slay/core`)
whenever the current screen doesn't belong to that role.

## What was done

**The decision itself — `src/features/auth/routeGuard.ts`, `resolveRedirect()`.**
A pure function `resolveRedirect(segments, session, role)` that is the only
place the redirect rule lives:

- `session === undefined` (still loading) → `null` (stay put).
- `session === null` (signed out): `null` if already inside `(auth)`,
  otherwise `"/login"`.
- Signed in, but sitting on `(auth)/callback` or `(auth)/reset-password` →
  `null`. These two are exempt from "signed-in users don't see the auth
  pages" because `callback` is mid code-exchange and `reset-password` is
  reached *because* the recovery link deliberately signs the user in (via a
  temporary session) so they can set a new password — upstream's
  `middleware.ts` makes the exact same exemption, for the exact same reason,
  and without it the guard would bounce a user out of the reset flow before
  they could use it.
- `role === undefined` (signed in, profile role still loading) → `null`.
- Otherwise: call `roleHome(role)` (`@slay/core`) — the one source of the
  role → destination rule (AC1) — and compare the current group
  (`segments[0]`) against the segment that role's web home maps to. A
  mismatch (including `(auth)`, and including the always-empty match for
  `admin`, which has no native group) returns that role's concrete native
  route; a match returns `null`.

`roleHome()` returns upstream's *web* paths (`/map`, `/teacher`, `/parent`,
`/admin`). This app's `(teacher)`/`(parent)` groups name their home tab
`groups`/`progress` rather than `teacher`/`parent`, specifically to avoid a
bare-name collision with the student group's screens (see those groups'
`_layout.tsx` comments, written back in WP-1.5 anticipating this). Two small
lookup tables (`SEGMENT_BY_WEB_HOME`, `NATIVE_ROUTE_BY_WEB_HOME`) bridge that
naming difference back to `roleHome()`'s vocabulary — they translate its
output, they do not re-derive which role goes where.

**Fetching the role — `packages/data/src/profile.ts`, `getMyRole()`.** A new
thin wrapper, `getMyRole(db): Promise<UserRole | null>`, that reads
`profiles.role` for the signed-in user (`db.auth.getUser()` then
`.from("profiles").select("role").eq("id", user.id).maybeSingle()`), mirroring
the same query shape upstream's `resolveHomePath()` uses server-side. Returns
`null` when signed out or when there is no profile row yet — the same case
`roleHome(null)` already falls back to the student home for.

**Caching it — `src/hooks/useMyRole.ts`.** A hook wrapping `useQuery` from
TanStack Query, keyed `["my-role", session.user.id]` and `enabled: !!userId`,
calling `getMyRole(useSupabase())`. Disabled (and so permanently `undefined`)
while signed out, which is fine — the guard never reaches the role check in
that branch anyway.

**Wiring — `app/_layout.tsx`.** `RootLayout` is unchanged for font loading,
but no longer hides the splash screen itself; that decision moved into a new
child component, `RouteGuard`, rendered inside `SessionProvider` (for
`useSession`) in place of the bare `<Stack>`. `RouteGuard` reads
`useSession()`, `useMyRole()`, `useSegments()` and `useRouter()`, computes
`resolveRedirect(segments, sessionLoading ? undefined : session, role)` on
every change, and:

- calls `router.replace(target)` in an effect whenever `target` is non-null;
- hides the splash screen in a second effect once `ready` — `!sessionLoading
  && (session === null || role !== undefined)` — is true, i.e. once there is
  enough information to have already made the redirect decision above. This
  is what satisfies "no auth flash": the native splash overlay is still up
  while the role query is in flight, and by the time it's removed the replace
  has already been issued in the same tick.

It still renders the same `<Stack screenOptions={{ headerShown: false,
contentStyle: { backgroundColor: colors.black } }} />` as before.

**The admin screen — `src/features/admin/AdminWebOnlyScreen.tsx` +
`app/admin.tsx`.** The native app has no admin route group (the admin console
stays web-only, per `AGENTS.md`), so `roleHome("admin")`'s `/admin` is realised
here as a single top-level screen rather than a tab group. It explains that
the console is web-only and has one action: a "Sign out" `SlayButton` (variant
`ghost`) that calls the new `signOut()` and shows a loading spinner while the
call is in flight. After sign-out, `useSession`'s existing `onAuthStateChange`
listener updates the session and `RouteGuard` sends the now-signed-out user to
`/login` on its own — no explicit navigation needed in the button handler.

**Sign-out — `src/features/auth/actions.ts`, `signOut()`.** A one-line
`supabase.auth.signOut()` wrapper, in the same thin-action style as every
other function in this file; re-exported through the existing
`export * from "./actions"` barrel in `src/features/auth/index.ts` with no
barrel change needed.

## Changes by file

- `src/features/auth/routeGuard.ts` — new. `resolveRedirect()`, the exempt-auth-
  screen set, and the two web-home ↔ native-segment lookup tables described
  above. `SIGNED_OUT_ROUTE` exported as `"/login"`.
- `src/features/auth/routeGuard.test.tsx` — new. 11 cases: session loading,
  role loading, signed-out (both outside and inside `(auth)`), signed-in on
  login/register bounced to role home, the `callback`/`reset-password`
  exemption (including before the role query resolves), each of the four
  roles both matching and mismatching its group, and a `null` role falling
  back to the student home. `.tsx` extension (despite no JSX) because the
  vitest `components` project's include glob is `src/**/*.test.tsx` — a
  `.test.ts` file under `src/features/**` matches neither vitest project and
  silently never runs; confirmed by first landing it as `.test.ts` and
  watching `npm test`'s total stay unchanged, then renaming and watching it
  go from 441 to 452.
- `packages/data/src/profile.ts` — modified. Added `getMyRole()`.
- `packages/data/src/profile.test.ts` — modified. 3 new cases: signed-out
  (returns `null`, never queries `profiles`), a role returned from the table,
  and no profile row yet (`null`).
- `src/hooks/useMyRole.ts` — new. The TanStack Query wrapper described above.
- `src/features/admin/AdminWebOnlyScreen.tsx` — new. The "use the web
  console" screen with the sign-out button.
- `app/admin.tsx` — new. `export { default } from "~/features/admin/AdminWebOnlyScreen";`,
  following the same re-export pattern every other route file in `app/` uses
  for its screen component.
- `src/features/auth/actions.ts` — modified. Added `signOut()`.
- `src/features/auth/actions.test.tsx` — modified. Added a `signOut` mock and
  one test asserting it calls `supabase.auth.signOut()`.
- `app/_layout.tsx` — modified. Moved the splash-hide effect and the `<Stack>`
  render into a new `RouteGuard` child component that also runs the redirect
  effect described above; `RootLayout` itself is otherwise unchanged (fonts,
  the `AppState` → `startAutoRefresh`/`stopAutoRefresh` listener).

## Technical decisions

- **A pure `resolveRedirect()` helper, not inline logic in `RouteGuard`.** The
  ticket asked for this explicitly so the four roles plus the loading/signed-
  out states could be unit-tested without mounting Expo Router, `useFonts`,
  or Supabase at all.
- **Two lookup tables to bridge `roleHome()`'s web paths to this app's route
  segments, rather than changing the web paths or renaming the native tab
  files.** `roleHome()` is a byte-identical tracked copy of upstream logic
  (`packages/core/.upstream.json`) and must stay that way; renaming
  `(teacher)/groups.tsx` → `(teacher)/teacher.tsx` would also have reopened
  the bare-name collision with `(student)` those files' own WP-1.5 comments
  describe avoiding. A translation table is the smallest change that keeps
  both constraints — AC1 ("`roleHome()` decides the landing route; the rules
  are not duplicated") is satisfied because the *rule* (which role goes
  where) still comes from `roleHome()` alone; only its string representation
  is re-expressed in this app's own route vocabulary.
- **Replicated upstream's `callback`/`reset-password` exemption rather than
  leaving it to the ticket's literal "redirect to roleHome(role) ... inside
  (auth)" wording.** Without it, a password-reset deep link would authenticate
  the user via a temporary session and then the new guard would immediately
  bounce them to their role home before `ResetPasswordForm` ever rendered —
  a regression against WP-2.2/WP-2.4's already-shipped reset flow. Found by
  reading `upstream/src/middleware.ts`, which carries the same two-path
  exemption with the same reasoning in its own comment.
- **`getMyRole()` returns `null`, not an error, for "no profile row yet."**
  Matches `roleHome(null)`'s existing fallback to the student home, and mirrors
  upstream's `resolveHomePath()`, which treats a profile-less user the same
  way (there `/map`, here the native equivalent) rather than inventing a new
  "unknown role" state.
- **No change to `AuthForm.tsx`, `ResetPasswordForm.tsx`, or the OAuth result
  handling.** All three still `router.replace("/")` on success, same as
  before. That is no longer a dead end: `RouteGuard` now redirects away from
  `/` to the signed-in user's actual role home, so the "the same interim
  'role home' stand-in" every one of those screens' comments already flagged
  as temporary is now implemented without touching the callers that produced
  it.
- **`app/index.tsx` / `RoleSwitcher` left in place, not deleted.** Their own
  comments say this dev screen "must not ship" and is replaced at WP-2.6, and
  functionally it is now unreachable in every real flow — signed-in users are
  always redirected away from `/` (no group ever matches the empty segment
  list) and signed-out users are always redirected to `/login`. Removing the
  screen outright was judged outside this ticket's scope (not in its steps or
  acceptance criteria) and riskier than leaving clearly-superseded, inert code
  in place; see "Limitations and follow-ups".

## Data, API and configuration

None — no schema, RPC, or environment changes. `getMyRole()` reads the
existing `profiles.role` column through the existing anon-key RLS path
(`profiles_select_own`, already relied on by `changeMyUsername()` in the same
file).

## How to verify

- `npm run type-check` — passes.
- `npm run lint` — passes (0 errors, 0 warnings).
- `npm test` — 452/452 tests pass across both vitest projects (up from
  441/441 immediately before the `routeGuard.test.ts` → `.tsx` rename fixed
  it actually being collected; up from 441/441 baseline before this ticket).
- `npm run upstream:check` — 48/48 tracked files still in sync; nothing under
  `packages/core` was touched (`roleHome()` itself is unmodified).
- Manual device/simulator verification was not performed in this environment
  (none available here) — see "Limitations and follow-ups".

## Limitations and follow-ups

- Not exercised on a device or simulator against a real Supabase session: AC1
  ("student, teacher and parent each land on their own home") and AC2
  ("signed-out users cannot reach any role group") are verified here only via
  `resolveRedirect()`'s unit tests and the type/lint/test suite, not an actual
  app launch.
- `app/index.tsx` (`RoleSwitcher`) is now unreachable through normal
  navigation but was not deleted — see "Technical decisions". A follow-up
  ticket could remove it and its test (`app/index.test.tsx`) once there is no
  remaining use for a no-session route-exerciser.
- The guard only decides where to navigate; it does not change what any
  existing placeholder screen renders, and it adds no new RLS or RPC checks —
  per `AGENTS.md`, server-side policy remains the real security boundary, and
  per the ticket's step 4, no guard logic was added to the role groups'
  `_layout.tsx` files beyond what the redirect itself needed (none was).
