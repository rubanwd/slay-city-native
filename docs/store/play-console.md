# Google Play Console: answers, field by field

Draft answers for **Policy and programs → App content** and the **Main store
listing** of `app.slaycity.mobile`. Every answer comes from
[`docs/PRIVACY-DATA.md`](../PRIVACY-DATA.md) and `app.json`. If those change,
the answers change. Placeholders are in `[SQUARE BRACKETS]`.

## Open items before the production review

| # | Item | Blocks |
| --- | --- | --- |
| 1 | **Account deletion**: the in-app button and a public web URL where a user can ask for deletion without the app. It is being built separately. Play requires both for any app that creates accounts. | Data safety → "Delete account URL"; production |
| 2 | **Privacy policy URL** on the web site, from [privacy-policy.md](privacy-policy.md) after legal review. | Privacy policy, Data safety, Target audience |
| 3 | **Parental consent** for under-13 students (`OD-3`, `WP-7.5`): the policy must describe a mechanism the sign-up really has. | Target audience (Families) |
| 4 | **Crash reporting** is not wired yet (`WP-6.7`). The day it is, add "App info and performance → Crash logs / Diagnostics" to Data safety and name the service in the policy. If children are a target audience, the SDK must meet the Families policy. | Data safety stays truthful |
| 5 | **Check the merged Android manifest** of the first AAB (`bundletool dump manifest`) for `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` and `com.google.android.gms.permission.AD_ID`. Play's photo/video policy expects occasional pickers to use the system photo picker with no broad media permission; if `expo-image-picker` adds one, block it in `app.json`. If `AD_ID` appears, block it too and answer "No" to the advertising-ID question. | Photo/video declaration; Advertising ID |
| 6 | **Reviewer test accounts** (below) must exist in the production Supabase project with realistic data. | App access |

---

## Privacy policy

- **Privacy policy URL:** `[SITE URL]/privacy`

## App access

**All or some functionality in my app is restricted**: everything is behind
sign-in.

Add three sets of instructions. Use **email + password** accounts, because the
reviewer cannot sign in with someone else's Google or Apple account.

| Name | Username | Password | Other information |
| --- | --- | --- | --- |
| Student | `[REVIEW STUDENT EMAIL]` | `[PASSWORD]` | "On the sign-in screen tap *Sign in with email*. The student has finished the placement test, is in a teacher's group and has open homework. The city map is the home screen; tap a location for a mission. Homework is under *Homework*, avatar items under *Wardrobe*." |
| Teacher | `[REVIEW TEACHER EMAIL]` | `[PASSWORD]` | "A teacher with one group containing the review student, and one homework topic. *Groups* shows students' progress; a topic has a Q&A thread with the student." |
| Parent | `[REVIEW PARENT EMAIL]` | `[PASSWORD]` | "A parent linked to the review student. The home screen shows the child's progress, homework and study time." |

Before submitting, sign in with each account on a release build to confirm
that it works and that no one-time setup screen (onboarding, placement test)
is left for the reviewer to finish. No 2-step verification, no location
needed. Change the passwords only after the review is done.

## Ads

**Does your app contain ads?** **No.** No ad SDK is in the app (`OD-4`; the
app has no Google Analytics either).

## Content rating (IARC questionnaire)

- **Email for IARC:** `[CONTACT EMAIL]`
- **Category:** *Game* (it is a game with missions, XP and coins). Choose
  *Education* only if you would rather have the app rated as a reference/
  education app; the answers are the same.

| Question | Answer | Why |
| --- | --- | --- |
| Violence (any, cartoon, realistic, blood) | No | none in the game |
| Fear / horror | No | |
| Sexuality, nudity | No | |
| Language (profanity, crude humour) | No | authored content is clean; Q&A is between students and their teacher (below) |
| Controlled substances (drugs, alcohol, tobacco) | No | |
| Gambling: real or simulated, including loot boxes | No | coins are earned by play and spent on items the student picks; nothing random, no real money |
| Does the app let users interact or exchange content? | **Yes** | a homework topic's Q&A thread: text between the students of one group and their teacher |
| Does the app share the user's current physical location with other users? | No | no location at all |
| Does the app let users buy digital goods? | No | no in-app purchases; coins have no money value |
| Does the app contain unrestricted internet access (e.g. a browser)? | No | a teacher's homework link opens in the phone's browser, but the app has no browser of its own |
| Is the app primarily a news or educational product? | Educational | if asked |

**Expected result:** Everyone / PEGI 3 / USK 0, with the interactive element
**"Users Interact"**.

## Target audience and content

**Target age groups.** Students are 5 and up; teachers and parents are adults.
Pick the groups the app really serves:

- [x] 5 and under ([OWNER: tick it only if 5-year-olds really use it on their own])
- [x] 6–8
- [x] 9–12
- [x] 13–15
- [x] 16–17
- [x] 18 and over (teachers, parents)

**Appeal to children:** yes, the store listing and art are made for children.

### What ticking any under-13 group means (the Families policy)

Once a group under 13 is ticked, the app is in scope of **Google Play's
Families policy**. Most of it is already true; check each:

| Requirement | Status |
| --- | --- |
| Ads only from Families Self-Certified SDKs, or none | ✅ none |
| No transmission of the Android advertising ID, IMEI, or other persistent device identifiers from children | ✅ none in our code. Confirm no SDK adds `AD_ID` (open item 5) |
| No precise location, no unnecessary permissions | ✅ only the photo library, on demand; camera and microphone are off |
| Any SDK used in a child-directed app must be approved for that use | ✅ Supabase, Expo modules. Re-check when crash reporting is added (open item 4) |
| Privacy policy covering children's data, plus legally required parental consent (COPPA / GDPR-K) | ⏳ open items 2 and 3 |
| Content appropriate for children, including content users create | ⚠️ Q&A and teacher content are user-created. State in the terms that teachers are responsible for it, and make sure a student or teacher can delete their own message (they can, by long press) and that admins can remove abuse (feedback reports reach them) |
| Links out of the app should not lead children to inappropriate content | ⚠️ a teacher's homework link opens the browser. Consider an "ask a grown-up" gate before it opens; Google treats it as good practice and Apple's Kids rules would require it |
| Data safety form and store listing accurate | this document |
| Account deletion | ⏳ open item 1 |

Consequences: Play reviews the app against these rules **before every
release**, not only the first one; a breach can lead to rejection or removal.
Google may also show a "Teacher Approved" badge later; it is optional and not
something you apply for.

**Mixed audience:** the app is for children *and* adults, which Play
allows. Students state their age during onboarding (`create_my_profile`), so
the app does not need a separate age screen. [OWNER CHECK: Play may ask how
you make sure adults-only features are not shown to children. The answer is
that teacher and parent screens open only for those roles.]

## News app

No.

## COVID-19 contact tracing and status apps

My app is not a publicly available COVID-19 app.

## Data safety

### Overview questions

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes**: all traffic to Supabase is HTTPS |
| Which of the following methods of account creation does your app support? | Username and password; OAuth (Sign in with Google, Sign in with Apple) |
| Delete account URL | `[ACCOUNT DELETION URL]` (open item 1) |
| Do you provide a way for users to request that some or all of their data is deleted, without deleting their account? | [OWNER: "Yes" only if you will handle such emails at `[CONTACT EMAIL]`; otherwise "No"] |
| Has your app been independently validated against a global security standard (MASA)? | No |

**Shared?** For every type below the answer is **not shared**. Supabase, and
OpenRouter for teacher drafts, are *service providers* that process data for
us, which Google does not count as sharing. Apple and Google sign-in are the
user's own choice to sign in with them.

**Processed ephemerally?** No for all: everything is stored.

### Data types

| Category → type | Collected | Required / optional | Purposes | What it is |
| --- | --- | --- | --- | --- |
| Personal info → **Email address** | Yes | Required | App functionality, Account management | sign-in, password reset; a parent also enters their child's email to link |
| Personal info → **User IDs** | Yes | Required | App functionality, Account management | account ID, username, Apple/Google account identifier |
| Personal info → **Other info** | Yes | Required | App functionality | role (student/teacher/parent); students' age |
| Photos and videos → **Photos** | Yes | Optional | App functionality (teacher pictures); Developer communications [or App functionality] (bug-report screenshots) | only a picture the user picks |
| Messages → **Other in-app messages** | Yes | Optional | App functionality | Q&A thread messages in a homework topic |
| App activity → **App interactions** | Yes | Required | App functionality | missions, XP, coins, streaks, wardrobe, homework completion, study time |
| App activity → **Other user-generated content** | Yes | Optional | App functionality; Developer communications | bug-report text; teachers' topics, words, grammar and notes |
| App activity → **Other actions** | Yes | Required (students) | App functionality | English level, placement-test answers and score |

Not collected: Location (approximate or precise), Financial info, Health and
fitness, Contacts, Calendar, Audio, Files and docs, Web browsing, App info and
performance (until crash reporting lands, open item 4), Device or other IDs,
name, address, phone number, race, political or religious beliefs, sexual
orientation.

> **IP addresses.** Supabase's servers log request IPs for operation and
> security. They are not used to work out a location or for anything else, so
> the form usually does not need "Approximate location". The privacy policy
> still says it. [OWNER CHECK against Google's current Data safety help page.]

**No data is used for:** Analytics, Advertising or marketing, Fraud
prevention/security, Personalisation beyond the game itself.

## Government apps

No.

## Financial features

My app doesn't provide any financial features.

## Health apps

My app does not have any health features.

## Advertising ID

**Does your app use advertising ID?** **No** (see open item 5).

## Photo and video permissions (only if Play asks)

If the AAB still declares a broad media permission (open item 5), Play asks
for a justification. The truthful one: *"One-time, user-initiated selection
of a single picture to attach to a bug report or to a teacher's homework."*
Google's answer to that use is to drop the permission and use the system
photo picker, so fix the manifest instead of submitting the declaration.

---

## Store listing

- **App name** (≤30): `SLAY CITY`
- **Category:** Education [or Games → Educational]
- **Tags:** Education, Language learning, Kids
- **Contact email:** `[CONTACT EMAIL]` · **Website:** `[SITE URL]` ·
  **Privacy policy:** `[SITE URL]/privacy`

### English

**Short description** (≤80 characters; this one is 74):

> Learn English by playing: missions, a city to explore, homework from class

**Full description** (≤4000 characters):

> SLAY CITY turns learning English into a game. Students explore a city built
> for their level, complete missions, earn XP and coins, keep up their
> streaks and dress their avatar from the wardrobe.
>
> FOR STUDENTS
> • A short placement test finds the right starting level
> • Missions with words, grammar and quizzes, one location at a time
> • XP, coins, streaks and wardrobe items that reward regular practice
> • Homework from your teacher, right in the app
> • Ask your teacher a question in each homework topic
>
> FOR TEACHERS
> • Create groups and follow every student's progress
> • Set vocabulary and grammar homework with notes, links and pictures
> • Answer students' questions in the topic's Q&A thread
> • Get a head start on new topics with an AI draft you review and edit
>
> FOR PARENTS
> • Link to your child's account
> • See progress, homework and how much time they spent studying
> • The parent screens speak English, Ukrainian or Russian
>
> SAFE FOR KIDS
> • No ads
> • No in-app purchases: coins are earned by playing, never bought
> • No analytics or tracking in the app
> • Students are never asked for their location, phone number or photo
>
> One account works in the app and on the web at [SITE URL], so progress
> follows students wherever they practise.
>
> SLAY CITY is designed for learners aged 5 and up, together with their
> teachers and parents. A parent, guardian or school should create a child's
> account.

### Українська (uk-UA)

**Короткий опис** (≤80 символів; тут 68):

> Вивчай англійську граючи: місії, місто, домашні завдання від вчителя

**Повний опис:**

> SLAY CITY перетворює вивчення англійської на гру. Учні досліджують місто
> свого рівня, проходять місії, заробляють досвід (XP) і монети, тримають
> серію днів поспіль і вдягають свого аватара в гардеробі.
>
> ДЛЯ УЧНІВ
> • Короткий тест визначає рівень, з якого почати
> • Місії зі словами, граматикою та вікторинами, локація за локацією
> • XP, монети, серії та речі для гардероба за регулярну практику
> • Домашні завдання від вчителя прямо в застосунку
> • Питання вчителю в кожній темі домашнього завдання
>
> ДЛЯ ВЧИТЕЛІВ
> • Створюйте групи й стежте за прогресом кожного учня
> • Задавайте домашні завдання зі слів і граматики з нотатками, посиланнями та зображеннями
> • Відповідайте на питання учнів в обговоренні теми
> • Почніть нову тему з чернетки від ШІ, яку ви перевіряєте й редагуєте
>
> ДЛЯ БАТЬКІВ
> • Під'єднайтеся до облікового запису дитини
> • Бачте прогрес, домашні завдання та скільки часу дитина навчалася
> • Батьківський розділ доступний англійською, українською та російською
>
> БЕЗПЕЧНО ДЛЯ ДІТЕЙ
> • Без реклами
> • Без покупок у застосунку: монети заробляються грою, їх не можна купити
> • Без аналітики й відстеження в застосунку
> • У дітей ніколи не питають місцезнаходження, номер телефону чи фото
>
> Один обліковий запис працює і в застосунку, і на сайті [SITE URL], тож
> прогрес завжди з учнем.
>
> SLAY CITY створено для учнів від 5 років разом із їхніми вчителями та
> батьками. Обліковий запис дитини має створювати батько, мати, опікун або
> школа.

> The student game itself is in English on purpose; only the parent screens
> are translated (`packages/core/src/features/i18n/locales.ts`). The Ukrainian
> listing says so. Do not claim a Ukrainian interface for students.

### Graphics

| Asset | Spec | Source / note |
| --- | --- | --- |
| App icon | 512 × 512 PNG, 32-bit with alpha, ≤1 MB | export from `assets/icons/icon.png` (Play adds the rounded mask) |
| Feature graphic | 1024 × 500 JPG or 24-bit PNG, **no alpha** | to make: city art + "SLAY CITY" wordmark; keep text off the edges |
| Phone screenshots | 2–8 images, PNG or JPG, 9:16, each side 320–3840 px; 1080 × 1920 or larger recommended | suggested set: student city map · a mission · wardrobe · homework topic with Q&A · teacher group progress · parent dashboard. Use the review accounts' data, with no real children's names or emails |
| 7" and 10" tablet screenshots | optional | skip for now (the app is phone-first) |
| Promo video | optional | none |

Families note: screenshots and graphics must show the real app and nothing
unsuitable for children.
