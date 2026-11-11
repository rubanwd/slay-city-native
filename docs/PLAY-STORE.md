# Google Play — first release

The path from this repository to SLAY CITY on Google Play, and who does each
step. The build side is ready (`RELEASES.md`). What is left needs the Play
Console account, legal text and a decision or two from the owner.

## 0. Before anything is uploaded

| | Step | Who | State |
| --- | --- | --- | --- |
| 1 | Google Play Console account ($25 once) | owner | ? (`WP-7.1`) |
| 2 | Upstream PR "Account deletion" merged — then this repo's branch | owner (review) | open |
| 3 | Privacy policy and terms published on the live site | owner | not written |
| 4 | `eas init`, then `eas env:create` for the three `EXPO_PUBLIC_*` values (`preview` and `production`) | owner | — |
| 5 | Decide the target audience (§4) | owner | — |

**A personal Play account must run a closed test first.** Google requires a
personal developer account created after November 2023 to keep a closed test
with at least 12 testers opted in for 14 continuous days before it can apply
for production. An organisation account (needs a D-U-N-S number) skips that.
Either way, start the closed test as soon as the first build is in: the
14 days are the long pole.

## 1. The first build

```bash
npm run lint && npm run type-check && npm test && npm run upstream:check
eas build --profile production --platform android     # an AAB, signed by EAS
```

Google requires the **first** AAB to be uploaded by hand: Play Console →
the app → Testing → Internal testing → Create release → upload. After that,
`eas submit --profile production --platform android` uploads as a draft to
the internal track (needs a service-account key, stored with
`eas credentials`, never in the repo).

Then: internal testing (the team) → closed testing (≥ 12 testers, 14 days, if
the account is personal) → production with a staged rollout (`WP-8.4`).

## 2. Store listing

| Field | Value |
| --- | --- |
| App name (30) | SLAY CITY |
| Package | `app.slaycity.mobile` — never changes |
| Category | Education |
| App icon | [`store/google-play/icon-512.png`](../store/google-play/icon-512.png) (512 × 512, from `assets/icons/icon.png`) |
| Feature graphic | 1024 × 500 — **to make** (brand art; no text near the edges) |
| Phone screenshots | 2–8, from a preview build: map, a mission, the reward, wardrobe, homework, the parent dashboard |
| Contact email | owner's support address |
| Privacy policy URL | the live site's policy page |

### English

**Short description (80):**
Learn English on a city map: missions, XP, coins and a snake who dresses up.

**Full description:**

SLAY CITY turns English practice into a city to explore.

Walk the map district by district. Every stop is a mission — quizzes, word
games, spelling, listening, sentence building and more than thirty kinds of
task — and every mission pays out XP and coins. Spend the coins on outfits for
Slay, the snake who goes everywhere with you.

• Missions matched to your English level, from beginner up
• A level test that tells you where to start
• Homework from your teacher, with words, grammar and a test
• Ask your teacher questions right inside a homework topic
• Streaks and study time that grow every day you practise

For teachers: groups and 1-on-1 students, homework topics with vocabulary and
grammar, a preview of every test, and each student's progress at a glance.

For parents: link your child's account and follow their level, missions,
streaks, study time and homework — in English, Ukrainian or Russian.

No ads. No tracking.

### Українською

**Короткий опис (80):**
Англійська на карті міста: місії, XP, монети і змійка, яка вбирається.

**Повний опис:**

SLAY CITY перетворює англійську на місто, яке хочеться досліджувати.

Проходь карту район за районом. Кожна зупинка — місія: тести, ігри зі
словами, правопис, аудіювання, побудова речень і ще понад тридцять видів
завдань. За кожну місію — XP і монети. Витрачай монети на образи для Slay —
змійки, яка всюди з тобою.

• Місії під твій рівень англійської, від початкового
• Тест, що підкаже, з якого рівня почати
• Домашні завдання від вчителя: слова, граматика і тест
• Питання вчителю прямо в темі домашнього завдання
• Серії днів і час навчання, що ростуть щодня

Для вчителів: групи й індивідуальні учні, теми з лексикою та граматикою,
перегляд кожного тесту і прогрес кожного учня з одного погляду.

Для батьків: підключіть акаунт дитини й стежте за рівнем, місіями, серіями,
часом навчання і домашніми — англійською, українською чи російською.

Без реклами. Без стеження.

## 3. App content (Policy → App content)

| Form | Answer |
| --- | --- |
| Privacy policy | the live site's URL |
| Ads | No ads |
| App access | Sign-in required — give a **test student, teacher and parent** account (email + password) with instructions; the reviewer cannot use the app without them |
| Content rating (IARC) | Education; no violence, sexuality, gambling, drugs or profanity. User-generated content: **yes** — Q&A messages between a group and its teacher, visible only to that group |
| Data safety | Exactly as [PRIVACY-DATA.md](PRIVACY-DATA.md) §"How it maps to the store forms" — collected, not shared, encrypted in transit, deletion offered |
| Account deletion URL | the web profile page: sign in → Profile → Delete account (also in the app) |
| Government / financial / health features | None |

## 4. Target audience — the owner's decision

Students may be under 13. If the target age groups you tick include any under
13, the app falls under Google Play's **Families policy**: the privacy policy
must cover children's data and parental consent, and every SDK must be
Families-compliant. The app already has no ads and no analytics, which is what
that policy mostly polices, so ticking under-13 is feasible — but the privacy
policy has to say how consent is obtained (today: a parent or teacher sets the
child up, or a parent links them).

Recommended: tick **13–15, 16–17 and 18+** for the first release if the
student base allows it, and add younger ages once the policy covers consent.
This mirrors `OD-3` (Apple: rate 4+, stay out of the Kids Category).
