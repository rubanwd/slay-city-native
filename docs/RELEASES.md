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
eas submit --profile production --platform android   # lands as a draft on the internal track
eas submit --profile production --platform ios       # lands in TestFlight
```

Android submissions go to the **internal** track as **drafts**: nothing
reaches the public until someone promotes it in the Play Console (`WP-7.7`,
`WP-8.4`).

### Channels

`preview` and `production` are update channels, ready for over-the-air
updates — which need `expo-updates` and are `WP-8.5`'s job. Until then a
channel is only a label on the build. When OTA lands, pair it with
`runtimeVersion: { policy: "appVersion" }`, so an update never reaches a build
whose native code differs: every native change (a new Expo module, a config
plugin) must come with a version bump.

## Environment

Builds read `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and
`EXPO_PUBLIC_WEB_ORIGIN` (see `.env.example`). `.env` is not uploaded to EAS;
set them per environment with `eas env:create` (`preview` and `production`).
They are public by design (the anon key is guarded by RLS) — no secret ever
goes behind `EXPO_PUBLIC_`. The OpenRouter key never ships: AI drafting runs
in an Edge Function (`OD-1`).

## What the owner does once

These need accounts this repository can't hold:

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
3. `eas build --profile production --platform all`.
4. `eas submit --profile production --platform all`.
5. Smoke-test from TestFlight and the internal track: sign in as a student,
   a teacher and a parent; play one mission; open the reward.
6. Promote in the stores; tag `vx.y.z` on the release commit.
