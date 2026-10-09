# `WP-2.3` thin callers — staged for `rubanwd/slay-city`

> **These files do not run in this repository.** They are the TypeScript
> deliverable of `SCN-12`, written here for the same reason the SQL in
> `docs/migrations/wp-2.3/` is: this repository has no web-app source tree and
> `AGENTS.md` ("Migrations belong upstream") means it never will. Copy `src/`
> below over the matching paths in the web repository's own `src/`, on the
> same branch as `docs/migrations/wp-2.3/*.sql`, and open the pull request
> described in [`docs/UPSTREAM-PR-WP-2.3.md`](../../UPSTREAM-PR-WP-2.3.md).
>
> This closes the one open item `SCN-11` left behind: "the TypeScript
> thin-caller pass is not done" (see `docs/changes/SCN-11.md`, *Limitations*).
> `WP-2.3` `AC5` — "the web's behaviour is unchanged; its actions now call the
> new RPCs" — is not met until this lands next to the SQL.
>
> **Rebased onto upstream `02630a3` on `SCN-61`.** `onboarding/actions.ts` had
> gone stale: upstream extracted the age validation into
> `features/onboarding/age.ts` (`parseAge`, `MIN_AGE`, `MAX_AGE`) and this copy
> still carried its own inline constants, so pasting it over `main` would have
> silently reverted that refactor and reintroduced a second source of truth for
> the range. It now imports `parseAge` like `main` does. The other four files
> needed no change — each still exports exactly the names upstream's version
> exports. Every `import` in all five was re-resolved against `02630a3`: all
> twelve first-party modules they reach for still exist, and so does every
> named symbol they pull out of them. Re-check both if upstream moves again
> before the PR opens.

## What is here

| File | Replaces the direct writes in |
| --- | --- |
| `src/features/teacher/actions.ts` | `createHomeworkTopic`, `updateHomeworkTopic`, `deleteHomeworkTopic` (W-01…W-03) |
| `src/features/teacher/vocabularyActions.ts` | `generateWordImage`'s cache upsert (W-05), `publishVocabulary` (W-06…W-09), `clearVocabulary` (W-10…W-11) |
| `src/features/teacher/grammarActions.ts` | `publishGrammar` (W-12…W-15), `clearGrammar` (W-16…W-17) |
| `src/features/homework/qa/actions.ts` | `postTopicMessage` (W-18), `markTopicRead` (W-19), `deleteTopicMessage` (W-20) |
| `src/features/onboarding/actions.ts` | `createProfile`'s two inserts (W-21, W-22) |
| `src/lib/testSupabase.ts` | test-only helper the five `*.test.ts` files below share |
| `src/features/**/*.test.ts` | one success path and one authorization-failure path per file, per `SCN-12`'s acceptance criteria |

Every other export in these five files — `generateVocabularyDraft`,
`generateWordImage`'s AI call and Storage upload, `generateGrammarDraft`,
`copyVocabularyFromTopic`, `copyGrammarFromTopic` — is unchanged. They write
nothing (or, for the Storage upload, write something no `SECURITY DEFINER`
function can), so there is no direct table write for a `WP-2.3` RPC to
replace. See the "out of scope" notes inline in each file.

## What changed, file by file

Each function keeps its exported name, parameters and return type — callers
(forms, client components) need no changes. Inside, every direct
`.from(table).insert(...)/.update(...)/.delete(...)/.upsert(...)` write named
in [`MIGRATIONS-NEEDED.md`](../../MIGRATIONS-NEEDED.md) is replaced by exactly
one `supabase.rpc(...)` call to the function `SCN-11` wrote for it, using the
mapping table in [`UPSTREAM-PR-WP-2.3.md`](../../UPSTREAM-PR-WP-2.3.md#thin-callers--the-typescript-side).

What is deliberately **not** touched:

- **Read paths.** `requireTeacher()`, `requireTopicAccess()`, the
  `.from("profiles")` / `.from("homework_topics")` ownership reads inside
  them, `supabase.auth.getUser()`, and every `.select()` (including the two
  `copy*FromTopic` reuse actions) stay exactly as they were. `SCN-12` is
  scoped to writes; the reads were never the problem and RLS already governs
  them.
- **Client-side validation and error strings.** `parseNonNegativeInt`,
  `parseOptionalUrl`, the word/point trimming and filtering, `checkUsername`,
  the age range, the level re-check — all unchanged, so a signed-in web user
  sees the identical message at the identical moment they do today. The RPCs
  re-validate the same rules in SQL; that copy is what makes the guarantee
  hold for a caller that never runs this file, i.e. the native app.
- **`generateWordImage`'s Storage upload (W-04).** Still a direct
  `supabase.storage.from("content").upload(...)`. An object upload cannot run
  inside a Postgres function; it moves server-side in `WP-5.6`
  ([`UPSTREAM-PR-WP-5.6.md`](../../UPSTREAM-PR-WP-5.6.md)), not here.

## Behaviour changes a reviewer should expect

These are the same four differences `docs/changes/SCN-11.md` documents for the
SQL, now visible from the TypeScript side:

- `updateHomeworkTopic` on a topic the caller doesn't own: was
  `{ success: 'Topic "…" updated.' }` with nothing changed, now
  `{ error: "Topic not found or not yours to edit." }`.
- `deleteTopicMessage` on a message the caller may not delete: was
  `{ ok: true }` with nothing changed, now
  `{ ok: false, error: "That message is not yours to delete." }`. The UI only
  renders the delete button on the caller's own messages, so no legitimate
  flow sees this.
- `publishVocabulary` / `publishGrammar` failing partway through: was
  sometimes a topic left with no words/points (the four round-trips were not
  transactional); now the single RPC call either fully succeeds or changes
  nothing.
- A vocabulary/grammar task list over 20 items: was silently clamped; the
  action already clamps to `MAX_TASK_COUNT` / `MAX_GRAMMAR_TASKS` before
  calling the RPC, so this path is unreachable from the web UI — it only
  matters for a caller that skips this file.

`AC6` still holds: nothing here touches a policy, and the tests below assert
behaviour, not SQL.

## Tests

`SCN-12` step 4 asks for "at least one success and one authorization failure
path per action area." The web repository has no existing pattern for testing
a Server Action against a mocked Supabase client — every `*.test.ts` upstream
today covers pure logic modules — so `src/lib/testSupabase.ts` introduces the
smallest mock that fits what these five files call:
`.auth.getUser()`, `.from(table).select().eq().order().maybeSingle()` (one
canned row per table), and `.rpc(name, args)`. Extend it if a future action
needs a shape it doesn't cover.

**These tests have not been run.** This repository's `vitest.config.mts`
scopes to `packages/**` and has no `@/ -> src/` alias into a Next.js tree, so
there is nothing here to execute them against — the runtime they need
(`next/cache`, `next/navigation`, the real `@/lib/supabase/server`,
`@/features/levels/queries`, …) only exists in the web repository. Run them
there, from the web repo's own `vitest.config.ts`, once these files are copied
into place:

```bash
npx vitest run src/features/teacher/actions.test.ts \
  src/features/teacher/vocabularyActions.test.ts \
  src/features/teacher/grammarActions.test.ts \
  src/features/homework/qa/actions.test.ts \
  src/features/onboarding/actions.test.ts
```

## Deployment order

Same as `docs/migrations/wp-2.3/README.md` §Order: these callers must be
deployed *after* migrations 1/4–3/4 (the additive RPCs) are live, and *before*
migration 4/4 (the grant revoke) is applied — otherwise the window between
"RPCs exist" and "web calls them" is also the window where 4/4 would break the
still-deployed direct-write code. `docs/UPSTREAM-PR-WP-2.3.md`'s *Deployment*
section already sequences this correctly; nothing here changes that order.
