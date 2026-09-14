# Migration Map

Where every part of the current codebase ends up. Four destinations:

| Symbol | Destination | Meaning |
| --- | --- | --- |
| 🟢 | `packages/core` or `packages/data` | Moves as-is or near as-is. Shared by both apps. |
| 🔵 |  this repository | Rewritten as React Native. Logic preserved, JSX replaced. |
| ⚪ | web repository only | Stays in `rubanwd/slay-city`. Not ported. |
| 🔴 | Rewritten differently | The mechanism changes, not just the syntax. |

---

## 1. Pure logic and types → `packages/core` 🟢

Copied with their tests. No React, no platform APIs. These are the modules that make
the estimate survivable — every one is already isolated and unit-tested.

| From | To |
| --- | --- |
| `features/mission/missionReward.ts` + `.test.ts` | `core/mission/reward.ts` |
| `features/mission/snakeGrid.ts` + `.test.ts` | `core/mission/snakeGrid.ts` |
| `features/mission/wordPuzzle.ts` + `.test.ts` | `core/mission/wordPuzzle.ts` |
| `features/mission/taskUtils.ts` | `core/mission/taskUtils.ts` |
| `features/mission/types.ts` + `.test.ts` | `core/mission/types.ts` |
| `features/map/mapState.ts` + `.test.ts` | `core/map/state.ts` |
| `features/map/mapConstants.ts`, `previewMap.ts` | `core/map/` |
| `features/levels/levels.ts` + `.test.ts` | `core/levels/` |
| `features/study/studyTime.ts` + `.test.ts` | `core/study/` |
| `features/profile/username.ts` + `.test.ts` | `core/profile/username.ts` |
| `features/homework/vocabulary.ts`, `grammar.ts` + tests | `core/homework/` |
| `features/parent/homework.ts`, `taskFamilies.ts` + tests | `core/parent/` |
| `features/teacher/topicSources.ts` + `.test.ts`, `viewAs.ts` | `core/teacher/` |
| `features/feedback/feedback.ts` + `.test.ts` | `core/feedback/` |
| `features/auth/roleRouting.ts` | `core/auth/roleRouting.ts` |
| `features/wardrobe/categories.ts`, `mascot.ts` | `core/wardrobe/` |
| `features/demo/demoProgress.ts` + `.test.ts` | `core/demo/` |
| `features/admin/taskTypes.ts`, `taskImageSlots.ts`, `taskImageMeta.ts`, `userRoles.ts` | `core/content/` — shared vocabulary, used by teacher screens too |
| `features/i18n/locales.ts`, `messages.ts`, `messages/*`, `plural.ts`, `navLabels.ts` + tests | `core/i18n/` |
| `types/database.ts` | `core/types/database.ts` |
| `lib/hiss.ts` + `.test.ts` | `core/audio/hiss.ts` — sequencing only, see §6 |

**~6 000 LOC moved without rewriting, tests included.**

## 2. Data access → `packages/data` 🟢

Every function gains a `SupabaseClient` as its first parameter. Behaviour otherwise
unchanged.

| From | To |
| --- | --- |
| `features/homework/queries.ts` | `data/homework.ts` |
| `features/levels/queries.ts` | `data/levels.ts` |
| `features/parent/queries.ts` | `data/parent.ts` |
| `features/teacher/queries.ts` | `data/teacher.ts` |
| `features/study/queries.ts` | `data/study.ts` |
| `features/feedback/queries.ts` | `data/feedback.ts` |
| `features/demo/queries.ts` | `data/demo.ts` |
| `features/wardrobe/loadMascot.ts` | `data/wardrobe.ts` |
| RPC bodies from 18 action files (see below) | `data/*.ts` |

### Category A action files — bodies move, `"use server"` shells stay 🟢

The web keeps a one-line Server Action calling into `packages/data`; the mobile app
calls the same function directly. Security is unaffected: authorisation lives in the
`SECURITY DEFINER` RPC and RLS, not in the action.

`mission/actions.ts` · `wardrobe/actions.ts` · `levels/actions.ts` ·
`homework/actions.ts` · `map/actions.ts` · `study/actions.ts` · `study/heartbeat.ts` ·
`profile/actions.ts` · `feedback/actions.ts` · `i18n/actions.ts` · `auth/actions.ts` ·
`demo/actions.ts`

Covers `complete_mission`, `purchase_wardrobe_item`, `equip_wardrobe_item`,
`unequip_wardrobe_item`, `record_study_time`, `set_my_knowledge_level`,
`available_knowledge_levels`, `complete_homework_vocab`,
`complete_homework_grammar`, `get_unread_topics`, `reset_location_progress`,
`reset_level_progress`, `link_student_by_email`, `my_groups`,
`parent_student_homework`, `get_topic_messages`, `unread_feedback_count`,
`mark_feedback_read`.

### Category B action files — need new RPCs 🔴

These write tables directly and depend on a server-side role guard that does not
exist on a phone. **Audit RLS, then wrap.** See `WP-2.3`.

| File | Direct writes | Risk if shipped unwrapped |
| --- | --- | --- |
| `teacher/vocabularyActions.ts` | 14 | Any signed-in user could author vocabulary for any group |
| `teacher/grammarActions.ts` | 9 | Same, for grammar points |
| `teacher/actions.ts` | 3 | Group and topic mutation |
| `homework/qa/actions.ts` | 3 | Posting messages as another teacher |
| `onboarding/actions.ts` | 2 | Lower risk — writes only the caller's own profile |
| `teacher/viewAsActions.ts` | 1 | 🔴 cookie-based; becomes in-memory state on mobile |

### Category C — OpenRouter 🔴 → Supabase Edge Functions

| File | Becomes |
| --- | --- |
| `teacher/openRouterChat.ts`, `vocabularyPrompt.ts`, `grammarPrompt.ts` | `supabase/functions/draft-vocabulary/`, `draft-grammar/` |
| `admin/openRouterImage.ts`, `generateTaskImage.ts`, `generateLocationIcon.ts`, `generateMapBackground.ts` | `supabase/functions/generate-image/` — web-only caller, but the key must move regardless |

## 3. Routes → Expo Router 🔵

| Next.js App Router | Expo Router |
| --- | --- |
| `app/layout.tsx` | `app/_layout.tsx` — session provider, fonts, audio, splash |
| `middleware.ts` | `app/_layout.tsx` guard + `roleHome()` from core 🔴 |
| `app/page.tsx` (WelcomeScreen) | `app/index.tsx` |
| `app/auth/login,register,forgot-password,reset-password` | `app/(auth)/…` |
| `app/auth/callback` | deep-link handler in `app/(auth)/_layout.tsx` 🔴 |
| `app/map` | `app/(student)/map.tsx` |
| `app/mission/[missionId]` | `app/(student)/mission/[missionId].tsx` |
| `app/mission/[missionId]/reward` | `app/(student)/mission/[missionId]/reward.tsx` |
| `app/homework`, `app/homework/[topicId]` | `app/(student)/homework/…` |
| `app/wardrobe` | `app/(student)/wardrobe.tsx` |
| `app/profile` | `app/(student)/profile.tsx` |
| `app/onboarding` | `app/onboarding.tsx` |
| `app/teacher/**` (6 routes) | `app/(teacher)/**` |
| `app/parent/**` (3 routes) | `app/(parent)/**` |
| `app/admin/**` (15 routes) | ⚪ not ported |
| `app/demo/**` | ⚪ not ported — see OD-7 |
| `app/supabase-test` | ⚪ dev-only |

`BottomNav.tsx` becomes an Expo Router `Tabs` layout per role group, using
`navLabels.ts` from core for its labels.

## 4. Shared components → `src/components` 🔵

| Component | Notes |
| --- | --- |
| `ui/SlayButton.tsx` | `Pressable` + Reanimated press scale; add `expo-haptics` |
| `ui/SlayCard.tsx`, `Section.tsx`, `Grid.tsx`, `AppContainer.tsx` | direct `View` translation |
| `ui/SlayCharacter.tsx`, `HissableMascot.tsx` | `expo-image` + Reanimated idle loop |
| `ui/ProgressBar.tsx`, `StreakBadge.tsx`, `CurrencyAmount.tsx` | direct |
| `ui/CoinIcon.tsx`, `XpIcon.tsx`, `ShareIcon.tsx` | inline SVG → `react-native-svg` |
| `ui/RewardModal.tsx` | RN `Modal` + Reanimated celebration 🔴 |
| `ui/FullScreenLoader.tsx` | `loader-bob`/`loader-shadow`/`loader-dot` keyframes → Reanimated 🔴 |
| `ui/EmojiText.tsx` | `@twemoji/api` is DOM-based → native emoji rendering 🔴 |
| `ui/BackLink.tsx`, `NavLink.tsx` | Expo Router `Link` |
| `layout/ScrollScreen.tsx` | `ScrollView` + `SafeAreaView` |
| `layout/BottomNav.tsx` | Expo Router `Tabs` 🔴 |
| `auth/AuthGuard.tsx` | layout-level `<Redirect>` 🔴 |
| `PortraitLock.tsx` | `expo-screen-orientation` — becomes one config line 🔴 |
| `WelcomeScreen.tsx` | direct |
| `AudioUnlock.tsx` | ⚪ deleted — no autoplay policy on native |
| `InstallPrompt.tsx`, `ServiceWorkerRegistration.tsx`, `renderInstallTemplate.tsx` | ⚪ deleted — PWA-only |
| `MediaGuard.tsx` + `lib/mediaGuard.ts` | keep logic in core, re-front for `expo-image` |
| `wardrobe/WardrobeGrid.tsx` | `FlatList` |
| `*.stories.tsx` (9 files) | ⚪ Storybook stays in the web repository |

## 5. Feature screens → `src/features` 🔵

| Feature | Files | Notes |
| --- | --- | --- |
| `mission` | 32 task components + `MissionScreen`, `TaskRunner`, `ProgressBar`, `HowToPlayButton` | All tap-driven. See §7. |
| `map` | `CityMap`, `MapBackground`, `MapLocationNode`, `MascotMarker` | Absolute positioning + pan/zoom → `react-native-gesture-handler` 🔴 |
| `homework` | `HomeworkScreen`, `HomeworkTopicScreen`, `VocabularyFlow`, `GrammarFlow`, `WordCard`, `GrammarCard` | `WordCard` plays audio → `expo-audio` |
| `profile` | `ProfileScreen`, `ProfileLevelCard`, `ProfileUsernameCard` | direct |
| `wardrobe` | `WardrobeGrid` + mascot loading | `mascotCookie.ts` → SecureStore 🔴 |
| `levels` | `LevelPicker`, `LockedLevelsNote` | direct |
| `reward` | `RewardScreen` | celebration animation 🔴 |
| `onboarding` | `OnboardingForm` | direct |
| `study` | `StudyTimeTracker` | heartbeat must pause on `AppState` background 🔴 |
| `feedback` | `FeedbackButton`, `FeedbackImagePicker` | `expo-image-picker` 🔴 |
| `i18n` | `LocalePicker`, `clientLocale.ts` | cookie → SecureStore 🔴 |
| `teacher` | `TeacherDashboard`, `VocabularyManager` (632 LOC), `GrammarManager` (383), `StudentCard`, `HomeworkTopicForm`, `HomeworkTopicItem`, `VocabWordEditor`, `GrammarPointEditor`, `TopicContentImporter`, `CollapsibleSection`, `TeacherHeader`, `VocabularyCompletions` | dense forms; the two managers are the bulk of the work |
| `parent` | `ParentDashboard` (588 LOC), `ParentProfileScreen` | charts and progress readouts |
| `demo` | — | ⚪ see OD-7 |
| `admin` | — | ⚪ not ported |

## 6. Platform APIs 🔴

| Current | Mobile |
| --- | --- |
| `lib/audioContext.ts` (Web Audio) | `expo-audio` player behind an `AudioPlayer` interface in core |
| `lib/sfx.ts` | split: sequencing → core, playback → platform adapter |
| `lib/hiss.ts` | sequencing already pure → core; playback via adapter |
| `lib/supabase/client.ts`, `server.ts` | `src/lib/supabase.ts` with SecureStore adapter |
| `localStorage` / `sessionStorage` (2 files) | `expo-secure-store` for credentials, `AsyncStorage` for preferences |
| `slay_locale` cookie | SecureStore |
| `VIEW_AS_TEACHER_COOKIE` | React context, session-scoped |
| `revalidatePath()` | TanStack Query `invalidateQueries` |
| `@next/third-parties` GA | see OD-4 |

## 7. Mission task types — porting tiers 🔵

Derived from an interaction audit of all 32 files. No task needs drag gestures.

**Tier 1 — pure tap, direct translation (21 files, ~2 000 LOC).**
`AnalogyTask` · `AntonymMatchTask` · `CauseEffectTask` · `ClockReadingTask` ·
`CountingGameTask` · `DialogueChoiceTask` · `EmojiDecodeTask` · `MatchingTask` ·
`OddOneOutTask` · `PictureRevealTask` · `QuizTask` · `RhymeMatchTask` ·
`SentenceBuilderTask` · `SizeOrderTask` · `SpotTheDifferenceTask` ·
`StorySequencingTask` · `TrueFalseTask` · `VocabularyTask` · `WordScrambleTask` ·
`CategorySortTask` · `LetterFillTask`

**Tier 2 — tap plus a timer or animation (6 files, ~780 LOC).**
`BubblePopTask` · `FlashcardsTask` (flip animation) · `MemoryCardsTask` ·
`ReactionTapTask` · `SimonSequenceTask` (audio + light sequence) · `HangmanTask`

**Tier 3 — text input (3 files, ~450 LOC).**
`CrosswordTask` · `FillBlankTask` · `SpellingBeeTask`. Native keyboards behave
differently: autocorrect, autocapitalise and the keyboard-avoiding view all need
explicit handling, and a child's keyboard must not offer spelling suggestions during
a spelling exercise.

**Tier 4 — bespoke (2 files, ~670 LOC).**
`WordSearchTask` (305 LOC) — grid sizing must be measured, not assumed from viewport
units; selection logic is already pure in `wordPuzzle.ts`.
`SnakeGameTask` (363 LOC) — a `setInterval` tick loop that must pause on
`AppState` background or it drains battery and desyncs. Its D-pad already exists; the
keyboard handler is dropped.

## 8. Infrastructure

Split by repository, because the web app is not restructured.

### `slay-city-native` (new)

| Concern | Setup |
| --- | --- |
| CI | lint, type-check, test, **upstream drift check**; EAS build on tag |
| Tests | Vitest with a React Native preset, or `jest-expo` |
| Builds | EAS Build + EAS Submit; EAS Update for OTA |
| Excluded from all of the above | `upstream/` (gitignored reference checkout) |
| Not present at all | `supabase/`, `.storybook/`, Vercel config |

### `rubanwd/slay-city` (live — changes are pull requests, reviewed as such)

| Concern | Change |
| --- | --- |
| `supabase/migrations/` | new `SECURITY DEFINER` RPCs from `WP-2.3` |
| `supabase/functions/` | `draft-vocabulary`, `draft-grammar`, `generate-image` |
| Server Actions | become thin callers of those Edge Functions |
| Secrets | `OPENROUTER_API_KEY` moves Vercel → Supabase Secrets |
| Everything else | **unchanged** — same structure, same CI, same deploys |

### Supabase (shared)

Schema unchanged. Redirect allow-list gains `slaycity://auth/callback`
**alongside** the existing web URLs — adding, never replacing. Removing a web URL
breaks password reset in production silently.
