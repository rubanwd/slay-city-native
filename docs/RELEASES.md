# Releases

How a build of SLAY CITY gets its identity, its numbers and its audience
(`WP-7.2`, `WP-7.3`). Read before running `eas build` for anything but a dev
client.

## Identifiers — never change them

| | Value | Where |
| --- | --- | --- |
| iOS bundle ID | `app.slaycity.mobile` | `app.json` → `ios.bundleIdentifier` |
| Android package | `app.slaycity.mobile` | `app.json` → `android.package` |
| URL scheme | `slaycity` | `app.json` → `scheme` (auth callbacks: `slaycity://auth/callback`) |
| Expo slug | `slay-city` | `app.json` → `slug` |

The store listing, the Apple Sign In service ID, Google OAuth clients and
every installed copy are keyed to the bundle ID and package. Changing either
after the first store submission ships a different app; changing the scheme
breaks the Supabase redirect allow-list.

## Version numbers

Two numbers, owned by different things:

- **Version** — what people see in the store (`1.4.0`). It lives in
  `app.json` → `version` and becomes `CFBundleShortVersionString` and
  Android's `versionName`. Edit it by hand in the release PR:
  - **minor** (`1.4.0` → `1.5.0`) for each store release;
  - **patch** (`1.4.0` → `1.4.1`) for a fix-only release;
  - **major** for a change people must relearn — rare.
- **Build number** — what the stores count (`CFBundleVersion`, Android
  `versionCode`). **EAS owns it**: `eas.json` sets `appVersionSource: "remote"`
  and the `production` profile `autoIncrement`s it on every build. Never put a
  `buildNumber` or `versionCode` in `app.json`; it would be ignored, then
  believed.

Until the first store release the version stays `0.x`.

## Profiles and audiences

| Profile | Who gets it | Distribution | Channel |
| --- | --- | --- | --- |
| `development` | developers — a dev client for `npm start` | internal | — |
| `preview` | testers (teachers, a parent, a student) — Android as an installable APK | internal | `preview` |
| `production` | the App Store and Google Play (Android as an AAB) | store | `production` |

```bash
eas build --profile preview --platform all      # a build testers install directly
eas build --profile production --platform all   # a build for the stores
eas build --profile production --platform android --auto-submit   # build + straight to Play closed testing
eas build --profile production --platform android --auto-submit-with-profile=internal   # build + Play internal testing only
eas submit --profile production --platform ios       # lands in TestFlight
```

Android submissions go to the **closed testing** track (`alpha` in the Play
API) and roll out to its testers once Google has reviewed the release
(`releaseStatus: completed`). Closed testing is the track that counts towards
Google's rule for personal developer accounts: **at least 12 testers opted in
for 14 days in a row** before production access can be requested. Internal
testing does not count. How to run it, and the invitation to send, is in
[`docs/store/closed-testing.md`](store/closed-testing.md).

The `internal` submit profile still exists for a build only the team should
see: internal testing skips Google's review and reaches testers within
minutes. Neither track is public; nothing reaches anyone else until someone
promotes a release in the Play Console (`WP-7.7`, `WP-8.4`).

While the app has never been released on any track, the Play API only
accepts draft releases. That is why the very first AAB goes up by hand
(step 3 below); after that, `--auto-submit` works. The upload uses a Google
service account whose key lives in EAS (`eas credentials`), never in the
repository.

### Channels

`preview` and `production` are EAS Update channels (`expo-updates`, `WP-8.5`).
**Every merge to `main` publishes an over-the-air update to `production`**
(`.github/workflows/ota.yml`, after lint, type-check and tests pass). An
installed build checks on launch, downloads in the background and runs the new
JavaScript on the **next** launch — so a tester closes and reopens the app
twice to see a fix.

`runtimeVersion` uses the `fingerprint` policy: the runtime is a hash of the
native project, so an update is only offered to builds with the same native
code. Nobody has to remember a version bump — a merge that adds an Expo
module or changes native config simply publishes an update no installed build
accepts, and the change reaches testers with the next
`eas build --auto-submit`.

Rule of thumb: screens, styles, logic, copy → just merge. New package with
native code, `app.json` native fields, permissions → merge, then
`eas build --profile production --platform android --auto-submit`.

## Environment

Builds read `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and
`EXPO_PUBLIC_WEB_ORIGIN` (see `.env.example`). `.env` is not uploaded to EAS;
set them per environment with `eas env:create` (`preview` and `production`).
They are public by design (the anon key is guarded by RLS) — no secret ever
goes behind `EXPO_PUBLIC_`. The OpenRouter key never ships: AI drafting runs
in an Edge Function (`OD-1`).

## What the owner does once

These need accounts this repository can't hold.

> **Status 2026-11-24 (Android):** steps 1 and 4 are done — project
> `@rubanwd/slay-city` is linked, the three variables exist for `preview` and
> `production` (Supabase project `rzncmswttzexajbgnjqz`, web origin
> `https://slay-city.vercel.app`), and EAS holds the Android upload keystore.
> Step 3 (Play Console app, first manual AAB upload, service account) is next.
> Apple (step 2) is not started.

1. `eas init` — writes `expo.extra.eas.projectId` (and `owner`) into `app.json`.
2. Apple: an App Store Connect app for `app.slaycity.mobile`, then
   `eas credentials` to let EAS create and store the certificates and
   profiles. Add `ascAppId` (the App Store Connect app ID) and `appleTeamId`
   under `submit.production.ios` in `eas.json`.
3. Google: a Play Console app for `app.slaycity.mobile`, one manual upload of
   the first AAB (Google requires it), then a service-account key for
   `eas submit`, stored with `eas credentials` — never in the repository.
4. `eas env:create` for the three variables above, per environment.

## A release, step by step

1. Branch `release/x.y.z` from `main`; bump `app.json` → `version`.
2. `npm run lint && npm run type-check && npm test && npm run upstream:check`.
3. `eas build --profile production --platform all --auto-submit`.
4. (iOS only, until its submit profile exists) `eas submit --profile production --platform ios`.
5. Smoke-test from TestFlight and the closed testing track: sign in as a student,
   a teacher and a parent; play one mission; open the reward.
6. Promote in the stores; tag `vx.y.z` on the release commit.
