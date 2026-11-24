# SLAY CITY — Privacy Policy (DRAFT)

> **DRAFT — NOT LEGAL ADVICE. The owner must have a lawyer review this before
> publishing it.** It is written from what the code actually does
> ([`docs/PRIVACY-DATA.md`](../PRIVACY-DATA.md)). Anything in `[SQUARE
> BRACKETS]` is a placeholder or a decision only the owner can make. Re-check it
> against `PRIVACY-DATA.md` whenever a new data write, native permission or
> third-party service is added (crash reporting is the next one expected).
>
> Publish it on the web site at a stable public URL (for example
> `[SITE URL]/privacy`). Google Play needs that URL in the store listing and in
> the Data safety form, and it must be reachable without signing in.

**Effective date:** [DATE]
**Who we are:** SLAY CITY is operated by [OWNER LEGAL NAME], [COUNTRY / ADDRESS]
("we", "us"). Contact: **[CONTACT EMAIL]**.

This policy covers the SLAY CITY mobile app (Android and iOS) and the SLAY CITY
web site and web app at [SITE URL]. Both use the same accounts and the same
data.

## 1. Who uses SLAY CITY

SLAY CITY is an English-learning game. It has three kinds of accounts:

- **Students**: learners, who may be children (the game is designed for ages
  5 and up).
- **Teachers**: adults who run groups of students and set homework.
- **Parents**: adults who link to their child's account to follow progress.

## 2. Children and consent

Students may be under 13, or under the age of digital consent in their
country (between 13 and 16 in the EU/EEA and the UK).

- **A child should not create an account alone.** A student account must be
  created by, or with the permission of, a parent or legal guardian, or by a
  school or teacher acting with the parent's consent where the law allows the
  school to give it.
- **[OWNER DECISION: how consent is obtained.]** Describe the actual
  mechanism here, for example: *"When a student account is created for a child
  under 13, the parent or teacher confirms that they are the parent or have
  the parent's consent."* Do not publish this policy until the app and web
  sign-up actually do what this paragraph says. (COPPA requires *verifiable*
  parental consent, or the school-authorisation exception for school use; the
  GDPR requires parental consent below the national age of digital consent.)
- We collect from students only what the game needs to work (see section 3).
  We do not ask children for their real name, address, phone number, photo or
  location.
- **The app has no ads and no analytics, and we do not sell or share anything
  for advertising.** We do not build advertising profiles of children.
- A parent or guardian can at any time ask to see their child's data, have it
  corrected, or have the account and its data deleted, and can withdraw
  consent, by writing to **[CONTACT EMAIL]** (see section 8). If we learn that
  we hold a child's account without the required consent, we will delete it.

## 3. What we collect, and why

All of this is stored in our database (see Supabase, section 5) and linked to
the account.

| What | From whom | Why |
| --- | --- | --- |
| Email address | everyone | to sign in and to reset a password |
| Password (stored only in hashed form) | people who sign up with email | to sign in |
| Apple or Google account identifier | people who choose "Sign in with Apple" or "Sign in with Google" | to sign in |
| Role (student, teacher or parent) | everyone | to show the right part of the app |
| Username | everyone | shown in the app, and to the student's teacher, group and linked parents |
| Age | students | to pick the right level of content |
| English level, placement-test answers and score | students | to choose which part of the game to show |
| Game progress: missions, points (XP), in-game coins, streaks, avatar wardrobe | students | to run the game |
| Homework completion | students | so the teacher and parents can see it |
| Study time (counted in 30-second steps while a lesson is open) | students | so parents can see it |
| The student's email address | parents | to link the parent's account to their child's |
| Messages in a homework topic's question-and-answer thread | students, teachers | so students can ask their teacher questions; the thread is visible to the teacher and the students in that group |
| Bug reports: text, and screenshots the person chooses to attach | students, teachers | to fix problems |
| Teaching content: topics, words, grammar exercises, notes, links and pictures | teachers | to set homework |

**In-game coins are not money.** Students earn them by playing and spend them
on avatar items. There are no real-money purchases in SLAY CITY.

**We do not collect:** payment information, precise or approximate location,
contacts, phone numbers, health data, browsing history, or the device's
advertising identifier. The app does not use the camera or the microphone.

**Photos.** The app asks for access to your photo library only when you tap to
add a picture: a screenshot for a bug report, or a picture on a teacher's
homework. Only the picture you pick is uploaded.

### Kept only on your device

The app stores your sign-in session, your chosen language and your vibration
setting in the phone's secure storage. They are not sent to us and are
removed when you uninstall the app.

### The web site

[OWNER CHECK: the web uses Google Analytics.] The SLAY CITY web site uses
Google Analytics to understand how the site is used. Google Analytics sets
cookies and receives information such as pages visited, device and browser
type, and an approximate location derived from your IP address. [Describe the
cookie banner or consent and the opt-out actually offered, and whether
analytics is turned off for signed-in students.] **The mobile app does not
include Google Analytics or any other analytics or advertising software.**

## 4. Who can see what

- A student's **teacher** sees the student's username, progress, homework
  results and the Q&A messages in their group.
- A **linked parent** sees their child's username, progress, homework and study
  time.
- Other **students in the same group** see the student's username and Q&A
  messages in that group.
- Our **administrators** can see bug reports and account data so they can run
  and support the service.

We do not sell personal information, and we do not share it with anyone for
advertising.

## 5. Service providers (processors)

We use these companies to run SLAY CITY. They process data on our behalf and
only for that purpose:

- **Supabase** ([supabase.com](https://supabase.com)): our database, sign-in
  and file storage. Everything in section 3 is stored there. Like any web
  server, Supabase's servers log technical information about each request,
  including your **IP address**, device or browser information and the time,
  for security and to keep the service running. [OWNER: state the Supabase
  project's region (e.g. EU or US) and how long those logs are kept on your
  plan.]
- **Apple and Google**: only if you choose "Sign in with Apple" or "Sign in
  with Google". They give us your account identifier and email address (Apple
  may give a private relay address). Their own privacy policies apply to your
  Apple or Google account.
- **OpenRouter** ([openrouter.ai](https://openrouter.ai)): an AI service used
  **only when a teacher asks the AI to draft homework**. Our server sends it the
  topic details the teacher typed. It is never called from students' devices,
  and **no student data is sent to it**.
- **Google Analytics**: on the web site only (see section 3).
- [Hosting provider of the web site, e.g. Vercel. OWNER CHECK.]
- [Crash reporting: not used yet. Add it here before turning it on.]

Some of these providers may process data outside your country, including in
the United States. Where the law requires it, we rely on safeguards such as
the European Commission's Standard Contractual Clauses. [OWNER CHECK.]

## 6. Legal bases (EU/EEA and UK)

- **Contract**: to provide the account and the game that you, or your parent or
  school, signed up for.
- **Consent**: of the parent or guardian, for children below the age of
  digital consent; and for analytics cookies on the web site.
- **Legitimate interests**: to keep the service secure (for example server
  logs) and to fix bugs.

## 7. How long we keep data

- **Account data, progress, messages and content**: while the account
  exists. When an account is deleted, its data is deleted within [30] days,
  except where the law requires us to keep something.
- **Bug reports and their screenshots**: [OWNER DECISION, e.g. 12 months, or
  until the issue is fixed].
- **Server logs** (Supabase): [OWNER CHECK: the period Supabase keeps logs on
  your plan].
- **Inactive accounts**: [OWNER DECISION, e.g. deleted after 2 years without a
  sign-in, with notice sent to the email address].
- **Backups**: deleted data may remain in backups for up to [N] days before
  being overwritten.

## 8. Deleting your account, and your other rights

**Deleting an account.** [OPEN ITEM: in-app deletion is being built.] You will
be able to delete your account from the app's **Profile** screen. You can also
request deletion at **[ACCOUNT DELETION URL]** or by emailing
**[CONTACT EMAIL]** from the account's email address. Deleting an account
removes the profile, game progress, homework results, messages and bug reports
linked to it. A parent can ask us to delete their child's account.
[OWNER CHECK: once the deletion feature lands, make this paragraph match
exactly what it removes. For example, does a teacher's homework content stay
for their students?]

You (or, for a child, the parent or guardian) can also ask to:

- see a copy of the data we hold;
- correct it;
- delete it, or restrict or object to how we use it;
- receive it in a portable format;
- withdraw consent at any time (this does not affect what was done before).

Email **[CONTACT EMAIL]**. We will reply within one month. We may need to check
that the request comes from the account holder or the child's parent. In the
EU/EEA or UK you can also complain to your data protection authority.
[US: describe any state-law rights if applicable. OWNER CHECK.]

## 9. Security

All data travels between the app or web site and our servers encrypted
(HTTPS/TLS). Passwords are stored hashed. Database access is restricted by
row-level security rules, so each person can read only what their role allows.
On the phone, the sign-in session is kept in the device's secure storage. No
system is perfectly secure; if a breach affects your data we will tell you and
the authorities as the law requires.

## 10. Changes to this policy

If we change this policy we will update the date at the top. For significant
changes we will tell users in the app or by email and, where the law requires
it, ask parents for consent again.

## 11. Contact

[OWNER LEGAL NAME] · **[CONTACT EMAIL]** · [POSTAL ADDRESS]
[EU/UK representative if required. OWNER CHECK.]
