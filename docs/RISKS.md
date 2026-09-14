# Risks and Compliance

Ordered by how much of the project they can cost. Every entry names a mitigation and
the work package that carries it.

## R1 — Teacher writes lose their server-side guard 🔴 critical

Five action files perform 32 direct table writes and rely on `requireTeacher()`
running on a server the user does not control. React Native has no such server. If
these ship as direct client writes and RLS does not already forbid them, any signed-in
student could author homework for any group, or post Q&A messages as a teacher.

**Mitigation:** `WP-2.3` — audit every write, wrap what RLS does not cover in a
`SECURITY DEFINER` RPC that re-checks the role in SQL, and prove it with negative
tests using a student JWT. Do this in M0/M2, not when M5 starts.

**If the audit finds the web app is already exposed** — because RLS was never the
thing stopping these writes — that is a production incident, not a migration finding.
Stop and report it.

## R2 — Sign in with Apple 🟠 high

App Store Review Guideline 4.8 requires an equivalent privacy-preserving login
option whenever an app offers third-party social login. SLAY CITY offers Google
(`signInWithGoogle`). The root `AGENTS.md` lists Apple OAuth under **Do Not Build
Yet**.

This is a hard requirement, not a recommendation, and it is a common cause of first
rejection. The cheap escape is hiding Google on iOS — but then an account created
with Google on the web cannot sign in on an iPhone at all, which is worse.

**Mitigation:** answer `OD-2` before M2. Recommendation: implement it.

## R3 — Kids privacy: COPPA, GDPR-K, and the two families programmes 🟠 high

Onboarding accepts ages from 5. That puts the app squarely inside children's privacy
law in both stores, and both stores enforce it at review.

| | Apple | Google |
| --- | --- | --- |
| Programme | Kids Category (optional) | Designed for Families (mandatory if children are a target audience) |
| Third-party analytics | Prohibited in the Kids Category | Restricted; must be disclosed |
| Parental gate | Required before external links, purchases, or leaving the app | Required for the same |
| Age declaration | Age rating questionnaire | Target-audience and content declaration |

The app already loads Google Analytics through `@next/third-parties`. In an Apple
Kids Category build, that is a rejection.

**Mitigation:** `OD-3` and `OD-4`. Recommendation: stay out of the Kids Category,
rate 4+, and keep analytics — a smaller discovery loss than the compliance burden.
Google's Families requirements apply either way and must be answered honestly.
`WP-7.5`.

## R4 — Shared logic drifts between the two repositories 🟠 high, permanent

`packages/core` is a copy of ~6 000 lines that also live in `rubanwd/slay-city`.
Fix a bug in `missionReward.ts` on the web, forget to copy it here, and the phone
pays different XP for the same mission than the browser does. A child completes a
mission, opens the web app, and the numbers disagree.

This is the cost of not restructuring the live product, and it is permanent rather
than one-off.

**Mitigation:** [SYNC.md](SYNC.md). The web repository is upstream and authoritative;
every tracked file records its upstream path and content hash; CI fails on drift,
nightly and on every pull request. `WP-0.5` implements it and proves it with a test
that deliberately introduces drift.

**Watch the exit signals** in SYNC.md §5 — more than one drift resolution a week
sustained for a month, more than ten adapted files, or any drift bug reaching a user.
Any of them means publishing `packages/core` as a private npm package, which is a
week of work and forecloses nothing.

> Under a monorepo plan this slot held a different risk: a refactor of every import
> path in the live product, taken up front. That risk is now **gone** — the web app
> is not touched. The trade is a one-time outage risk for a permanent maintenance
> cost, and it is the right trade while the app is in production and the port is
> speculative.

## R4b — Two repositories write migrations to one database 🔴 critical if mishandled

Both apps share one Supabase project. If both repositories can apply migrations,
version numbers collide and the schema history becomes unreconstructable.

**Mitigation:** `rubanwd/slay-city` owns `supabase/` and is the only repository that
applies migrations — [CONCEPT.md](CONCEPT.md) §4. This repository contains no
`supabase/` directory at all, which makes the rule structural rather than a matter of
discipline. New RPCs (`WP-2.3`) and Edge Functions (`WP-5.6`) are pull requests
against the web repository.

## R4c — Porting from stale code ✅ designed out

An earlier draft of this plan committed a frozen `reference/web/` snapshot of the web
app into this repository. The web app keeps shipping, so within weeks the snapshot
would be stale and an agent porting a screen from it would faithfully reproduce
behaviour that no longer exists — a bug class that is invisible in review, because
the code looks right.

**Resolved by design rather than mitigated.** There is no committed snapshot.
`upstream/` is fetched on demand (`npm run upstream:fetch`), gitignored, and defaults
to the current upstream head. The same checkout serves the drift check, so one
mechanism covers both porting and R4 — and `UPSTREAM_BASELINE` still pins the seed
commit for when determinism matters.

Left in this list because the reasoning is worth keeping: a snapshot is the obvious
answer, and it is the wrong one.

## R5 — Two front ends, forever 🟡 medium, permanent

After launch, every student-facing feature is built twice. Shared logic is written
once and synced; the screens are not. Expect roughly **1.8× the effort** for new
student-facing work — higher than the 1.6× a monorepo would cost, because the sync
step is manual rather than structural. Admin-only work costs exactly what it costs
now.

**Mitigation:** this is the price of native plus the price of two repositories, not a
defect. Keep the layer rules in [ARCHITECTURE.md](ARCHITECTURE.md) §1 enforced by
lint, so logic cannot leak into a screen and get duplicated. The more that lives in
`packages/core`, the closer the multiplier gets to 1.

## R6 — Store review latency 🟡 medium

Typical first review: 1–3 days on Apple, a few days to two weeks on Google for a new
developer account, longer for anything aimed at children. A rejection resets the
clock. Two to three rounds is normal for a kids' education app.

**Mitigation:** `WP-7.1` starts in week 1. Submit to TestFlight and the Play internal
track early — internal distribution surfaces most metadata problems before the real
review. Budget 2–4 weeks of calendar, and do not promise a launch date that assumes
first-time approval.

## R7 — Map layout does not translate 🟡 medium

`CityMap` positions nodes absolutely against a background image. The web can lean on
viewport units and CSS transforms; React Native cannot, and phone aspect ratios vary
far more than the 390 pt design target suggests.

**Mitigation:** `WP-3.1` — derive positions from measured layout, test at 390 pt,
428 pt, a 20:9 Android and a tablet. The node coordinates are database values shared
with the web, so they must stay proportional, not be re-tuned for one device.

## R8 — Timers and background state 🟡 medium

`SnakeGameTask`, the Tier 2 timed tasks and `StudyTimeTracker` all run intervals.
On the web a backgrounded tab is throttled by the browser. On a phone nothing
throttles them: the app keeps ticking, drains battery, records study time for a
pocket, and desyncs game state.

**Mitigation:** one shared `useAppStateAwareInterval` hook, used by every timer.
`WP-3.4`, `WP-3.6`, `WP-4.5`.

## R9 — OpenRouter key in the bundle 🔴 critical if mishandled

A mobile binary is not a secret store. `OPENROUTER_API_KEY` shipped in an `.ipa` or
`.aab` is extractable in minutes and bills to your account.

**Mitigation:** the key never enters this repository. AI generation goes through Edge
Functions (`OD-1`). `WP-5.6` includes an explicit acceptance check: grep the built
binary for the key and for `openrouter.ai`. The Edge Functions themselves land in the
web repository, which owns `supabase/`.

## R10 — Text input on native 🟢 low, but noticeable

iOS and Android keyboards autocorrect, autocapitalise and suggest spellings by
default. In `SpellingBeeTask` the keyboard will offer the answer.

**Mitigation:** `WP-3.5` — explicit input configuration per task, verified on both
platforms with a real keyboard, not a simulator's hardware keyboard.

## R11 — Emoji rendering 🟢 low

`EmojiText.tsx` uses `@twemoji/api`, which parses DOM nodes and swaps in images.
It cannot run in React Native.

**Mitigation:** use the platform's native emoji font. Accept that emoji will look
different on iOS, Android and the web. If visual consistency matters to the brand,
bundle Twemoji as image assets and map codepoints — a day of work, deferrable.

## R12 — Deep-link allow-list regression 🟢 low, high impact

Adding `slaycity://` to the Supabase redirect allow-list means editing a setting the
live web app depends on. Removing or replacing a web URL breaks password reset in
production silently — the API still returns success, as the root `README.md` already
documents.

**Mitigation:** `WP-2.4` — add, never replace. Verify a web password reset
immediately after the change.

---

## Compliance checklist for M7

- [ ] Privacy policy live, reachable, and specific about what children's data is collected
- [ ] Terms of service live
- [ ] Apple privacy nutrition labels completed against actual behaviour
- [ ] Google Play data-safety form completed against actual behaviour
- [ ] Age rating questionnaires completed on both stores
- [ ] Parental gate implemented if entering the Apple Kids Category
- [ ] Account deletion available in-app — required by both stores where accounts can be created
- [ ] Sign in with Apple, or no third-party login on iOS
- [ ] No third-party analytics if in the Kids Category
- [ ] Google Families policy declarations complete
- [ ] Support URL and contact address live
- [ ] Screenshots for every required device size
