# Google Play closed testing

The owner's Play Console account is a **personal** account (see
`docs/dependency-gates.md`, `P10`). For such accounts Google allows a
production release only after a **closed test with at least 12 testers who
stayed opted in for 14 days in a row**. Nothing shortens the 14 days, so
recruit testers before the first closed release, not after.

Google does the counting itself. Nobody uploads proof: the Play Console
**Dashboard** shows how many testers are opted in and how many days are
left, and at the end the owner answers a questionnaire about the test.

## What counts and what does not

| Counts | Does not count |
| --- | --- |
| The **Closed testing** track (`alpha` in `eas.json`) | The **Internal testing** track |
| A tester who opened the opt-in link and tapped **Become a tester** | An email address on the list that never accepted |
| Testers opted in on each of the last 14 consecutive days | Someone who joined and left again |
| New AAB releases on the closed track | EAS over-the-air updates (Google never sees them) |

Aim for **15–20 testers**. Some people never install, and if the count drops
below 12 the run is no longer continuous.

## Steps

1. **App content first.** Fill in every section under *Policy and programs →
   App content* from [`play-console.md`](play-console.md), because a
   closed-testing release goes through Google's review.
2. **Create the tester list.** *Testing → Closed testing → (track) →
   Testers*. A **Google Group** is easiest: people join it themselves and
   nobody has to collect their addresses. Otherwise, an email list. The
   address must be the Google account the person uses for the Play Store on
   their phone.
3. **Upload the release.** The first AAB goes up by hand (the Play API
   accepts only drafts until the app has been released once). After that:
   `eas build --profile production --platform android --auto-submit`.
4. **Wait for the review** (from a few hours to a few days), then copy the
   **opt-in link** from the Testers tab and send the invitation below.
5. **During the 14 days:** check the count on the Dashboard every couple of
   days, collect feedback in writing, fix things, and **upload at least one or
   two new builds** to the closed track so Google can see the app being
   worked on. Fill in the feedback log below as you go: it is what the
   questionnaire asks for.
6. **Apply for production.** Once the Dashboard says the requirement is met,
   click **Apply for production** and answer the questionnaire (how testers
   were recruited, how engaged they were, what feedback came in and what
   changed, who the app is for, why it is ready). The review takes up to
   about 7 days. If Google finds the test too thin, it asks for more testing.

## Who to invite

- **Teachers and parents** form the core: adults with their own Google
  accounts.
- **Older students** with their own accounts.
- **Younger children** (with Family Link supervised accounts) probably cannot
  join a testing programme. They can play on a parent's phone, and the parent
  is then the tester.

## Invitation (Ukrainian)

Replace `[ПОСИЛАННЯ]` with the opt-in link (and `[ГРУПА]` with the Google
Group link if one is used).

> **Допоможіть нам запустити SLAY CITY у Google Play** 🙏
>
> Ми готуємо мобільну версію SLAY CITY для учнів, учителів і батьків. Щоб
> опублікувати застосунок, Google вимагає, щоб його 14 днів поспіль
> тестували щонайменше 12 людей. Будемо дуже вдячні, якщо ви приєднаєтеся!
>
> **Що потрібно (5 хвилин):**
>
> 1. Телефон з Android і Google-акаунт, з яким ви заходите в Play Store.
> 2. *(Якщо є)* Вступіть у групу тестувальників: [ГРУПА]
> 3. Відкрийте посилання: [ПОСИЛАННЯ]. Увійдіть тим самим Google-акаунтом і
>    натисніть **«Стати тестувальником»**.
> 4. Натисніть **«Завантажити з Google Play»** і встановіть застосунок.
> 5. Увійдіть у SLAY CITY своїм звичайним акаунтом (учня, вчителя чи батьків).
>
> **Найважливіше:** не виходьте з програми тестування і не видаляйте
> застосунок 14 днів. Інакше Google не зарахує тест.
>
> Користуйтеся застосунком, як звичайно, хоча б кілька разів на тиждень. Якщо
> щось не працює або незручно, напишіть нам: [КОНТАКТ / ФОРМА ВІДГУКІВ].
> Застосунок оновлюється сам, тож після оновлення відкрийте його двічі.
>
> Дякуємо! 💜

## Reminder (Ukrainian, day 7)

> Привіт! Минув тиждень тестування SLAY CITY, дякуємо, що ви з нами 💜
> Залишилося ще 7 днів. Будь ласка, не виходьте з програми тестування і не
> видаляйте застосунок. Якщо щось помітили, напишіть нам: [КОНТАКТ].

## Tester log

Keep it out of the repository if it holds real names or emails (a private
spreadsheet is fine). Only the counts belong here.

| Date | Invited | Opted in (Dashboard) | Notes |
| --- | --- | --- | --- |
| | | | |

## Feedback log

What came in and what was done about it. This becomes the answer to the
production questionnaire.

| Date | Role (student / teacher / parent) | Feedback | Change / build |
| --- | --- | --- | --- |
| | | | |
