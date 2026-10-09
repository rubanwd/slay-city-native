# SCN-63 — Implement WP-2.4 deep link scheme and slaycity://auth/callback handling for email links and OAuth

> Type: feature · Date: 2026-10-09

## Context

WP-2.4 is the deep-linking half of P5 (Auth & session): without it, a
password-reset email or an OAuth redirect opens *something* on the device
(the OS resolves `slaycity://`), but nothing in the app turns that URL into a
session. `app.json` already declared `scheme: "slaycity"` from an earlier
ticket, and `src/lib/supabase.ts` already sets `detectSessionInUrl: false`
(WP-2.1/SCN-60), which means that without a handler, the code/token Supabase
attaches to the redirect URL is simply dropped — the link opens the app to
whatever `/` currently renders, with no session.

This ticket's two upstream dependencies — WP-2.2 (the `(auth)` sign-in /
forgot-password / reset-password screens) and WP-2.6 (the role-based route
guard that `roleHome()` in `packages/core` already encodes) — have not landed.
Neither a real login screen nor a real reset-password form exists yet in
`app/(auth)/`, which is still the empty `_layout.tsx` placeholder from WP-1.x.
Rather than block entirely on that, this ticket builds the real link-parsing
and session-exchange plumbing (fully testable on its own) and routes to the
interim targets the codebase has already established for this exact gap —
`/` as the pre-auth/role-home stand-in (see `app/index.tsx`'s own comment) —
plus a minimal placeholder `reset-password` screen, since no interim
substitute for that one exists. This mirrors the precedent set in SCN-61's
`guardedWrites`: build the real contract ahead of an unmerged dependency,
documented as such, so WP-2.2/WP-2.6 only need to replace placeholders rather
than invent the plumbing too.

## What was done

**URL parsing and redirect construction — `src/lib/authRedirect.ts`.**
`getAuthRedirectUrl()` wraps `Linking.createURL("auth/callback")`, the one
redirect string every future `resetPasswordForEmail`/`signInWithOAuth` call
should pass as `redirectTo`, so it can never drift from what's on the
Supabase allow-list (SCN-62). `parseAuthCallbackUrl(url)` returns a
discriminated union, `AuthCallbackLink`, covering every shape Supabase can
attach to a redirect:
- `{ kind: "code", code, otpType }` — a PKCE `?code=...` (with `type` echoed
  back if present).
- `{ kind: "otp", tokenHash, otpType }` — a `?token_hash=...&type=...` link
  (password recovery, signup confirmation, magic link, etc.).
- `{ kind: "tokens", accessToken, refreshToken, otpType }` — the older
  implicit-grant shape, carried in the URL **fragment**
  (`#access_token=...&refresh_token=...&type=...`), which `Linking.parse`
  does not read — the fragment is parsed separately with `URLSearchParams`.
- `{ kind: "error", error, errorDescription }` — Supabase's own
  `?error=...&error_description=...` (or the fragment equivalent) for an
  expired/invalid link.
- `{ kind: "invalid" }` — anything else, including garbage input or an empty
  string (`Linking.parse` throws on an empty string; that's caught and
  normalised to `invalid` rather than propagating).

`isRecoveryLink(link)` is `true` whenever `otpType === "recovery"`, regardless
of which of the three non-terminal shapes carried it — the one place "is this
a password reset" gets decided.

**The callback screen — `app/(auth)/callback.tsx`.** Resolves
`slaycity://auth/callback`. On mount it reads `Linking.getLinkingURL()`
(not `getInitialURL()` — see Technical decisions) and subscribes to the `url`
event for a second link arriving while the screen stays mounted. Each URL is
parsed once (a `Set` of already-handled URLs guards against double-processing
the same cached value across remounts) and dispatched by `AuthCallbackLink`
kind: `code` → `supabase.auth.exchangeCodeForSession(code)`; `otp` →
`supabase.auth.verifyOtp({ token_hash, type })`; `tokens` →
`supabase.auth.setSession({ access_token, refresh_token })`; `error`/`invalid`
→ shows the error state directly, no Supabase call. On a successful exchange,
`isRecoveryLink` decides the destination: `/(auth)/reset-password` for a
recovery link, `/` otherwise. On any failure (parse-level `error`/`invalid`,
or a Supabase error from the exchange call) the screen renders a "Link
expired" message with the server's `error_description`/`error.message` and a
"Back to login" button that calls `router.replace("/")`.

**Placeholder reset-password screen — `app/(auth)/reset-password.tsx`.**
New route. Reads `useSession()` (SCN-60); if there is no session once loading
settles, it redirects to `/` (this screen only makes sense immediately after
the callback hands it a session). Otherwise it renders a minimal "Choose a
new password" placeholder — explicitly not the real form, which is WP-2.2's
job — just enough to prove the callback → session → screen handoff lands
correctly for AC3.

**`app.json`.** Already had `scheme: "slaycity"` from an earlier ticket
(step 1 of the ticket's own steps); confirmed, not changed. Expo's config
plugin wires this into both `Info.plist` and the Android intent filter
automatically — nothing else was needed for AC1.

## Changes by file

- `src/lib/authRedirect.ts` — new. `getAuthRedirectUrl()`,
  `parseAuthCallbackUrl()`, `isRecoveryLink()`, and the `AuthCallbackLink`
  union, as described above.
- `src/lib/authRedirect.test.ts` — new. 11 tests: a PKCE code, a PKCE code
  with `type=recovery` attached, a recovery `token_hash`, a non-recovery
  `token_hash` (signup), implicit-grant fragment tokens with `type=recovery`,
  a query-string `error`, a fragment `error`, garbage input, an empty string,
  and a bare scheme with no recognised parameters. Mocks `expo-linking`
  entirely (see Technical decisions) with a re-implementation of
  `parse`/`createURL` built on the same `URL`/`URLSearchParams` globals the
  real one uses.
- `app/(auth)/callback.tsx` — new. The deep-link handler screen described
  above.
- `app/(auth)/reset-password.tsx` — new. Placeholder recovery landing screen.

## Technical decisions

- **`Linking.getLinkingURL()`, not the ticket's literally-named
  `Linking.getInitialURL()`, for the cold-start read.** `getInitialURL()`
  only ever reflects the URL that *launched* the process — it can't carry a
  second, warm-start link. The `url` event *does* fire for a warm-start link,
  but by the time `callback.tsx` mounts (expo-router's own linking
  integration has to navigate here first, in response to that same event),
  the event has already fired and a listener registered in this screen's
  `useEffect` would miss it — there would be no reliable way to recover that
  URL at all. `getLinkingURL()` is a synchronous, native-side cache of "the
  most recently received URL" that updates on *both* a cold launch and a warm
  link, closing that gap entirely; `clearInitialURL()`/`getLinkingURL()`'s own
  JSDoc confirms they share one cache. The `url` event is still subscribed to
  for a third link arriving while the screen is already mounted.
- **`Promise.resolve(Linking.getLinkingURL()).then(handleUrl)`, not a direct
  call, in the effect.** `getLinkingURL()` is synchronous, but calling
  `handleUrl` (which can call `setErrorMessage` before its first `await`)
  directly in the effect body trips `eslint-plugin-react-hooks`'s
  `set-state-in-effect` rule. Deferring by one microtask is a one-line fix
  that keeps the synchronous, race-free read.
- **Mocking `expo-linking` in the unit test rather than loading the real
  module.** `expo-linking` transitively imports `react-native`, which is
  Flow-typed source the `packages` (Node) vitest project's bundler cannot
  parse — confirmed by trying the unmocked import first (`Flow is not
  supported` from Rolldown). The mock reimplements `parse`/`createURL` with
  plain `URL`/`URLSearchParams`, which is also exactly what the real
  implementation does internally — not a behavioural approximation.
- **Routing non-recovery success and the error state's "back to login" both
  to `/`, and recovery success to a new placeholder screen, instead of
  blocking on WP-2.2/WP-2.6.** `/` is not an invented target — it is already
  the documented stand-in for both "pre-auth entry point" and "role home"
  (`app/index.tsx`'s own comment: *"Real role-based redirects arrive with the
  auth milestone (WP-2.6); until then this is how `/` is reached"*). No such
  stand-in exists for the recovery destination, so a minimal placeholder
  screen was added — intentionally inert beyond proving the handoff, so
  WP-2.2 replaces its body rather than its plumbing.
- **A regenerated `.expo/types/router.d.ts` is not required for either new
  route to type-check.** That file is gitignored, per-machine, and
  CI's `type-check` job never generates it (confirmed: deleting the stale
  locally-generated copy and re-running `tsc --noEmit` still passes) —
  expo-router's typed-routes `Href` type falls back to a permissive `string`
  when no generated override module is present, which is the actual
  environment CI type-checks against.

## Data, API and configuration

None. No new dependencies (`expo-linking` was already in `package.json`), no
schema or RPC changes, no env vars. `app.json`'s `scheme: "slaycity"` was
already present from an earlier ticket.

## How to verify

- `npm run type-check` — passes.
- `npm run lint` — passes.
- `npm test` — 369/369 tests pass across both vitest projects, including the
  11 new tests in `src/lib/authRedirect.test.ts`.
- Not verified on-device in this change (no physical device/simulator in this
  environment): AC4 (a cold-start deep link works) and the "password-reset
  email lands on the reset-password screen with a valid session" criterion
  both follow directly from `getLinkingURL()` covering the launch URL and
  `verifyOtp`/`setSession` producing a real Supabase session before the
  `router.replace` call, but should be exercised against the live Supabase
  project (SCN-62's allow-list) on a real device before this is considered
  fully closed.

## Limitations and follow-ups

- `app/(auth)/reset-password.tsx` is a placeholder with no password form —
  WP-2.2 replaces its body. Until then, a user who reaches it cannot actually
  change their password from the device.
- Non-recovery success and "back to login" both resolve to `/`, which is
  still the WP-1.5 dev `RoleSwitcher`, not a real login screen or a
  role-routed home — both follow from WP-2.2 (sign-in screen) and WP-2.6
  (role guard) landing, neither of which this ticket could build without
  redoing their scope.
- `getAuthRedirectUrl()` is written but not yet called by anything —
  WP-2.2's `resetPasswordForEmail`/`signInWithOAuth`/`signInWithOtp` call
  sites are its first intended consumers.
- No test exercises `callback.tsx` itself (only the pure
  `parseAuthCallbackUrl`/`isRecoveryLink` helpers it depends on) — the ticket
  only asked for parsing-helper tests, and the screen's own logic is a thin,
  mostly-conditional dispatch over those already-tested helpers plus
  `supabase.auth.*` calls that would need to be mocked end to end to add much
  signal.
