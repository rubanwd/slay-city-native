# Edge Functions plan — OpenRouter AI drafting

> `SCN-7` · planning only, **no function is implemented by this document**.
> Read against `rubanwd/slay-city` @ `7612da5` (2026-09-19).
> Answers **OD-1** (§2) and specifies `WP-5.6` (docs/WORK-PACKAGES.md).
> Sibling of [MIGRATIONS-NEEDED.md](MIGRATIONS-NEEDED.md), which covers the
> *write* half of the same teacher console. The PR that implements this is
> staged in [UPSTREAM-PR-WP-5.6.md](UPSTREAM-PR-WP-5.6.md).

---

## 1. Why this exists

`OPENROUTER_API_KEY` is read with `process.env` inside Next.js Server Actions.
That is safe on the web: the code runs on a server the user does not control.
There is no equivalent on a phone. Whatever the mobile teacher console does, the
device does — holding the public anon key, a user JWT, and nothing else.

A key compiled into an `.ipa` or an `.aab` is extractable in minutes and bills to
the project owner's OpenRouter account. So the key does not move to the phone;
the *call* moves off the client entirely, into Supabase Edge Functions that both
apps invoke. See `R9` in [RISKS.md](RISKS.md).

---

## 2. OD-1 — **APPROVED**

| | |
| --- | --- |
| **Decision** | Move OpenRouter calls out of Next.js Server Actions into Supabase Edge Functions. Option **(a)**. |
| **Status** | **APPROVED** — 2026-09-29 |
| **Rationale** | **API key cannot ship in a mobile binary.** |
| **Blocks released** | `P7`, `P8`, `WP-5.6` |

### 2.1 The locked rule this changes

The root manual — `rubanwd/slay-city` `AGENTS.md` — states the rule twice, and
lists it under *What Not to Change Without Permission*:

> **AGENTS.md:303** — "**Never expose the OpenRouter API key to the frontend.**
> All OpenRouter calls must go through Next.js Server Actions (this project does
> not use OpenAI or an Edge Function for this)."
>
> **AGENTS.md:482** — "The decision to call OpenRouter exclusively from Next.js
> Server Actions (never OpenAI, never from the browser)."

This repository's own `AGENTS.md` opens by stating that the root manual "is the
product's constitution and this repository does not get to amend it". The
amendment therefore lands **in the web repository, in the same pull request as
the functions** — not here. This document only records the approval and the
replacement wording.

### 2.2 Replacement wording for the root manual

`AGENTS.md:303` becomes:

> **Never expose the OpenRouter API key to any client.** All OpenRouter calls go
> through Supabase Edge Functions (`draft-vocabulary`, `draft-grammar`,
> `generate-image`), which read the key from Supabase Secrets and re-check the
> caller's role in SQL before spending money. The web's Server Actions are thin
> callers of those functions and keep their existing signatures. This project
> does not use OpenAI.

`AGENTS.md:482` becomes:

> The decision to call OpenRouter exclusively from Supabase Edge Functions
> (never OpenAI, never from a browser or a mobile binary) — amended from
> "Server Actions" on 2026-09-29 per `OD-1`, because the key cannot ship in a
> mobile binary.

`AGENTS.md:463` (the technology paragraph) keeps its model and tier detail
verbatim; only "It is called exclusively from Next.js Server Actions … It is
never called from the browser" is replaced by the sentence above.

### 2.3 What stays true

The intent of the locked rule is unchanged and, in fact, strengthened: the key
becomes *less* reachable, not more. It moves from Vercel environment variables —
readable by anything running in the Next.js server process — to Supabase
Secrets, readable only inside the Deno function. The rule that OpenRouter is
never called from a client is not relaxed; it is extended to cover a client the
rule was written before.

---

## 3. What calls OpenRouter today

### 3.1 The file set

`docs/ARCHITECTURE.md` §3 and `docs/MIGRATION-MAP.md` §2 both say "Category C —
OpenRouter AI generation (**6 files**)" but list different sets (3 teacher files,
or 3 teacher + 4 admin). The actual set of source files reachable from a
**teacher** drafting action is six, and it crosses the `teacher/` → `admin/`
boundary:

| # | File | LOC | Role in the flow |
| --- | --- | --- | --- |
| 1 | `src/features/teacher/openRouterChat.ts` | 88 | The text transport. `requestOpenRouterJson(prompt)` + `extractJson(raw)`. Holds the key. |
| 2 | `src/features/teacher/vocabularyPrompt.ts` | 71 | `buildVocabularyPrompt()`, `buildWordImagePrompt()` — pure, no I/O |
| 3 | `src/features/teacher/grammarPrompt.ts` | 64 | `buildGrammarPrompt()` — pure, no I/O |
| 4 | `src/features/teacher/vocabularyActions.ts` | 361 | `generateVocabularyDraft()` (text) and `generateWordImage()` (image + cache + upload) |
| 5 | `src/features/teacher/grammarActions.ts` | 245 | `generateGrammarDraft()` (text) |
| 6 | `src/features/admin/openRouterImage.ts` | ~200 | The image transport. Also holds the key. **Imported directly by #4** — this is why it is in the teacher set, not just the admin set. |

Two test files cover them: `teacher/vocabularyPrompt.test.ts` (68 LOC, also
tests `extractJson`) and `teacher/grammarPrompt.test.ts` (36 LOC). There are no
tests for the transports or the actions.

Four **admin-only** callers of `openRouterImage.ts` —
`generateLocationIcon.ts`, `generateMapBackground.ts`, `generateTaskImage.ts`,
`missionImageActions.ts` — are not ported (Category D) but are affected anyway,
because the key they read moves out from under them. §4.4.

Two **parsers** live outside the six, in code the mobile app shares:
`parseGeneratedWords()` in `src/features/homework/vocabulary.ts:295` and
`parseGeneratedGrammar()` in `src/features/homework/grammar.ts:157`. They are
what turns the model's JSON into a draft. §4.5 decides where they end up.

> **Correct the counts when those files are next touched**, the same way SCN-6
> corrected "32 direct writes". "Six files" is right; the lists are not.

### 3.2 Request parameters, exactly as sent

**Text** — `openRouterChat.ts`:

| | |
| --- | --- |
| URL | `https://openrouter.ai/api/v1/chat/completions` |
| Method | `POST` |
| `model` | `process.env.OPENROUTER_TEXT_MODEL \|\| "google/gemini-2.5-flash"` |
| `messages` | `[{ role: "user", content: prompt }]` — single turn, no system message |
| `response_format` | `{ type: "json_object" }` |
| Headers | `Authorization: Bearer ${OPENROUTER_API_KEY}`, `Content-Type: application/json`, `X-Title: "SLAY CITY Teacher"` |
| Timeout | `AbortSignal.timeout(60_000)` |
| Not sent | `temperature`, `max_tokens`, `top_p`, `provider`, `stream`, `usage` |

**Image** — `openRouterImage.ts`, reached from `generateWordImage()`:

| | |
| --- | --- |
| URL | same |
| `model` | `OPENROUTER_IMAGE_MODEL \|\| "google/gemini-2.5-flash-image"` (per-call override supported) |
| `modalities` | `["image", "text"]` |
| `provider` | routing built from `OPENROUTER_IMAGE_PROVIDER ?? "google-ai-studio/flex"`, fallbacks **on** |
| Headers | same, `X-Title: "SLAY CITY"` |
| Timeout | `AbortSignal.timeout(90_000)` |
| Response handling | reads `choices[0].message.images[0].image_url.url`; a hosted URL is re-fetched and re-encoded so the caller always gets a `data:` URL. Logs `service_tier`, `provider` and `usage.cost`, warning when flex fell back to the standard tier. |

The flex tier is a deliberate cost decision documented at length in
`openRouterImage.ts` (~$0.019 vs ~$0.039 per 1024px image). **It must survive
the move**, including the fallback-detection logging — that log is the only
signal that images have quietly started costing full price.

### 3.3 The three server entry points

| Entry point | Input | Guard | Pipeline | Output |
| --- | --- | --- | --- | --- |
| `generateVocabularyDraft` | `{ topicId, topicTitle, topicDescription, extraInstructions, wordCount }` | `requireTopicAccess` | `clampWordCount` (1–20) → `buildVocabularyPrompt` → `requestOpenRouterJson` → `extractJson` → `parseGeneratedWords` | `{ ok: true, words: VocabDraftWord[] }` |
| `generateGrammarDraft` | `{ topicId, topicTitle, topicDescription, extraInstructions, pointCount, taskCount }` | `requireTopicAccess` | `clampGrammarPointCount` (1–20), `taskCount` clamped 0–20 → `buildGrammarPrompt` → `requestOpenRouterJson` → `extractJson` → `parseGeneratedGrammar` | `{ ok: true, points, tasks }` |
| `generateWordImage` | `{ topicId, word, imagePrompt, forceRegenerate? }` | `requireTopicAccess` | read-through `vocab_image_cache` on `normalizeWordKey(word)` → `buildWordImagePrompt` → `requestOpenRouterImage` → upload to `content/homework/<uuid>.<ext>` → upsert cache | `{ ok: true, imageUrl }` (public storage URL) |

None of the three writes anything the teacher has not reviewed —
`generateVocabularyDraft` and `generateGrammarDraft` write **nothing at all**.
`generateWordImage` writes only the Storage object and the shared cache row
(`V1`/`V2` in MIGRATIONS-NEEDED.md §3.1).

`requireTopicAccess` = `requireTeacher()` (`profiles.role = 'teacher'`, **or**
`role = 'admin'` with a `view-as-teacher` **cookie**) + a `SELECT` on
`homework_topics` that RLS scopes to the owner.

### 3.4 The guard does not hold — MIGRATIONS-NEEDED.md §6.2

`homework_topics_select` grants `is_group_member(group_id)`. **Every student in
the group can already read every one of their teacher's topics.** The topic
lookup therefore proves nothing about the caller, and `requireTeacher()` alone
stands between a student and an OpenRouter bill. Nothing else can: these calls
write nothing before spending money, so no RLS policy is in the path.

This is the single most important requirement on the new functions:

> **Re-check role and topic ownership in SQL, inside the function, before any
> outbound request.** Failing the Storage write or the cache write afterwards is
> not a mitigation — the money is spent at the API call.

Also note the cookie. `readViewAsTeacherId()` reads
`next/headers`, which does not exist in Deno and has no mobile equivalent. The
admin "view as teacher" path must become an explicit, server-verified request
field. §4.2.

### 3.5 The UI callers, and what the shapes have to support

`VocabularyManager.tsx` (632 LOC, `WP-5.3`):

- `handleGenerateDraft()` → one `draft-vocabulary` call, then — if the
  "auto images" toggle is on — a fire-and-forget batch of up to **20**
  `generateWordImage()` calls at `IMAGE_CONCURRENCY = 3`, streaming images into
  the list while the teacher reviews the words.
- `handleGenerateImage(word)` → one image call, `forceRegenerate: true` when the
  word already shows an image (the teacher wants a different one).

`GrammarManager.tsx` (383 LOC, `WP-5.4`):

- `handleGenerate()` → one `draft-grammar` call, replacing points *and* tasks.
- `handleRegenerateTest()` → **a second identical `draft-grammar` call** that
  keeps only `tasks`, leaving the teacher's edited points alone. A full-price
  call for half a result. Worth noting for the rate-limit budget in §6, and
  worth a `points_only: false` style flag later — out of scope for `WP-5.6`.

Every failure is surfaced with `toast.error(result.error)` and nothing else
changes — the draft the teacher already had stays on screen. That degradation
behaviour is an acceptance criterion of `WP-5.6` and must be preserved on both
platforms.

---

## 4. The proposed functions

### 4.1 Layout upstream

```
supabase/functions/
├── _shared/
│   ├── openrouter.ts        # requestOpenRouterJson / requestOpenRouterImage (Deno)
│   ├── teacherAuth.ts       # resolveTeacherCaller(req) → { userId, teacherId }
│   ├── rateLimit.ts         # claim_ai_generation RPC wrapper
│   ├── response.ts          # jsonResponse / errorResponse, shared taxonomy
│   └── prompts/
│       ├── vocabularyPrompt.ts + .test.ts
│       └── grammarPrompt.ts  + .test.ts
├── draft-vocabulary/{index.ts, index.test.ts}
├── draft-grammar/{index.ts, index.test.ts}
├── generate-image/{index.ts, index.test.ts}
└── update-streak/           # existing — the template to copy
```

`update-streak/index.ts` is the house style and should be followed literally:
resolve the caller from their JWT with an **anon-key** client, never trust an id
from the body, and only then switch to a **service-role** client for privileged
work. Its dependency-free `streak.ts` split — so the logic is unit-testable
under Node while the handler runs under Deno — is the same split `prompts/`
gets here.

### 4.2 `draft-vocabulary`

```
POST /functions/v1/draft-vocabulary
Authorization: Bearer <user JWT>
Content-Type: application/json
```

```jsonc
{
  "topic_id": "uuid",                 // required
  "extra_instructions": "string|null", // optional, ≤500 chars after cleaning
  "word_count": 8,                    // optional, clamped 1–20, default 8
  "act_as_teacher_id": "uuid|null"    // optional, admins only — replaces the cookie
}
```

`200`:

```jsonc
{
  "words": [
    {
      "word": "apple",
      "transcription": "/ˈæp.əl/",
      "translation": "яблуко",
      "exampleSentence": "I eat an apple every day.",
      "imagePrompt": "a shiny red apple on a white background"
    }
  ]
}
```

The response body is exactly `VocabDraftWord[]` under a `words` key —
`camelCase`, matching the existing TypeScript interface rather than the
`snake_case` of the request. The request is a wire contract; the response is a
domain object the UI already knows how to render.

**`topic_title` and `topic_description` are deliberately not accepted.** Today
the browser sends them and they go straight into the prompt. The function reads
them from `homework_topics` itself, in the same query that proves ownership.
This removes a prompt-injection surface (a forged title is a forged prompt),
removes a round-trip's worth of trust, and makes the request small enough to log.

Handler, in order — the order is the security property:

1. `req.method === "POST"`, else `405`.
2. `Authorization` header present, else `401`.
3. Resolve the caller with the anon client (`auth.getUser()`), else `401`.
4. Parse and validate the body: `topic_id` a uuid, `word_count` finite, `extra_instructions` a string or null. Else `400`.
5. **Resolve `teacherId`**: the caller's own id when `profiles.role = 'teacher'`; `act_as_teacher_id` only when `profiles.role = 'admin'` **and** that id is a real teacher. Anything else → `403`.
6. **Ownership**: `homework_topics` row where `id = topic_id` **and**
   `group_id` belongs to a `teacher_groups` row with `teacher_id = teacherId`.
   Missing → `403`. This is the check §3.4 says does not exist today. Returns
   `title` and `description` for the prompt.
7. **Claim rate-limit quota** (§6). Refused → `429` + `Retry-After`.
8. Build the prompt, call OpenRouter, `extractJson`, `parseGeneratedWords`.
9. Empty result → `422`.

Steps 1–7 cost nothing. Step 8 is the only billed line in the function, and
every gate is above it.

### 4.3 `draft-grammar`

```
POST /functions/v1/draft-grammar
```

```jsonc
{
  "topic_id": "uuid",
  "extra_instructions": "string|null",
  "point_count": 4,                  // clamped 1–20 (MIN/MAX_GRAMMAR_POINTS)
  "task_count": 3,                   // clamped 0–20 (MAX_GRAMMAR_TASKS)
  "act_as_teacher_id": "uuid|null"
}
```

`200`:

```jsonc
{
  "points": [
    { "title": "Present Simple: he/she/it + s", "explanation": "…", "example": "She goes to school." }
  ],
  "tasks": [
    { "taskType": "fill_blank", "content": { "sentence": "She ___ to school.", "answer": "goes", "options": ["goes","go","going","gone"] } }
  ]
}
```

`tasks` is `GrammarDraftTask[]` — already mapped to `MissionTaskType` and
validated by `parseGeneratedGrammar`, which drops malformed entries rather than
throwing. A response with `points: []` is a `422`; `tasks: []` with non-empty
`points` is a **success** — that is the current behaviour and the manager
handles it.

Handler is identical to §4.2 step for step, with `buildGrammarPrompt` and
`parseGeneratedGrammar` substituted.

### 4.4 `generate-image` — same PR, separate function

Not one of the two the ticket names, and its admin callers are never ported. It
is in scope for the PR anyway for one reason: **the teacher vocabulary flow
calls it**, and the key cannot move for two of three callers.

```
POST /functions/v1/generate-image
{ "topic_id": "uuid", "word": "apple", "image_prompt": "…|null", "force_regenerate": false }
→ { "image_url": "https://…/storage/v1/object/public/content/homework/<uuid>.png", "cached": true|false }
```

Same gate chain, plus:

- The `vocab_image_cache` read happens **before** the quota claim, so a cache hit
  costs neither money nor quota. `cached: true` tells the client so.
- The Storage upload uses the **service-role** client, so `V1`'s folder-wide
  `content_insert_teacher_homework` policy stops being the authorisation. The
  function should write `homework/<teacherId>/<uuid>.<ext>` instead of
  `homework/<uuid>.<ext>` — a free fix for MIGRATIONS-NEEDED.md §7.1's
  "any teacher may overwrite any teacher's image". Existing objects stay where
  they are; the column holds absolute URLs.
- The cache upsert keeps its non-fatal semantics (`console.warn`, return the
  image anyway).

An **admin** variant (`kind: "location_icon" | "map_background" | "task_image"`,
gated on `is_admin()`) is the same function with a different guard and prompt
source. Recommended as a follow-up PR, not this one — the admin console is
web-only, so nothing is blocked by deferring it. What must **not** happen is the
key living in two places; if the admin callers stay on `process.env` after this
PR, that is a documented, dated, tracked exception.

### 4.5 Where the prompts and parsers live

`buildVocabularyPrompt`, `buildGrammarPrompt`, `parseGeneratedWords` and
`parseGeneratedGrammar` all have to run inside the function. Three options:

| | Approach | Verdict |
| --- | --- | --- |
| a | Deno imports them in place from `src/features/**` with explicit `.ts` specifiers | Rejected — the modules use extensionless relative imports and `@/` path aliases that Deno does not resolve, and the type imports chain into `src/types`. It would work for exactly as long as nobody adds an import. |
| b | Copy into `supabase/functions/_shared/`, leave `src/` untouched | Rejected — two copies of a prompt is the same failure mode `packages/core` exists to prevent, one repository over. |
| c | **Move** them into `supabase/functions/_shared/`, with their tests; the web's `src/` deletes its copies because its Server Actions no longer build prompts or parse model output | **Recommended** |

(c) is possible precisely because the Server Actions become thin callers. After
the move, `vocabularyActions.ts` no longer imports `buildVocabularyPrompt` or
`parseGeneratedWords`; it invokes the function and returns what comes back.
`src/features/homework/vocabulary.ts` keeps everything else it exports
(`buildVocabTest`, `clampWordCount`, `normalizeWordKey`,
`defaultTestTaskCount`) — those drive the browser UI and are unrelated.
`teacher/vocabularyPrompt.test.ts` and `teacher/grammarPrompt.test.ts` move with
the code and must keep passing under `deno test` with no assertion changed.

`clampWordCount` / `clampGrammarPointCount` are the one genuine duplication: the
UI clamps for the input control, the function must clamp again because it cannot
trust the client. Four lines of `Math.min(Math.max())` each, and re-deriving them
in Deno is cheaper than sharing them. State that in a comment rather than
leaving a reviewer to wonder.

**None of this reaches this repository.** The native app never builds a prompt
and never parses a model response — it reads a typed JSON response. This
sub-decision is the web repository's alone and does not block `WP-5.6` here.

---

## 5. Error handling

### 5.1 One taxonomy, three functions

Every non-2xx response is `{ "error": { "code": "…", "message": "…" } }`.
`code` is for the client to branch on; `message` is shown to the teacher.

| `code` | HTTP | Cause | `message` |
| --- | --- | --- | --- |
| `method_not_allowed` | 405 | not `POST` | — |
| `unauthorized` | 401 | missing / invalid / expired JWT | "Your session expired. Sign in again." |
| `forbidden` | 403 | not a teacher; topic not owned; non-admin sent `act_as_teacher_id` | "Only teachers can manage homework." / "Topic not found or not yours to edit." |
| `invalid_request` | 400 | unparseable body, bad uuid, non-finite count | "Something was wrong with that request. Try again." |
| `rate_limited` | 429 | §6 quota; `Retry-After` header set | "You've generated a lot recently. Try again in N minutes." |
| `not_configured` | 500 | `OPENROUTER_API_KEY` absent from Supabase Secrets | **"AI generation is not configured on this server."** |
| `upstream_timeout` | 504 | `AbortSignal.timeout` fired | **"The AI model took too long. Try again."** |
| `upstream_unreachable` | 502 | `fetch` threw for any other reason | **"Could not reach the AI model. Check your connection."** |
| `upstream_error` | 502 | OpenRouter non-2xx | OpenRouter's own `error.message`, verbatim — it is the only thing that says *bad key* / *no credit* / *provider rate limit* |
| `unreadable_response` | 502 | response body was not JSON | **"AI model returned an unreadable response (N)."** |
| `empty_response` | 502 | no `choices[0].message.content` | **"The model returned no content. Try again."** |
| `unusable_response` | 422 | parsed to zero words / zero points | **"The AI didn't return any usable words. Try again."** / "…grammar points…" |
| `internal` | 500 | anything unhandled | "Something went wrong. Try again." |

The **bolded** strings are the ones that exist today, character for character.
Moving the call must not change a single word a teacher reads — the web UX is
the regression baseline for this PR. The unbolded ones are new because the
failure mode is new.

### 5.2 Retries

**No automatic retry on any billed call, at any layer.** A `fetch` timeout does
not mean the request was not served — OpenRouter may have generated and billed
a response that never arrived. An automatic retry doubles the bill silently.
The teacher's "Generate" button is the retry, and a 429 is the thing that stops
them from holding it down.

`401` is the one exception, and it is handled beneath this contract:
`supabase-js` refreshes an expired token and reissues the request itself. If a
`401` still surfaces, the session is genuinely gone and the client routes to
sign-in.

### 5.3 Degradation

`WP-5.6`'s acceptance criterion is "failures degrade to manual authoring". In
practice, on both platforms:

- A failed draft leaves the existing draft on screen untouched. Nothing is
  cleared, nothing is written.
- Manual add / edit / publish stay enabled while a generate is in flight and
  after it fails. The AI button is an accelerator, never a prerequisite.
- A failed image leaves the word imageless. `publishVocabulary` already accepts
  `image_url: null`; imageless words are normal, not an error state.
- `runBackgroundImages` already counts failures and reports them once, at the
  end, as "N images couldn't be generated. Use the AI button to retry." Keep it.

### 5.4 Observability

Log per call, structured, from inside the function: `kind`, `user_id`,
`teacher_id`, `topic_id`, outcome code, `duration_ms`, and for images
`service_tier` / `provider` / `usage.cost` with the existing flex-fallback
warning. Never log the prompt (it contains teacher-authored text) and never log
the response body.

---

## 6. Rate limiting

### 6.1 Why it is part of this PR and not a follow-up

There is **nothing** in the migration timeline today that bounds AI spend —
`grep -rl "rate_limit" supabase/migrations/` returns nothing. The only limit is
that a teacher has to click. MIGRATIONS-NEEDED.md §6.2 lists the limit as a
`WP-5.6` requirement, "as acceptance criteria rather than as an afterthought",
and a mobile app makes the click cheaper: a script holding a valid teacher JWT
can drive the endpoint as fast as it responds.

### 6.2 The ledger

New table, in the **web repository's** migration timeline:

```sql
create table public.ai_generation_events (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid not null,
  kind       text not null check (kind in ('draft_vocabulary','draft_grammar','generate_image')),
  topic_id   uuid references public.homework_topics(id) on delete set null,
  created_at timestamptz not null default now()
);

create index ai_generation_events_user_created_idx
  on public.ai_generation_events (user_id, kind, created_at desc);

alter table public.ai_generation_events enable row level security;
-- No policies and no grants to anon/authenticated. Only the service-role client
-- inside the Edge Function ever touches it.
```

RLS on with zero policies is the correct configuration, not an oversight: it
means a direct PostgREST call cannot read the ledger, cannot pad it, and cannot
delete from it. Note that for the reviewer, because "enable RLS then write no
policy" reads like an unfinished migration.

### 6.3 The claim

```sql
create or replace function public.claim_ai_generation(
  p_user_id uuid, p_teacher_id uuid, p_kind text, p_topic_id uuid
) returns table (allowed boolean, retry_after_seconds int, remaining_today int)
language plpgsql security definer set search_path = public as $$ … $$;

revoke execute on function public.claim_ai_generation(uuid,uuid,text,uuid) from public, anon, authenticated;
```

Count **and** insert in one statement, not count-then-insert: two concurrent
requests both pass a separate `SELECT count(*)`. The function is callable only
by `service_role`, so it can never be invoked from a client with the anon key —
`claim_ai_generation` granted to `authenticated` would be a hole, not a limit.

### 6.4 Budgets

Per **teacher**, per `kind`. These are opening numbers to be tuned from the
ledger after a month, not constants to defend:

| `kind` | / minute | / hour | / day |
| --- | --- | --- | --- |
| `draft_vocabulary` | 5 | 40 | 200 |
| `draft_grammar` | 5 | 40 | 200 |
| `generate_image` | **25** | 200 | 600 |

The image per-minute figure is not a guess. `handleGenerateDraft()` with
auto-images on fires up to **20** image calls immediately after a draft, at
`IMAGE_CONCURRENCY = 3`. Any per-minute image limit below ~20 breaks the
flow the web ships today, and the failure would look like a flaky model rather
than a limit. 25 leaves room for one draft plus a few manual regenerations.

The text limit of 5/minute is deliberately loose for `draft_grammar` because
`handleRegenerateTest()` spends a full draft to keep only the tasks (§3.5) — a
teacher iterating on a test legitimately makes several calls a minute.

A `429` carries `Retry-After` in seconds and a message naming the wait, so the
UI can say something true instead of "try again later".

### 6.5 The global brake

Per-teacher limits bound one compromised account, not the bill. Add a
project-wide daily ceiling read from the same ledger — one `count(*)` over
`created_at > now() - interval '1 day'`, no `user_id` filter. Above the ceiling,
every call gets `rate_limited` and the function logs at `error` level. Set it
well above plausible legitimate use; it is a circuit breaker, not a quota.

### 6.6 Caching is the cheapest limiter

`vocab_image_cache` already means a common word is generated once across the
whole product, and MIGRATIONS-NEEDED.md §3.1 `V2` confirms the policies for it
exist. Keep the read *before* the quota claim (§4.4) so reuse is free in both
senses. No equivalent cache is proposed for text — drafts are topic-specific and
a teacher expects a fresh set.

---

## 7. How the native app calls them

### 7.1 Transport

`supabase-js` ships a functions client, and the mobile client from
`src/lib/supabase.ts` already carries the session:

```ts
const { data, error } = await db.functions.invoke("draft-vocabulary", {
  body: { topic_id: topicId, extra_instructions: extra, word_count: count },
});
```

The `Authorization: Bearer <access token>` header is attached from the session
automatically — the JWT is never read out of SecureStore by app code, which is
what `AGENTS.md` wants.

**The error path is the part that gets written wrong.** `invoke()` does not put
a non-2xx body in `error.message`; it returns a `FunctionsHttpError` whose
response has to be read:

```ts
import { FunctionsHttpError } from "@supabase/supabase-js";

if (error) {
  if (error instanceof FunctionsHttpError) {
    const body = (await error.context.json()) as { error?: { code?: string; message?: string } };
    return { ok: false, code: body.error?.code ?? "internal", message: body.error?.message ?? fallback };
  }
  // FunctionsFetchError (offline) / FunctionsRelayError
  return { ok: false, code: "upstream_unreachable", message: "Could not reach the AI model. Check your connection." };
}
```

Without that, every one of §5.1's messages collapses into
"Edge Function returned a non-2xx status code" and the taxonomy is wasted.

### 7.2 Where the wrapper lives

In `@slay/data`, following the convention `packages/data/src/index.ts` already
documents — client injected as the first argument, never constructed:

```ts
export async function draftVocabulary(
  db: SupabaseClient<Database>,
  input: DraftVocabularyInput,
): Promise<DraftVocabularyResult>;

export async function draftGrammar(
  db: SupabaseClient<Database>,
  input: DraftGrammarInput,
): Promise<DraftGrammarResult>;

export async function generateWordImage(
  db: SupabaseClient<Database>,
  input: GenerateWordImageInput,
): Promise<GenerateWordImageResult>;
```

`AGENTS.md` says a screen never writes a raw `.from()` query. The same applies
to `functions.invoke` — a screen calls `@slay/data`, which owns the function
name, the snake_case wire shape and the `FunctionsHttpError` unwrapping.

The request/response **types** belong in `packages/core`
(`features/teacher/aiDrafting.ts`), because they are a contract both front ends
share. They go into `packages/core/.upstream.json` once the same file exists
upstream; until the PR lands they are native-only and untracked, and
`docs/SYNC.md` §6's "signatures differ from upstream by design" does **not**
cover them — these must not differ.

### 7.3 In the screens

- **`useMutation`, never `useQuery`.** The call is billed and non-idempotent;
  nothing about it is a cacheable read.
- **`retry: false`**, per §5.2.
- No `invalidateQueries` after a draft — it writes nothing. After
  `publishVocabulary` / `publishGrammar`, yes.
- A 60–90 s call needs the screen to survive backgrounding. `useMutation`'s
  promise does not care, but the loading UI must, and any progress ticker uses
  `useAppStateAwareInterval` like every other timer.
- `runBackgroundImages`'s 3-way concurrency ports as-is. It is well under the
  25/minute budget and is what keeps images streaming in while the teacher reads
  the word list.
- Manual authoring stays reachable throughout (§5.3).

### 7.4 Configuration

| Where | Key | Change |
| --- | --- | --- |
| Supabase Secrets | `OPENROUTER_API_KEY` | **new** — `supabase secrets set`, the only copy once the cutover completes |
| Supabase Secrets | `OPENROUTER_TEXT_MODEL`, `OPENROUTER_IMAGE_MODEL`, `OPENROUTER_IMAGE_PROVIDER` | moved; same names, same defaults, so a deploy-time model change stays a deploy-time change |
| Vercel env | `OPENROUTER_API_KEY` | **deleted** after the Server Actions are thin callers and verified |
| `supabase/config.toml` | `[functions.draft-vocabulary]` etc. | `verify_jwt` **on** (the default) — the function needs the caller's identity and must never be anonymous |
| This repository | — | **nothing.** No new env var, no `.env.example` entry, no key. That is the point. |

### 7.5 Verification

`R9` and `WP-5.6` both require it, and it is the acceptance check that actually
proves OD-1 was honoured:

```bash
eas build --profile preview --platform android
unzip -p build.aab | strings | grep -i -e 'sk-or-' -e 'openrouter.ai' -e 'OPENROUTER'   # must be empty
```

Same for the `.ipa`. Empty output is the pass condition; anything else fails
`WP-5.6` regardless of whether the feature works.

---

## 8. Order of work

1. **Land the PR upstream** ([UPSTREAM-PR-WP-5.6.md](UPSTREAM-PR-WP-5.6.md)) —
   functions, the ledger migration, the `AGENTS.md` amendment, and the Server
   Actions rewritten as thin callers. The web keeps working identically; that is
   the review's main assertion.
2. **Verify on the web first.** Drafting through the deployed functions in the
   browser exercises the whole path with a UI that already exists. Any bug found
   there is a bug not found on a phone.
3. **Delete the Vercel key**, then re-verify. Until this step the old path is
   still reachable and nothing is proven.
4. **`WP-5.6` here**: `@slay/data` wrappers, `packages/core` types, the manager
   screens' AI buttons, and the binary grep from §7.5.
5. **Tune the budgets** from `ai_generation_events` after a month of real use.
6. **Follow-up PR** for the admin `generate-image` variant (§4.4), closing the
   last `process.env.OPENROUTER_API_KEY` read in the web repository.

Steps 1–3 are cross-repository work and are reviewed as changes to the live
product, exactly as `ROADMAP.md` §"Cross-repository work" describes.

---

## 9. What this plan does not cover

- **The functions themselves.** `SCN-7` is planning. No Deno code is written
  here and none is written in this repository, ever.
- **Cost modelling.** Text drafting is cheap next to images and no per-teacher
  spend forecast was built. The ledger in §6.2 is what makes one possible.
- **The admin image callers' prompts.** `locationIconPrompt.ts`,
  `mapBackgroundPrompt.ts` and `taskImagePrompt.ts` were not read in detail;
  they are Category D and move only in the §8.6 follow-up.
- **Streaming.** The current calls are single-shot and non-streaming, and the
  teacher waits behind a spinner. Streaming a draft word-by-word would be nicer
  and is not in `WP-5.6`.
- **Live verification.** Everything about policies, grants and the absence of
  rate limiting is read from the migration timeline at `7612da5`. Dashboard-made
  changes would not appear.
- **`generate-image` for admins.** §4.4 — deferred by choice, tracked in §8.
