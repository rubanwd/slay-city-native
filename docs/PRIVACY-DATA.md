# What the app collects

The inventory behind Apple's privacy nutrition labels and Google Play's Data
safety form (`WP-7.4`). It is read from the code — every write in
`packages/data` and every native permission in `app.json` — not from intent.
Re-check it whenever a new write or a new native module lands.

The privacy policy and terms themselves live on the web site and are the
owner's to write; this file is what they must agree with.

## Collected and stored (Supabase, the shared project)

| Data | Who | Where it is written | Why | Linked to the person |
| --- | --- | --- | --- | --- |
| Email address | everyone | Supabase Auth (`signUp`, Google, Apple) | sign-in, password reset | yes |
| Password | email sign-up | Supabase Auth (hashed) | sign-in | yes |
| Apple / Google account identifier | social sign-in | Supabase Auth | sign-in | yes |
| Role (student, teacher, parent) | everyone | sign-up metadata, `profiles` | which app to show | yes |
| Student's email | parents | sign-up metadata, then `link_student_by_email` | link the parent to their child | yes |
| Username | everyone | `create_my_profile`, `profiles` | shown in the app, to teachers and parents | yes |
| Age | students | `create_my_profile` | content level | yes |
| English level, placement test answers and score | students | `set_my_knowledge_level`, `submit_placement_test` | which city to show | yes |
| Game progress: missions, XP, coins, streaks, wardrobe | students | `complete_mission`, `user_stats`, wardrobe RPCs | the game | yes |
| Homework completion | students | `complete_homework_vocab`, `complete_homework_grammar` | teacher and parent dashboards | yes |
| Study time (30 s ticks while a lesson is open) | students | `record_study_time` | parent dashboard | yes |
| Messages in a topic's Q&A | students, teachers | `post_topic_message` | questions to the teacher, seen by the group | yes |
| Feedback reports: text and up to a few screenshots | students, teachers | `feedback_reports`, the `content` storage bucket | bug reports to the admins | yes |
| Teacher-authored content: topics, words, grammar, images | teachers | homework tables, the `content` storage bucket | homework | yes |

No payment data. No location. No contacts. No health data. No browsing history.

## Stored only on the phone (never sent)

Kept in the device's secure storage (`expo-secure-store`): the Supabase
session, the chosen language (`slay_locale`) and the vibration switch
(`slay_haptics`). Deleting the app deletes them.

## Native permissions

| Permission | Used for | Asked when |
| --- | --- | --- |
| Photo library | a screenshot on a feedback report; a picture on teacher content | the person taps "add a picture" |

Camera and microphone are declared **off** in `app.json`
(`expo-image-picker` plugin). Nothing runs in the background. No push
notifications (`OD-6`).

## Not in the app

- **No analytics or advertising SDK.** The web uses Google Analytics; the
  native app does not (`OD-4` — keep it that way unless decided otherwise).
- **No crash reporting yet.** `~/lib/errorReporting` has the seam; adding a
  service (`WP-6.7`) adds "Crash data" and "Diagnostics" to both forms.
- **No tracking** in Apple's sense: nothing is shared with data brokers or
  used across other companies' apps.

## Third parties that process it

- **Supabase** — database, auth and storage for everything above. Its
  servers log requests (including IP addresses) for operation; say so in the
  policy.
- **Apple and Google** — only when someone chooses their sign-in.
- **OpenRouter** — only the topic details a teacher asks the AI to draft
  from, sent by an Edge Function, never from the phone (`OD-1`). No student
  data goes there.

## How it maps to the store forms

**Apple — App Privacy:** Contact Info → Email Address; Identifiers → User
ID; User Content → Photos (feedback screenshots, teacher pictures), Customer
Support (feedback reports), Other User Content (Q&A messages, teacher
content); Usage Data → Product Interaction (progress, study time); Other Data
→ age, English level. All **linked to the user**, all for **App
Functionality** — none for tracking, advertising or analytics.

**Google — Data safety:** Personal info → Email address, User IDs, Other
(age, role); Photos and videos → Photos; Messages → Other in-app messages; App
activity → App interactions, Other user-generated content. Collected, not
shared; encrypted in transit; account deletion must be offered — see below.

## Owed before submission

- **Account deletion in the app.** Both stores require a way to delete the
  account from inside the app (Apple 5.1.1(v)). Neither the web nor this app
  has one yet; it needs an RPC upstream that removes the profile, progress and
  messages, and a button on all three profiles.
- **Children.** Students may be under 13: the policy must cover consent
  (`OD-3`, `WP-7.5`).
