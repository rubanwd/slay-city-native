# Work Packages

Atomic units of work, sized so one agent can complete one in a single session and a
human can verify it without reading the whole diff.

**Format.** Every package carries an ID, its phase, an estimate in engineering days,
its dependencies, and acceptance criteria written as checks that either pass or fail.
`AC` items are binding: a package is not done until every one is demonstrably true.

**Global rules for every package.** Inherited from the root `AGENTS.md`:

- `npm run lint`, `npm run type-check`, `npm run test` pass before commit.
- No XP, coin, streak or unlock logic in client code. Ever.
- No secrets in the diff.
- Brand tokens only — never a raw hex value in a style.
- Mobile-first, dark `#111111` base, one primary action per screen.
- New user-related tables have RLS enabled.

---

# M0 — Foundations

### WP-0.1 · Repository bootstrap and snapshot
`0.5d` · deps: none

Create `slay-city-native`. Expo + TypeScript + Expo Router + NativeWind v4, CI
skeleton, and the `upstream/` reference mechanism.

- `AC1` `npm run upstream:fetch` produces a read-only checkout of
  `rubanwd/slay-city` at `./upstream`, defaulting to current head, with
  `--baseline` resolving the seed commit from `UPSTREAM_BASELINE`.
- `AC2` `upstream/` is gitignored and excluded from `tsconfig.json`, ESLint and the
  test run. An ESLint rule forbids importing from it.
- `AC3` `npx expo start` runs and the smoke screen opens on a physical device,
  rendering brand-token classes through NativeWind and resolving `@slay/tokens`
  through Metro.
- `AC4` **`rubanwd/slay-city` has zero commits from this package.**
- `AC5` `.gitignore` covers `.expo/`, `node_modules/`, EAS build artefacts, signing
  material and `upstream/`.

### WP-0.2 · `packages/core`
`1d` · deps: WP-0.1

Copy every module listed in [MIGRATION-MAP.md](MIGRATION-MAP.md) §1, with its tests,
from a fresh `upstream/` checkout. Write `packages/core/.upstream.json` per [SYNC.md](SYNC.md) §3.

- `AC1` No file under `packages/core` imports `react`, `react-dom`, `react-native`,
  `next/*` or `@supabase/*`. Enforced by an ESLint `no-restricted-imports` rule, not
  by inspection.
- `AC2` All copied tests pass unchanged.
- `AC3` Every file has a manifest entry with its upstream path and content hash.
- `AC4` Files that could not be copied verbatim are marked `adapted: true` with a
  note saying what changed and why. **Target: at most two.**
- `AC5` Test coverage on `packages/core` is no lower than the web app's on the same
  modules.

### WP-0.3 · `packages/data`
`1d` · deps: WP-0.2

Port the `queries.ts` files and the Category A action bodies. Every exported function
takes `db: SupabaseClient<Database>` first.

- `AC1` No module constructs a Supabase client.
- `AC2` No `"use server"`, no `next/cache`, no `next/headers` anywhere in the package.
- `AC3` Each of the 18 Category A RPCs has exactly one wrapper, named as in the web
  app's action so the two remain greppable against each other.
- `AC4` Not tracked in the sync manifest — signatures differ by design. Recorded as
  such in [SYNC.md](SYNC.md) §6.

### WP-0.4 · `packages/tokens`
`0.5d` · deps: WP-0.1

- `AC1` The six locked brand colours are declared once as TypeScript constants, with
  values matching `src/styles/theme.css` exactly.
- `AC2` The full `--fs-*`, `--lh-*`, `--ls-*` scale from `typography.css` is
  represented numerically.
- `AC3` A NativeWind preset consumes them; a brand-token class renders the correct
  colour on both platforms.

### WP-0.5 · Drift contract
`1d` · deps: WP-0.2

- `AC1` `scripts/check-upstream-drift.mjs` exits 0 in sync, 1 on drift, 2 on a
  manifest or path error.
- `AC2` Its drift output names every affected file, its upstream path, and whether it
  is adapted.
- `AC3` A CI job checks out `rubanwd/slay-city` and runs it on every pull request and
  nightly.
- `AC4` Proven by test: change a file in an upstream checkout, confirm CI fails and
  names it.
- `AC5` [SYNC.md](SYNC.md) is committed and linked from the repository README.

# M1 — Mobile shell

### WP-1.1 · Expo scaffold
`1d` · deps: WP-0.4

Expo + TypeScript + Expo Router + NativeWind v4 in this repository, with path aliases
to `@slay/core`, `@slay/data`, `@slay/tokens`.

- `AC1` `npx expo start` runs; the app opens in Expo Go on a physical iOS and a physical Android device.
- `AC2` A NativeWind class using a brand token renders the correct colour on both platforms.
- `AC3` Importing from `@slay/core` inside a screen type-checks and runs.
- `AC4` Metro resolves `packages/*` without symlink errors, and does not walk `upstream/`.

### WP-1.2 · Typography
`0.5d` · deps: WP-1.1

- `AC1` Nunito is bundled as an asset, not fetched at runtime.
- `AC2` Text renders in Nunito before first paint — no flash of system font.
- `AC3` Heading and body components match the web's rendered sizes within 1 pt at default settings.

### WP-1.3 · Design-system primitives
`2d` · deps: WP-1.2

`SlayButton` (all variants and sizes), `SlayCard`, `Section`, `Grid`,
`AppContainer`, `ScrollScreen`, `ProgressBar`, `CurrencyAmount`, `StreakBadge`.

- `AC1` Every variant of the web component exists with the same prop name.
- `AC2` `SlayButton` has a press state and fires `expo-haptics` light impact.
- `AC3` Corner radii are `rounded-2xl` or larger, per `AGENTS.md`.
- `AC4` A side-by-side screenshot against the web app is attached to the PR for each primitive.
- `AC5` Touch targets are at least 44×44 pt.

### WP-1.4 · Icons
`0.5d` · deps: WP-1.1 · `CoinIcon`, `XpIcon`, `ShareIcon` → `react-native-svg`
- `AC1` Each renders at 1×, 2× and 3× without artefacts. `AC2` Colour is driven by a token prop, not hardcoded.

### WP-1.5 · Routing skeleton
`0.5d` · deps: WP-1.1

Route groups `(auth)`, `(student)`, `(teacher)`, `(parent)` with placeholders and
per-role tab layouts.

- `AC1` Every route in [migration map §3](MIGRATION-MAP.md) marked 🔵 has a file.
- `AC2` Tab labels come from `navLabels.ts` in core.
- `AC3` Android hardware back behaves correctly at every level.

### WP-1.6 · App chrome
`0.5d` · deps: WP-1.1
- `AC1` Portrait-locked on both platforms. `AC2` Splash and icon use brand assets from `public/icons/`. `AC3` Base background is `#111111` with no white flash on launch.

---

# M2 — Auth & session

### WP-2.1 · Supabase client
`1d` · deps: WP-1.1

- `AC1` Session tokens are in `expo-secure-store`, never `AsyncStorage` and never plain files.
- `AC2` `detectSessionInUrl: false`.
- `AC3` An `AppState` listener starts and stops auto-refresh on foreground and background.
- `AC4` The session survives a full app kill and relaunch.
- `AC5` Backgrounding for over an hour then foregrounding refreshes the token without a forced sign-out.

### WP-2.2 · Auth screens
`1d` · deps: WP-2.1
- `AC1` Login, register, forgot-password and reset-password all work against the live project. `AC2` Error copy matches the web's. `AC3` Keyboard never covers the active field. `AC4` Password fields use secure entry and no autocorrect.

### WP-2.3 · Teacher/parent RLS audit 🔴
`1.5d` · deps: none — **start in M0, gates all of M5** · **lands as a PR against `rubanwd/slay-city`**

For each of the 32 direct table writes in migration map §2 Category B, determine
whether RLS alone authorises it. Where it does not, add a `SECURITY DEFINER` RPC
that re-checks the caller's role in SQL.

- `AC1` A written table: every write, the table, the policy relied on, verdict `SAFE` or `NEEDS RPC`.
- `AC2` Every `NEEDS RPC` has a migration adding the function, with `search_path` pinned.
- `AC3` A negative test proves a `student`-role JWT cannot perform each teacher-only write — via `as_level`-style direct API calls, not through the UI.
- `AC4` A teacher cannot write to a group they do not own.
- `AC5` The web's behaviour is unchanged; its actions now call the new RPCs. This is a pull request against the live product and is reviewed as one.
- `AC6` No RLS policy was weakened or disabled anywhere in the diff.

> If this package finds an existing hole in the *web* app, stop and report it before
> continuing. It would mean production is currently exposed.

### WP-2.4 · Deep links
`0.5d` · deps: WP-2.2
- `AC1` Scheme `slaycity://` registered on both platforms. `AC2` Supabase redirect allow-list contains the mobile links **and still contains the web ones**. `AC3` A password-reset email opens the app directly at the reset screen. `AC4` A cold-start deep link works, not only a warm one.

### WP-2.5 · Social sign-in
`1d` · deps: WP-2.4, OD-2
- `AC1` Google sign-in completes and produces a valid session. `AC2` Cancelling mid-flow leaves the app in a clean state. `AC3` If OD-2(a): Sign in with Apple works and is presented no less prominently than Google.

### WP-2.6 · Route guard
`0.5d` · deps: WP-2.1
- `AC1` `roleHome()` from core decides the landing route; the rules are not duplicated. `AC2` Each of the four roles reaches its own home and cannot navigate into another's. `AC3` A signed-out deep link into a protected route redirects to login, then returns to the target after signing in.

---

# M3 — Student core loop

### WP-3.1 · City map
`2d` · deps: WP-2.6

- `AC1` Locked, unlocked, current and completed nodes are visually distinct, matching the web.
- `AC2` Node positions come from the database and match the web's layout proportionally at 390 pt, 428 pt and tablet widths.
- `AC3` Pan and zoom are smooth; the map cannot be panned entirely off-screen.
- `AC4` The mascot marker is present and animated.
- `AC5` Tapping an unlocked node opens its mission; a locked node explains why it is locked.

### WP-3.2 · TaskRunner contract 🔒
`1d` · deps: WP-3.1 · **freeze before WP-3.3–3.6 fan out**

- `AC1` The `TaskProps` interface is identical in shape to the web's, so `MissionScreen` orchestration is shared reasoning.
- `AC2` Progress, completion and partial-reward (`rewardFraction`) flow through unchanged.
- `AC3` One reference task is implemented against it end to end.
- `AC4` The interface is documented and marked frozen in the PR description.

### WP-3.3 · Tier 1 tasks — 21 components
`2.5d` · deps: WP-3.2 · **parallelisable**
- `AC1` Each renders correct content from the database. `AC2` Correct and incorrect answers behave as on the web. `AC3` No task holds reward logic — it reports outcomes only. `AC4` Each is exercised on a real device at 390 pt width.

### WP-3.4 · Tier 2 tasks — 6 components
`1d` · deps: WP-3.2
- `AC1` Timers pause when the app backgrounds and resume correctly. `AC2` `FlashcardsTask` flip animation runs on the UI thread via Reanimated. `AC3` `SimonSequenceTask` audio and lights stay in sync.

### WP-3.5 · Tier 3 tasks — 3 components
`0.5d` · deps: WP-3.2
- `AC1` Keyboard never covers the input. `AC2` Autocorrect and spelling suggestions are **off** in `SpellingBeeTask` and `CrosswordTask`. `AC3` Autocapitalisation matches what the exercise expects. `AC4` The return key advances to the next field.

### WP-3.6 · Tier 4 tasks
`1.5d` · deps: WP-3.2

- `AC1` `WordSearchTask`: the grid is sized from measured layout, never viewport units; selection uses the existing pure logic in `wordPuzzle.ts`; partial completion yields the correct `rewardFraction`.
- `AC2` `SnakeGameTask`: the tick loop pauses on background and does not desync on resume; the D-pad is comfortable one-handed; the keyboard handler is removed.
- `AC3` Neither drops below 60 fps on the target low-end device.

### WP-3.7 · Reward
`1.5d` · deps: WP-3.3
- `AC1` `RewardModal` and `RewardScreen` both exist. `AC2` The celebration reads as a celebration — animation, sound, haptics. `AC3` XP and coins shown match what `complete_mission` returned; the client computes nothing. `AC4` Replaying a completed mission grants nothing and says so.

---

# M4 — Student surround

| ID | Package | Est. | Key acceptance criteria |
| --- | --- | --- | --- |
| `WP-4.1` | Homework flows | 2d | Topic list, vocabulary and grammar flows work; word audio plays through `expo-audio`; completion writes via the existing RPCs; unread badges match the web |
| `WP-4.2` | Wardrobe | 1d | Grid scrolls smoothly at 100+ items; purchase and equip go through `purchase_wardrobe_item` / `equip_wardrobe_item`; exactly one item equipped at a time; the mascot updates everywhere it appears |
| `WP-4.3` | Profile & levels | 1d | Knowledge-level picker calls `set_my_knowledge_level`; username validation reuses `username.ts` from core; locked levels explain themselves |
| `WP-4.4` | Onboarding | 0.5d | Age range 5–99 as in the current app; completing it routes via `roleHome()`; it cannot be re-entered once done |
| `WP-4.5` | Study-time tracker | 0.5d | The heartbeat stops on background and resumes on foreground; no time is recorded while backgrounded; `record_study_time` receives plausible values |
| `WP-4.6` | Feedback | 1d | `expo-image-picker` with permission handling and a graceful denial path; uploads reach the same Storage bucket; the image is compressed before upload |
| `WP-4.7` | i18n | 1d | Locale persists in SecureStore; en/uk/ru all render; **mission content and authored content stay English**, per `AGENTS.md`; only the profile screen and tab bar are translated on the student side |

---

# M5 — Teacher & parent consoles

| ID | Package | Est. | Key acceptance criteria |
| --- | --- | --- | --- |
| `WP-5.1` | Teacher dashboard & groups | 1.5d | `my_groups` drives the list; student cards show live progress; a teacher sees only their own groups |
| `WP-5.2` | Homework topic authoring | 1.5d | Create, edit, assign and reuse another topic's content (`topicSources.ts`); all writes go through WP-2.3's audited paths |
| `WP-5.3` | `VocabularyManager` | 2d | The 632-LOC component's full feature set, including per-word images from Storage; images optional, per the existing behaviour; long lists virtualised |
| `WP-5.4` | `GrammarManager` | 1d | Full feature set of the 383-LOC component |
| `WP-5.5` | Q&A messaging | 1d | `get_topic_messages`; unread counts correct; a teacher cannot post as another teacher (negative test) |
| `WP-5.6` | AI drafting | 1d | Edge Functions land upstream in `rubanwd/slay-city`; this repo only calls them.  **no OpenRouter key in the bundle** — verified by grepping the built binary; failures degrade to manual authoring. *Skipped under OD-1(b).* |
| `WP-5.7` | View-as-student | 0.5d | Works without cookies; clearly indicated on screen; cannot be entered by a non-teacher; exiting restores the teacher view |
| `WP-5.8` | `ParentDashboard` | 1.5d | Progress, streaks, study time and homework summary match the web for the same student; readable at 390 pt without horizontal scrolling |
| `WP-5.9` | Parent profile & linking | 1d | `link_student_by_email` works; a parent sees only linked students; the parent console is fully translated, per `AGENTS.md` |

---

# M6 — Polish

| ID | Package | Est. | Key acceptance criteria |
| --- | --- | --- | --- |
| `WP-6.1` | Reanimated animations | 1.5d | All eight keyframes ported, same names; every animation runs on the UI thread; nothing animates `width`/`height` where `transform` works |
| `WP-6.2` | Audio | 1d | `expo-audio` behind the core adapter; respects the silent switch appropriately; no audio while backgrounded; `hiss` and `sfx` behave as on the web |
| `WP-6.3` | Haptics | 0.5d | Reward, correct answer, level unlock and mission complete each have a distinct, tasteful pattern; a global off switch exists |
| `WP-6.4` | Offline | 1.5d | Per OD-5. Under (a): map, profile and wardrobe render from cache with a clear offline indicator, and no mutation is silently lost — writes fail loudly |
| `WP-6.5` | Performance | 1d | 60 fps through map → mission → reward on the target device; cold start under 2 s to interactive; every long list virtualised; images cached by `expo-image` |
| `WP-6.6` | Accessibility | 0.5d | Accessibility labels on all interactive elements; dynamic type does not break layouts; contrast meets AA against `#111111` |
| `WP-6.7` | Resilience | 1d | Error boundaries per route group; crash reporting wired; every screen has empty, loading, error and offline states |

---

# M7 — Store readiness

| ID | Package | Owner | Notes |
| --- | --- | --- | --- |
| `WP-7.1` | Developer accounts | **you** | Apple $99/yr, Google $25 once. **Start week 1** — Apple organisation verification can take weeks. |
| `WP-7.2` | EAS Build & Submit | agent | Production profiles for both platforms; signing credentials managed by EAS; a signed build installs on a physical device |
| `WP-7.3` | Identifiers & versioning | agent | Stable bundle IDs; a documented version/build-number scheme; release channels |
| `WP-7.4` | Legal & privacy | **you** + agent | Privacy policy and terms hosted on the live site; Apple privacy nutrition labels and Google data-safety form completed truthfully against what the app actually collects |
| `WP-7.5` | Kids compliance | **you** + agent | Per OD-3. Parental gate if entering the Kids Category; analytics decision per OD-4; COPPA and GDPR-K posture documented |
| `WP-7.6` | Store listings | **you** + agent | Screenshots at every required size, descriptions, keywords, age rating questionnaires |
| `WP-7.7` | Internal testing | both | TestFlight and Play internal track; at least one real teacher, student and parent installed |

---

# M8 — Beta and launch

`WP-8.1` closed beta · `WP-8.2` fixes · `WP-8.3` submission and review responses ·
`WP-8.4` staged rollout · `WP-8.5` OTA and crash-monitoring workflow.

Expect at least one rejection. Budget for it rather than being surprised by it —
see [05-risks-and-compliance.md](RISKS.md).
