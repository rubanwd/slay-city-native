# OD-2 decision — Sign in with Apple

> `SCN-10-1` · decision only, **no code is implemented by this document**.
> Read against `rubanwd/slay-city` @ `7612da5` (2026-09-19), same baseline as
> [EDGE-FUNCTIONS-PLAN.md](EDGE-FUNCTIONS-PLAN.md).
> Recorded in [ARCHITECTURE.md](ARCHITECTURE.md) §7, [CONCEPT.md](CONCEPT.md)
> §10, [ROADMAP.md](ROADMAP.md), [WORK-PACKAGES.md](WORK-PACKAGES.md) and
> [RISKS.md](RISKS.md) `R2`. Implemented by `WP-2.5`.

---

## 1. OD-2 — **APPROVED**

| | |
| --- | --- |
| **Decision** | Implement Sign in with Apple on the native app, wherever Sign in with Google exists. Option **(a)** from `ARCHITECTURE.md` §7 / `CONCEPT.md` §10. |
| **Status** | **APPROVED** — 2026-09-30 |
| **Rationale** | App Store Review Guideline 4.8 makes this a hard requirement for any iOS app that offers a third-party social login, not a stylistic choice. |
| **Rejected alternative** | (b) Hide Google on iOS, email/password only there. Rejected because an account created with Google on the web — which is `signInWithGoogle`, already live in `src/features/auth/actions.ts` — could then never sign in from an iPhone. That trades one App Store risk for a support/retention problem the web app does not have today. |
| **Blocks released** | `M2`, `M7` |

## 2. Why this is not optional

Apple App Store Review Guideline 4.8, *Login Services*:

> Apps that use a third-party or social login service (such as Facebook Login,
> Google Sign-In, Sign in with Twitter, Sign In with LinkedIn, Login with
> Amazon, or WeChat Login) to set up or authenticate the user's primary
> account with the app must also offer Sign in with Apple as an equivalent
> option.

SLAY CITY's web app already implements `signInWithGoogle`, and that same
Google button is what the native app ports (`WP-2.5`, deps `WP-2.4, OD-2` per
`WORK-PACKAGES.md`). The moment that button exists in a binary submitted to
Apple's App Store, Guideline 4.8 attaches to it. This is enforced at review,
not at compile time — Apple's reviewers sign in with the app and reject on the
spot if Google is offered and Apple is not. It is one of the most common
first-submission rejections for apps with social login, which is why
`RISKS.md` `R2` carries it at 🟠 high rather than as a nice-to-have.

There is no partial compliance: Sign in with Apple must be "equivalent" —
requiring no more personal information than the other options, and (per
Apple's design requirements, not repeated here) shown no less prominently than
Google. `WORK-PACKAGES.md`'s `WP-2.5` `AC3` already states this: *"If OD-2(a):
Sign in with Apple works and is presented no less prominently than Google."*
This decision resolves the "if" — `AC3` is now unconditional.

## 3. The screens that need both options

The web app does **not** have one auth screen per role. `src/features/auth/AuthForm.tsx`
is a single shared component that backs exactly two routes —
`app/auth/login/page.tsx` and `app/auth/register/page.tsx` — and the Google
button (`GoogleButton`, wired to `googleFormAction`) renders in both modes,
regardless of which role eventually signs in. `MIGRATION-MAP.md` §3 ports both
routes as `app/(auth)/…` in this repository. Those two screens are therefore
where Sign in with Apple has to be added — and, because every role authenticates
through them, adding it there covers all three:

| Role | How it reaches `AuthForm` | Screen(s) affected |
| --- | --- | --- |
| **Student** | Self-registers on the **register** screen. `SignupRole` in `src/features/auth/actions.ts` is `"student" \| "parent"`; student is the default when no role is picked. After first sign-in, a profile-less user is routed to `app/onboarding.tsx` (`OnboardingForm` — username, age, level) to finish setup, then lands on the map. | register, login (returning sessions) |
| **Teacher** | Not a self-service role. `upstream/AGENTS.md`: *"The `teacher` role was added after the original MVP and is promotion-only (an admin flips an existing account's role via `promote_teacher()`)."* A future teacher therefore **registers exactly like a student**, on the same register screen, and is promoted server-side afterward. From then on they use the **login** screen like anyone else; `roleHome()` sends a `profiles.role = 'teacher'` account straight to `/teacher` with no separate teacher-only onboarding form to port. | register (as a student, before promotion), login |
| **Parent** | Self-registers on the **register** screen with `role = "parent"` and an optional `student_email`. `ensureRoleProfile()` auto-provisions the `profiles` row (and a zeroed `user_stats` row) on first sign-in — there is no separate parent onboarding form either, only `ParentDashboard`'s student-linking UI, which is unrelated to authentication. | register, login |

**Net result: two screens, not three** — `app/(auth)/login.tsx` and
`app/(auth)/register.tsx` (`WP-2.2`) — because student, teacher and parent
accounts all authenticate through the same shared form; only the register
screen's role picker and the post-auth landing route (`roleHome()`) differ.
Sign in with Apple added to those two screens satisfies Guideline 4.8 for
every role this app ships, including the app's own onboarding step
(`app/onboarding.tsx`) — which needs no button of its own, since it contains
no authentication action and runs only after a session already exists.

## 4. Why the web app is exempt

Guideline 4.8 is an **App Store Review** guideline — it binds apps
distributed through Apple's App Store, not the web. SLAY CITY's web app is a
desktop/browser product delivered over the open web (Vercel), never packaged
as an iOS or Android binary and never submitted for App Store or Play Store
review. It offers `signInWithGoogle` today with no Apple equivalent and is in
full compliance, because the guideline does not apply to it. No change is
proposed to the web app or to its `AuthForm.tsx`; `signInWithGoogle` there is
unaffected.

This is also why the web repository's root `AGENTS.md` lists *"Apple OAuth"*
under **Do Not Build Yet** (`upstream/AGENTS.md:419`) without contradiction:
that line is scoped to the web MVP, where Apple sign-in genuinely is unneeded
scope. It is a product-scope choice for one product, not a security invariant
like the OpenRouter key rule `OD-1` overrode — so, unlike `OD-1`, approving
`OD-2` requires no pull request against `rubanwd/slay-city`. The override is
recorded in **this** repository's own `AGENTS.md` only, next to the existing
`OD-1` override note.

## 5. What this blocks

| Blocks | Why |
| --- | --- |
| **`M2` — Auth & session** | `ROADMAP.md`'s dependency graph: *"OD-2 answered ─── needed by M2."* `WP-2.5` (social sign-in) lists `OD-2` as a dependency and cannot be scoped — client library, entitlement, credential flow — until the decision is made. It is now unblocked. |
| **`M7` — Store readiness** | An iOS submission with Google sign-in and no Apple equivalent fails App Store review on Guideline 4.8. `WP-7.2` (EAS Build and Submit) cannot produce a submittable build without `WP-2.5` having shipped Apple sign-in first. |

`ROADMAP.md`'s dependency graph line becomes:

```
OD-2 answered ─────────── needed by M2   (OD-1 answered 2026-09-29 ✅, OD-2 answered 2026-09-30 ✅)
```

## 6. What this document does not cover

- **Implementation.** `expo-apple-authentication`, the `identityToken` →
  Supabase `signInWithIdToken({ provider: "apple" })` exchange, the nonce and
  button-styling requirements, and updating `WP-2.5`'s acceptance criteria
  from conditional to unconditional are all `WP-2.5`'s work, not this item's.
- **Android.** Guideline 4.8 is an Apple requirement; the Google Play
  equivalent (no forced parity) does not apply here, so Android keeps
  Google-only sign-in with no compliance gap.
- **Apple Developer Program enrollment and the `Sign In with Apple`
  capability/entitlement.** Provisioning is `WP-7.1`'s Apple developer account
  setup, already scheduled to start in week 1 per `ROADMAP.md`.
