# SCN-64 — Port WP-2.2 login, register, forgot-password and reset-password screens from upstream

> Type: feature · Date: 2026-10-09

## Context

WP-2.2 is the user-facing half of P5 (Auth & session): SCN-60 (WP-2.1) wired
up the Supabase client, `SessionProvider`/`useSession`, and the AppState
auto-refresh listener, and SCN-63 (WP-2.4) built the `slaycity://auth/callback`
deep-link handler and a placeholder `app/(auth)/reset-password.tsx` — but
until this ticket, `app/(auth)/_layout.tsx` had no actual sign-in UI. A user
had no way to create an account or log in on the device at all; `/` only ever
reached the WP-1.5 dev `RoleSwitcher`.

This is a port, not a redesign: the goal was to reproduce the web app's four
auth screens (`src/app/auth/{login,register,forgot-password,reset-password}/
page.tsx` and `src/features/auth/{AuthForm,ForgotPasswordForm,
ResetPasswordForm,actions}.ts` upstream) with the same copy, the same
validation, and the same Supabase calls, built from this repo's existing
design-system primitives.

## What was done

**Validation and Supabase calls — `src/features/auth/actions.ts`.** A
client-side counterpart to upstream's `"use server"` actions file, kept at
the same name and with the same function names (`signIn`, `signUp`,
`requestPasswordReset`, `updatePassword`, and the `*FormAction` wrappers that
validate before calling them) so the two files diff side by side. Each
`*FormAction` returns an `AuthState` (`{ error? } | { message? } | {}`) with
error and message copy copied verbatim from upstream:
- `loginFormAction` — "Enter your email and password." then
  `supabase.auth.signInWithPassword`.
- `registerFormAction` — the same "enter email/password", "Password must be
  at least 6 characters.", "Passwords do not match." checks, plus, for the
  `parent` role, "Enter your student's email to link their account.", "Enter
  a valid student email address." (same loose `EMAIL_PATTERN` regex) and "The
  student email must be different from your own." On success it calls
  `signUp`, which calls `supabase.auth.signUp` with `emailRedirectTo:
  getAuthRedirectUrl()` and `data: { role, student_email? }` in the user
  metadata — the exact shape upstream writes. There is no `teacher` option;
  `SignupRole` is `"student" | "parent"` only, matching the ticket's note that
  teacher accounts are promotion-only.
- `forgotPasswordFormAction` — "Enter your email." then
  `supabase.auth.resetPasswordForEmail(email, { redirectTo:
  getAuthRedirectUrl() })`, returning the same account-enumeration-safe
  message regardless of whether the email exists.
- `resetPasswordFormAction` — the same length/match checks as register, then
  `supabase.auth.updateUser({ password })`.

**Screens — `src/features/auth/{AuthForm,ForgotPasswordForm,
ResetPasswordForm}.tsx`.** Each wraps its content in
`KeyboardAvoidingView` (`behavior="padding"` on iOS, `"height"` on Android)
around `AppContainer` and a plain `ScrollView`
(`keyboardShouldPersistTaps="handled"`, `contentContainerStyle={{flexGrow:1,
justifyContent:"center"}}`) so the active field is never covered (AC3) and the
form still centers on a screen with no keyboard up. Built entirely from
existing primitives — `SlayInput` (email/password/confirm-password/student's
email fields, with `secureTextEntry`, `autoCapitalize="none"`,
`autoCorrect={false}` and the matching `autoComplete`/`textContentType`
values for AC4), `SlayButton` (`variant="pink" size="lg"`, `loading={pending}`
while the call is in flight), `SlayPressable` (the register screen's
Student/Parent role toggle, `accessibilityRole="radio"`), and `SlayText` for
every label, error (`accessibilityRole="alert"`, neon-pink) and success
message (lime-green). The h1 title reproduces the web's two-tone heading
("Log **In**", "Sign **Up**", "Reset **Password**", "New **Password**") with
the accent word in a nested `<Text color={colors.neonPink}>`.

`AuthForm` takes a `mode: "login" | "register"` prop and renders both screens
from one component, exactly mirroring upstream's `AuthForm.tsx`. Selecting
"Parent" reveals the "Student's Email" field with the same hint copy; "Forgot
password?" only shows in login mode; the switch-account link points at
`/register` (from login) or `/login` (from register). A code comment marks
where WP-2.5 adds the Google/Apple buttons — no divider or disabled button is
rendered for them yet, since there is nothing to divide from.

**Routes — `app/(auth)/{login,register,forgot-password}.tsx`.** New, and
intentionally thin: each is a two-line component that renders the matching
feature component. `app/(auth)/reset-password.tsx` keeps its existing
`useSession()` guard (redirects to `/` if there is no session once loading
settles — unchanged from SCN-63) and now renders `<ResetPasswordForm />`
instead of the static placeholder body.

**Post-success navigation.** On a login/register success with a session, or
a password-reset success, the screen calls `router.replace("/")` — the same
interim "role home" stand-in `app/(auth)/callback.tsx` and `app/index.tsx`
already use ahead of WP-2.6's route guard. This is the one deliberate
divergence from upstream's `resetPasswordFormAction`, which signs the user
out and sends them back to `/auth/login`; the ticket's own step 5 says reset
should "route to the role home" with the session already live, so the
sign-out was dropped.

## Changes by file

- `src/features/auth/actions.ts` — new. `signIn`, `signUp`,
  `requestPasswordReset`, `updatePassword` and their validating
  `*FormAction` wrappers, as described above.
- `src/features/auth/AuthForm.tsx` — new. Shared login/register screen body.
- `src/features/auth/ForgotPasswordForm.tsx` — new.
- `src/features/auth/ResetPasswordForm.tsx` — new.
- `src/features/auth/index.ts` — new barrel, following the existing
  `src/features/*/index.ts` pattern.
- `app/(auth)/login.tsx` — new thin route.
- `app/(auth)/register.tsx` — new thin route.
- `app/(auth)/forgot-password.tsx` — new thin route.
- `app/(auth)/reset-password.tsx` — modified. Replaced the WP-2.2 placeholder
  body (a static "Choose a new password" message) with `<ResetPasswordForm
  />`; the session-redirect guard above it is unchanged.
- `app/(auth)/_layout.tsx` — modified. Updated the stale doc comment that
  said WP-2.2 "adds the sign-in / sign-up / forgot-password screens here" —
  it now does.
- `src/features/auth/actions.test.tsx` — new. 18 tests covering every
  validation branch and error/message copy of the four `*FormAction`s against
  a mocked `supabase.auth`, including the exact `signUp` metadata payload for
  both the student and parent roles.
- `src/features/auth/AuthForm.test.tsx` — new. 7 tests: login/register copy
  and field visibility, the role toggle revealing/hiding the student's-email
  field, error/message rendering, and that a success routes to `/` while an
  error or a confirm-email message does not.
- `src/features/auth/ForgotPasswordForm.test.tsx` — new. 3 tests.
- `src/features/auth/ResetPasswordForm.test.tsx` — new. 3 tests, including
  that a successful reset routes to `/` and a failure does not.

## Technical decisions

- **Plain `useState` instead of `useActionState`/`useFormStatus`.** Those are
  React DOM/Next.js-specific (`react-dom`'s `useFormStatus` reads a
  `<form>`'s pending state); there is no `<form>` element on native. The
  `*FormAction` functions keep upstream's exact signatures-minus-`FormData`
  so the validation/error logic itself stays diffable, while the screen
  components own `pending`/`error`/`message` as local state.
- **A plain `ScrollView` inside `AppContainer`, not the `ScrollScreen`
  primitive.** `ScrollScreen` (design/SCN-56 §3.1) exists for tab-bar screens
  that need bottom-tab clearance and an optional pinned footer; none of that
  applies to a standalone, centered auth form, and composing `AppContainer`
  inside it would collapse `AppContainer`'s `flex: 1` to zero height inside
  the `ScrollView`'s non-flex content container. `AppContainer` is the
  outermost element instead, with the `ScrollView` as its (flex) child.
- **No visible "or" divider or disabled OAuth button for the WP-2.5 slot.**
  Upstream always renders the Google button; rendering just the divider with
  nothing under it would look broken. A code comment marks the insertion
  point instead, per the project's "no half-finished UI" rule.
- **`router.replace("/")` on every success, not a role-aware destination.**
  Upstream's `resolveHomePath()` queries the `profiles` table and calls
  `claim_admin`/`ensureRoleProfile` — none of that data-access layer exists
  natively yet (WP-2.6, blocked on WP-2.1 only, is still open), and building
  a one-off role lookup here would duplicate work that ticket owns. `/` is
  the documented interim target two other files already use for exactly this
  gap; swapping it for `roleHome()` from `@slay/core` is WP-2.6's job.
- **`resetPasswordFormAction`/`updatePassword` do not sign the user out.**
  Upstream's version does, then redirects to `/auth/login` so the user logs
  in again with the new password. The ticket explicitly asks for "route to
  the role home" instead, which only makes sense with the session still live
  — so the `signOut()` call was dropped rather than ported faithfully.
- **Tests live alongside the screens as `.test.tsx`, not `.test.ts`.**
  `vitest.config.mts`'s `components` project only collects `src/**/*.test.tsx`
  (and `app/**/*.test.tsx`); `src/lib/**/*.test.ts` is the only `.test.ts`
  glob under `src/`, reserved for files directly under `src/lib`. `actions.ts`
  lives under `src/features/auth/` to stay next to the screens it serves (and
  to mirror upstream's file layout), so its test uses the `.test.tsx`
  extension purely to match the existing glob — same precedent as
  `useSession.test.tsx`, which is JSX-free for the same reason.

## Data, API and configuration

None. No new dependencies, no schema or RPC changes, no env vars. Reuses
`getAuthRedirectUrl()` (`src/lib/authRedirect.ts`, SCN-63) and `useSession()`
(SCN-60) unchanged.

## How to verify

- `npm run type-check` — passes.
- `npm run lint` — passes (0 errors, 0 warnings).
- `npm test` — 425/425 tests pass across both vitest projects, including the
  31 new tests under `src/features/auth/`.
- `npm run upstream:check` — 48/48 tracked files still in sync; nothing under
  `packages/core` was touched.
- Not verified on-device in this change (no physical device/simulator in
  this environment): AC1 ("all four flows work against the shared Supabase
  project") needs a real device or simulator against the live project to
  fully close. The component tests mock `supabase.auth` entirely, so they
  verify the request shapes and UI behaviour, not an actual round trip.

## Limitations and follow-ups

- AC1 (live-project verification) is not exercised here — see "How to
  verify".
- The WP-2.5 Google/Apple sign-in slot is a code comment only, on both
  `login` and `register` (via the shared `AuthForm`) — no button, no divider.
- Every successful flow lands on `/`, the WP-1.5 `RoleSwitcher` dev screen,
  not a real role home — that follows from WP-2.6 (route guard) landing, which
  this ticket could not build without taking on that ticket's own scope
  (`profiles` role lookup, `claim_admin`, provisioning).
- Deep-linking a password-reset email into `reset-password` was already
  covered by SCN-63's tests for the callback's URL parsing; this ticket does
  not add new callback-level tests, only the form that screen now renders.
