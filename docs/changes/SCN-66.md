# SCN-66 — Implement WP-2.5 Google OAuth via expo-auth-session and Sign in with Apple when OD-2 is yes

> Type: feature · Date: 2026-10-09

## Context

WP-2.5 is the last piece of P5 (Auth & session) that touches sign-in itself:
SCN-64 (WP-2.2) built the password login/register screens and left a code
comment in `AuthForm.tsx` marking where the Google/Apple buttons belong. OD-2
(`docs/OD-2-DECISION.md`) was approved on 2026-09-30 — this app must offer
Sign in with Apple wherever it offers Google, because App Store Review
Guideline 4.8 makes that a hard requirement once a third-party social login
exists, not a stylistic choice. Until this ticket there was no social sign-in
at all on native, even though the web app has had Google OAuth for a while
(`src/features/auth/actions.ts` upstream, `signInWithGoogle`).

## What was done

**Google — `src/features/auth/oauth.ts`, `signInWithGoogle()`.** Calls
`supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo:
getAuthRedirectUrl(), skipBrowserRedirect: true } })` to get the provider's
consent URL without Supabase trying a DOM redirect, then opens it with
`WebBrowser.openAuthSessionAsync(url, redirectTo)`. That call's own promise
resolves directly with the final `slaycity://auth/callback` redirect, which
is parsed with the existing `parseAuthCallbackUrl()`
(`src/lib/authRedirect.ts`, from WP-2.4). The shared Supabase client sets no
`flowType`, so auth-js defaults to **implicit** — the redirect carries
`access_token`/`refresh_token` in the URL **fragment** (`parseAuthCallbackUrl`'s
`kind: "tokens"`), handled with `supabase.auth.setSession()`, the same call
`app/(auth)/callback.tsx` already makes for email links under the same flow.
A `kind: "code"` is also handled (`exchangeCodeForSession`), defensively, in
case the project's flow is ever switched to PKCE — but it is not the shape
this client actually produces today. No detour through
`app/(auth)/callback.tsx` itself: that screen stays dedicated to links opened
from outside the app (password-reset email). A `cancel`/`dismiss` result from
`WebBrowser` returns `{ cancelled: true }` and nothing else happens (AC2); any
other failure returns `{ error }`.

**Apple — `src/features/auth/oauth.ts`, `signInWithApple()`.** Generates a
32-byte raw nonce (`expo-crypto`'s `getRandomBytesAsync`, hex-encoded), gets
its SHA-256 (`digestStringAsync`), and passes the hash to
`AppleAuthentication.signInAsync({ nonce, requestedScopes: [FULL_NAME, EMAIL]
})`. The resulting `identityToken` and the **raw** (pre-hash) nonce go to
`supabase.auth.signInWithIdToken({ provider: "apple", token, nonce })` — GoTrue
re-hashes the raw value server-side to confirm it matches the one signed
inside Apple's token, so only the raw value is forwarded to Supabase.
Cancelling the system sheet throws an error with `code ===
"ERR_REQUEST_CANCELED"`, caught and turned into `{ cancelled: true }`; any
other thrown error becomes a generic `{ error }`.

`expo-crypto` is imported lazily inside `signInWithApple()` — see "Technical
decisions" below for why.

**UI — `src/features/auth/OAuthButtons.tsx`.** Renders the "or" divider and
the Google button (always) in the WP-2.5 slot, plus Apple's own
`AppleAuthenticationButton` (official component, `CONTINUE`/`WHITE` style)
only when `Platform.OS === "ios"` **and** `APPLE_SIGN_IN_ENABLED` is on — so
Apple never appears without Google per OD-2/Guideline 4.8, and the build
stays shippable before the flag is flipped. It tracks which provider is
mid-flight (`pending: "google" | "apple" | null`) to show a spinner on the
Google button and disable both while either is running or the password form
is submitting. Results bubble up through two callbacks — `onStart` (clears
any existing error/message) and `onResult` (an `OAuthState`, i.e. `AuthState &
{ cancelled? }`) — rather than owning navigation itself.

**Wiring — `src/features/auth/AuthForm.tsx`.** Replaced the WP-2.5 comment
with `<OAuthButtons googleLabel={copy.google} disabled={pending}
onStart={handleOAuthStart} onResult={applyResult} />`. `applyResult` is the
same function the password submit path already used, now also handling
`cancelled` first — a cancelled OAuth attempt returns to the form exactly as
it was, no toast, no navigation, whereas an empty non-cancelled result (a
real sign-in success) still does `router.replace("/")`, the same interim
"role home" stand-in used everywhere else pending WP-2.6. `COPY.login.google`
/ `COPY.register.google` ("Continue with Google" / "Sign up with Google")
match upstream's per-mode copy exactly.

**Google icon — `src/components/ui/icons/GoogleIcon.tsx`.** The four-colour
"G" mark ported 1:1 from upstream's inline SVG in `AuthForm.tsx`, as a
`react-native-svg` component following the existing `CoinIcon`/`XpIcon`
pattern (fixed palette, `color` prop accepted but unused, same as `CoinIcon`).
Exported from `src/components/ui/icons/index.ts` and the `src/components/ui`
barrel.

**Feature flag — `src/lib/featureFlags.ts`.** `APPLE_SIGN_IN_ENABLED =
process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === "true"`, off by default
(`.env.example` documents it, defaulted to `false`). This is the first
feature flag in the codebase; it follows the one existing config convention
(`EXPO_PUBLIC_*` vars read via `process.env`, documented in
`src/lib/supabase.ts`) rather than introducing a new mechanism.

**Native config — `app.json`.** Added `expo-web-browser` (auto-added by
`npx expo install`) and `expo-apple-authentication` to the `plugins` array —
the latter ships its own config plugin (`app.plugin.js`) that adds the "Sign
in with Apple" capability/entitlement on iOS, and `expo install` does not
add it to `plugins` automatically the way it did for `expo-web-browser`.

**No role can be self-assigned via OAuth.** Neither `signInWithOAuth` nor
`signInWithIdToken` is given any `data`/role metadata, so a brand-new Google
or Apple account carries no role flag at all — the same state upstream's
comment describes for web Google signups ("Google users carry no role flag,
so they land on `/map` and middleware forwards first-timers into
onboarding — the same as a student signup"). There is no `teacher` (or
`admin`) option anywhere in this flow, matching `SignupRole` in both
`actions.ts` and upstream. This needed no new code — only confirming that
neither call sets a role, which the code review (and `oauth.test.tsx`'s
assertions on exactly what's sent to Supabase) makes explicit.

## Changes by file

- `src/features/auth/oauth.ts` — new. `signInWithGoogle()`, `signInWithApple()`,
  the shared `OAuthState` type, and the nonce-generation/cancellation helpers
  described above.
- `src/features/auth/OAuthButtons.tsx` — new. The divider + Google button +
  conditional Apple button component wired into `AuthForm`.
- `src/features/auth/AuthForm.tsx` — modified. Added the `google` copy key per
  mode, replaced the WP-2.5 slot comment with `<OAuthButtons />`, and
  refactored the password-submit success/error handling into a shared
  `applyResult` so both the password form and the OAuth buttons go through the
  same cancelled/error/message/navigate logic.
- `src/lib/featureFlags.ts` — new. `APPLE_SIGN_IN_ENABLED`.
- `src/components/ui/icons/GoogleIcon.tsx` — new. The Google "G" mark.
- `src/components/ui/icons/index.ts` — modified. Exported `GoogleIcon`.
- `src/components/ui/index.ts` — modified. Re-exported `GoogleIcon` from the
  `ui` barrel.
- `app.json` — modified. Added `expo-web-browser` and
  `expo-apple-authentication` to `plugins`.
- `package.json` / `package-lock.json` — modified. Added `expo-web-browser`,
  `expo-apple-authentication` and `expo-crypto` (via `npx expo install`, so
  versions match this project's Expo SDK 57).
- `.env.example` — modified. Documented `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED`
  (defaulted to `false`).
- `src/features/auth/oauth.test.tsx` — new/modified. 11 tests covering
  `signInWithGoogle` (start-up error, silent cancel, setting the session from
  the redirect's **fragment tokens** — the shape the shared client's implicit
  flow actually returns — a defensive `code`-exchange fallback, and a
  provider-error redirect) and `signInWithApple` (silent cancel, generic
  error, the raw-nonce-vs-hashed-nonce split sent to Apple vs. Supabase, and
  the missing-identity-token case).
- `src/features/auth/AuthForm.test.tsx` — modified. Replaced the
  `vi.mock("~/lib/supabase", ...)` stub with `vi.mock("./oauth", ...)` (the
  correct boundary — `AuthForm` only needs to know what `signInWithGoogle`/
  `signInWithApple` return, not how), added two assertions that the per-mode
  Google button renders, and three new tests exercising `applyResult`'s
  cancel/error/success handling through the real `OAuthButtons` wiring —
  including "cancellation causes no error toast" at the level the toast
  actually lives, not just the `{ cancelled: true }` return value one layer
  below.

## Technical decisions

- **Supabase `signInWithOAuth` + `WebBrowser.openAuthSessionAsync`, not
  `expo-auth-session/providers/google` + native `signInWithIdToken`, for
  Google.** The ticket offered both as acceptable; the native-SDK route needs
  a separate Google Cloud OAuth client ID per platform (iOS, Android, web)
  configured and shipped in this app, on top of the Google provider Supabase
  already has configured server-side for the web app. The hosted-flow route
  needs none of that — it reuses the exact same provider config the web app's
  `signInWithGoogle` already exercises, and only required a browser package
  (`expo-web-browser`) and no new credentials of any kind. It also reuses
  `getAuthRedirectUrl()`/`parseAuthCallbackUrl()` already built for WP-2.4's
  deep links instead of introducing a second redirect-handling path.
- **The session exchange happens inline in `signInWithGoogle()`, not by
  letting the OS deep-link into `app/(auth)/callback.tsx`.** `WebBrowser.
  openAuthSessionAsync`'s own promise already resolves with the final
  redirect URL on success — using that directly is deterministic and
  self-contained, rather than depending on the OS also firing a `Linking`
  `url` event into a screen the in-app browser session may or may not
  navigate to depending on platform.
- **`setSession` from the URL fragment, not switching the client to
  `flowType: "pkce"`.** A review pass caught that `src/lib/supabase.ts` sets
  no `flowType`, so auth-js defaults to implicit — the redirect actually
  comes back as `#access_token=…&refresh_token=…`, never `?code=…`, and the
  original implementation only handled the latter, so a real Google sign-in
  would always fail with a generic error. Switching the client to PKCE was
  the other option on the table, but that also changes the shape of every
  email-link redirect `app/(auth)/callback.tsx` handles (SCN-62/63's
  password-reset flow), which would need its own regression pass and isn't
  this ticket's to take on. Handling `kind: "tokens"` via `setSession` instead
  mirrors exactly what that screen already does for email links under the
  same (current, implicit) flow, so no other file needed to change.
- **`OAuthState = AuthState & { cancelled?: boolean }`, not reusing bare
  `AuthState`.** `AuthState`'s `{}` means "success, nothing to show" for the
  password form, which has no concept of a user backing out mid-flow. If
  cancellation also returned `{}`, `AuthForm`'s shared result handler would
  have navigated to `/` on a cancelled sign-in exactly as it does on a real
  success — this was caught and fixed during implementation (see `oauth.
  test.tsx`'s "is silent when the user cancels" tests, which assert
  `{ cancelled: true }` specifically, and `AuthForm.tsx`'s `applyResult`
  checking `cancelled` before anything else).
- **`expo-crypto` is imported lazily, inside `signInWithApple()`, not
  statically at the top of `oauth.ts`.** Its `aes` submodule (star-exported
  from the package's own entry point, so merely importing anything from
  `expo-crypto` pulls it in) imports the root `expo` package for
  `registerWebModule` in its web build. Under this project's `components`
  vitest project (`react-native-web` in jsdom, `__DEV__: true`,
  `resolve.extensions` preferring `.web.*` — see
  `component-render-tests-run-on-react-native-web` in project memory) that
  chain reaches `expo/src/winter/runtime.ts` → `expo/src/async-require/
  setup.ts`, which only works inside a real Metro bundle or `jest-expo`'s
  preset and throws `Cannot find module './setupFastRefresh'` otherwise. A
  real iOS build never takes this path — Metro resolves the native
  `ExpoCryptoAES.js`, which has no such import — so this was purely a test
  artifact of eagerly loading `expo-crypto` every time `AuthForm`/
  `OAuthButtons` is rendered, including on Android and web where Apple sign-in
  never shows. Deferring the import to only when `signInWithApple()` actually
  runs fixed `AuthForm.test.tsx` without touching the shared
  `scripts/test/setup-components.ts` mocks, and has the side benefit of never
  loading Apple-only crypto code on a platform that can't use it.
- **No new `packages/data` auth wrapper.** `src/features/auth/actions.ts`
  (WP-2.2) already calls `supabase.auth.*` directly from `src/`, rather than
  through `@slay/data`'s "inject the client" pattern used by `mission.ts`/
  `profile.ts` etc. `oauth.ts` follows that same precedent for consistency
  within the auth feature, rather than introducing the first `packages/data`
  auth wrapper as a side effect of this ticket.
- **Spacing and corner radius matched to their neighbours after review.**
  `OAuthButtons`' outer container used `gap: 12` between the divider and the
  Google button; upstream has the submit button, divider and Google button as
  siblings of one `gap-5` (20px) flex column, so the divider→button gap is
  now `gap: 20` to match (the divider's own internal line/label/line row
  keeps its separate, correct `gap: 12`, matching upstream's `gap-3`). The
  Apple button's `cornerRadius` was a raw `12` literal; changed to
  `radii.lg` (16) to match the adjacent `SlayButton size="lg"`'s own corner
  radius and to stop using an un-tokenised number.

## Data, API and configuration

- New dependencies: `expo-web-browser` (~57.0.3), `expo-apple-authentication`
  (~57.0.2), `expo-crypto` (~57.0.3) — all installed via `npx expo install`
  for SDK-57-correct versions.
- New `app.json` plugins: `expo-web-browser`, `expo-apple-authentication`
  (adds the iOS "Sign in with Apple" entitlement).
- New env var: `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED` (`.env.example`, default
  `false`). Flip to `true` once the Apple Developer Program entitlement
  (WP-7.1) is live.
- No schema or RPC changes. No new Supabase provider configuration is needed
  from this repo — Google's provider is assumed already configured
  server-side (the web app uses it today); Apple's provider needs to be
  enabled in the Supabase dashboard before `APPLE_SIGN_IN_ENABLED=true` will
  actually work end-to-end, which is outside this repo's scope (no
  `supabase/` directory here, per `AGENTS.md`).

## How to verify

- `npm run type-check` — passes.
- `npm run lint` — passes (0 errors, 0 warnings).
- `npm test` — 437/437 tests pass across both vitest projects (up from
  425/425 before this ticket), including 11 tests in
  `src/features/auth/oauth.test.tsx` (now asserting against the implicit
  flow's actual fragment-token redirect, not an unreachable `?code=` shape)
  and 5 new assertions/tests in `AuthForm.test.tsx`.
- `npm run upstream:check` — 48/48 tracked files still in sync; nothing under
  `packages/core` was touched.
- Not verified on a device or simulator in this environment (none available
  here): AC1 ("Google sign-in works on iOS and Android dev builds") and the
  Apple-flag-on half of AC2 need a real dev build against the shared Supabase
  project, with Apple's provider enabled server-side, to fully close. The new
  tests mock `supabase.auth`, `expo-web-browser` and `expo-apple-
  authentication` entirely, so they verify the request shapes, the
  cancellation handling, and the raw-vs-hashed nonce split — not an actual
  round trip through either provider.

## Limitations and follow-ups

- AC1/AC3 (live on-device verification for both providers) are not exercised
  here — see "How to verify".
- `APPLE_SIGN_IN_ENABLED` defaults to `false`; turning it on for a real build
  additionally needs the Apple Developer Program "Sign in with Apple"
  capability provisioned (WP-7.1) and Apple's provider enabled in the
  Supabase dashboard — neither is this repo's to do.
- Every successful OAuth sign-in still lands on `/`, the WP-1.5 `RoleSwitcher`
  dev screen, the same interim target every other auth flow uses — WP-2.6's
  role-based route guard is what replaces it everywhere at once, not a
  one-off fix here.
- Supabase's Google OAuth provider is assumed already configured server-side
  (the web app depends on it); this ticket does not touch Supabase project
  configuration.
