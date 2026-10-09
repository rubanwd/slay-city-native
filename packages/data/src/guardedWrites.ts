import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, KnowledgeLevel, MissionTaskType } from "@slay/core/types";

/**
 * Wrappers for the twelve `SECURITY DEFINER` RPCs staged in
 * `docs/migrations/wp-2.3/` — the teacher-authoring, homework Q&A and
 * onboarding writes that the web app performs as direct table writes behind a
 * TypeScript role guard (`requireTeacher`, `requireTopicAccess`) that only
 * exists on the Next.js server. The phone talks to PostgREST with the public
 * anon key and never runs that guard, so each of those writes re-checks the
 * caller's role and the record's ownership in SQL instead.
 *
 * **Nothing in this file works yet, and nothing imports it.** The functions do
 * not exist in any database until the `WP-2.3` pull request is merged into
 * `rubanwd/slay-city` (see `docs/UPSTREAM-PR-WP-2.3.md`). Calling one today
 * returns a `PGRST202` "function not found" error, which is why `P8`'s screens
 * are blocked on that merge rather than on this file. It is written now so the
 * contract is reviewed alongside the SQL it calls, and so the day the PR lands
 * the only change needed here is deleting {@link callGuardedRpc}'s cast.
 *
 * ## Why the cast
 *
 * `packages/core/src/types/database.ts` is a tracked copy of upstream's
 * generated types (`docs/SYNC.md`), so it lists exactly the functions that
 * exist in the live database — and these twelve do not. Hand-editing it to add
 * them is the one thing this repository forbids: the next
 * `npm run upstream:check` would report drift, and a reviewer could no longer
 * tell a generated type from a guess. So the argument and return shapes are
 * declared here instead, in {@link GuardedRpcs}, and {@link callGuardedRpc}
 * narrows a single untyped `rpc()` call against them. When upstream regenerates
 * `database.ts` after the merge, `db.rpc(...)` type-checks on its own and this
 * indirection becomes dead weight — delete it then, not before.
 *
 * ## Error handling
 *
 * Every wrapper returns the package's usual `{ ok: true } | { ok: false; error }`
 * rather than throwing, and passes the function's own message straight through.
 * The SQL raises the same strings the Server Actions return today, with
 * `22023` for bad input, `42501` for a caller who may not perform the write and
 * `28000` for no session at all — so a native screen can show `error` directly
 * and match the web app word for word.
 */

/* ── Input shapes ──────────────────────────────────────────────────────────── */
//
// snake_case on purpose: these objects are serialised to `jsonb` and read with
// `->>` inside the functions, which look up the column names. Renaming a key
// here to camelCase would silently drop that field at publish time.

/** One row for `homework_vocab_words`, as `publish_homework_vocabulary` reads it. */
export interface VocabularyWordInput {
  word: string;
  transcription?: string | null;
  translation: string;
  image_url?: string | null;
}

/** One row for `homework_grammar_points`, as `publish_homework_grammar` reads it. */
export interface GrammarPointInput {
  title: string;
  explanation: string;
  example?: string | null;
}

/**
 * One row for `homework_vocab_tasks` / `homework_grammar_tasks`.
 *
 * `order_index` is optional: both publish functions fall back to the position
 * in the array, which is what the web actions pass today.
 */
export interface HomeworkTaskInput {
  task_type: MissionTaskType;
  content: Json;
  order_index?: number;
}

/** Fields `create_homework_topic` and `update_homework_topic` share. */
export interface HomeworkTopicFields {
  title: string;
  description?: string | null;
  orderIndex?: number;
  noteLinkUrl?: string | null;
  noteImageUrl?: string | null;
}

/* ── Results ───────────────────────────────────────────────────────────────── */

/** A guarded write that returns nothing on success. */
export type GuardedWriteResult = { ok: true } | { ok: false; error: string };

/** A guarded write that returns the id of the row it created. */
export type GuardedInsertResult = { ok: true; id: string } | { ok: false; error: string };

/* ── The untyped-RPC shim ──────────────────────────────────────────────────── */

/** Argument and return shape of each staged function, keyed by its SQL name. */
interface GuardedRpcs {
  create_homework_topic: {
    args: {
      p_group_id: string;
      p_title: string;
      p_description: string | null;
      p_order_index: number;
      p_note_link_url: string | null;
      p_note_image_url: string | null;
    };
    returns: string;
  };
  update_homework_topic: {
    args: {
      p_topic_id: string;
      p_title: string;
      p_description: string | null;
      p_order_index: number;
      p_note_link_url: string | null;
      p_note_image_url: string | null;
    };
    returns: null;
  };
  delete_homework_topic: { args: { p_topic_id: string }; returns: null };
  cache_vocab_image: { args: { p_word_key: string; p_image_url: string }; returns: null };
  publish_homework_vocabulary: {
    args: { p_topic_id: string; p_words: VocabularyWordInput[]; p_tasks: HomeworkTaskInput[] };
    returns: null;
  };
  clear_homework_vocabulary: { args: { p_topic_id: string }; returns: null };
  publish_homework_grammar: {
    args: { p_topic_id: string; p_points: GrammarPointInput[]; p_tasks: HomeworkTaskInput[] };
    returns: null;
  };
  clear_homework_grammar: { args: { p_topic_id: string }; returns: null };
  post_topic_message: { args: { p_topic_id: string; p_body: string }; returns: string };
  mark_topic_read: { args: { p_topic_id: string }; returns: null };
  delete_topic_message: { args: { p_message_id: string }; returns: null };
  create_my_profile: {
    args: { p_username: string; p_age: number | null; p_level: KnowledgeLevel | null };
    returns: null;
  };
}

/**
 * The one place that steps outside `SupabaseClient<Database>`'s own typing.
 *
 * The client is cast rather than `db.rpc` itself so the call keeps its
 * receiver — an extracted `rpc` reference loses `this` and throws at runtime.
 */
interface UntypedRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: PostgrestError | null }>;
}

async function callGuardedRpc<K extends keyof GuardedRpcs>(
  db: SupabaseClient<Database>,
  fn: K,
  args: GuardedRpcs[K]["args"]
): Promise<{ data: GuardedRpcs[K]["returns"] | null; error: PostgrestError | null }> {
  const { data, error } = await (db as unknown as UntypedRpcClient).rpc(fn, args);
  return { data: data as GuardedRpcs[K]["returns"] | null, error };
}

/** Collapses an RPC outcome that carries no payload into the package's result union. */
function toWriteResult(error: PostgrestError | null): GuardedWriteResult {
  return error ? { ok: false, error: error.message } : { ok: true };
}

/* ── W-01…W-03 · homework topics (upstream features/teacher/actions.ts) ────── */

/**
 * Creates a homework topic in one of the signed-in teacher's own groups and
 * returns its id.
 *
 * Replaces the direct `homework_topics` insert. `can_author_group(p_group_id)`
 * is the boundary: `is_admin() or (is_teacher() and the group's teacher_id =
 * auth.uid())`. `homework_topics_insert_teacher` already checked group
 * ownership, but not the caller's *role* — a student who somehow owned a group
 * row would have passed it — and `order_index` / the two note URLs were
 * validated only in TypeScript.
 */
export async function createHomeworkTopic(
  db: SupabaseClient<Database>,
  groupId: string,
  fields: HomeworkTopicFields
): Promise<GuardedInsertResult> {
  const { data, error } = await callGuardedRpc(db, "create_homework_topic", {
    p_group_id: groupId,
    p_title: fields.title,
    p_description: fields.description ?? null,
    p_order_index: fields.orderIndex ?? 0,
    p_note_link_url: fields.noteLinkUrl ?? null,
    p_note_image_url: fields.noteImageUrl ?? null,
  });

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "The topic could not be created." };

  return { ok: true, id: data };
}

/**
 * Edits a topic the signed-in teacher owns.
 *
 * Behaviour change worth knowing before building a screen on it: the direct
 * UPDATE this replaces was filtered to zero rows by RLS for a non-owning
 * teacher and *reported success* (finding F4). `update_homework_topic` raises
 * `42501` instead, so a failed edit now surfaces as an error.
 */
export async function updateHomeworkTopic(
  db: SupabaseClient<Database>,
  topicId: string,
  fields: HomeworkTopicFields
): Promise<GuardedWriteResult> {
  const { error } = await callGuardedRpc(db, "update_homework_topic", {
    p_topic_id: topicId,
    p_title: fields.title,
    p_description: fields.description ?? null,
    p_order_index: fields.orderIndex ?? 0,
    p_note_link_url: fields.noteLinkUrl ?? null,
    p_note_image_url: fields.noteImageUrl ?? null,
  });

  return toWriteResult(error);
}

/** Deletes a topic the signed-in teacher owns, cascading to its words, tasks and thread. */
export async function deleteHomeworkTopic(
  db: SupabaseClient<Database>,
  topicId: string
): Promise<GuardedWriteResult> {
  const { error } = await callGuardedRpc(db, "delete_homework_topic", { p_topic_id: topicId });
  return toWriteResult(error);
}

/* ── W-05…W-11 · vocabulary (upstream features/teacher/vocabularyActions.ts) ─ */

/**
 * Records a generated illustration against a word so the next teacher to use
 * the same word does not pay for it again.
 *
 * Non-fatal by design: upstream logs a cache failure and still returns the
 * image to the teacher, and a caller here should do the same.
 *
 * The Storage upload that produces `imageUrl` (W-04) is deliberately **not**
 * here — an object upload cannot run inside a Postgres function. It belongs to
 * the `generate-image` Edge Function (`docs/EDGE-FUNCTIONS-PLAN.md`,
 * `docs/UPSTREAM-PR-WP-5.6.md`), which is a second, separate upstream PR.
 */
export async function cacheVocabImage(
  db: SupabaseClient<Database>,
  wordKey: string,
  imageUrl: string
): Promise<GuardedWriteResult> {
  const { error } = await callGuardedRpc(db, "cache_vocab_image", {
    p_word_key: wordKey,
    p_image_url: imageUrl,
  });
  return toWriteResult(error);
}

/**
 * Replaces a topic's whole word list and its generated test in one statement.
 *
 * The four round-trips this replaces (delete words, delete tasks, insert words,
 * insert tasks) ran with no transaction, so a failure after the deletes left a
 * live topic with no words at all — rare in a browser, routine on a phone that
 * gets backgrounded mid-request (finding F3). One function call is atomic, so
 * the failure mode becomes "nothing changed".
 *
 * `tasks` is the finished test. It is built in TypeScript on purpose:
 * `buildVocabTest` is a pure seeded generator shared with the web app, and
 * reimplementing it in SQL would be two sources of truth for one test. The
 * function validates the count (at most 20) and the task types, and rejects an
 * over-long list with `22023` rather than silently clamping it the way the
 * action did — publishing a test the teacher never reviewed is worse than
 * refusing to publish.
 *
 * Words missing `word` or `translation` are dropped before the insert, exactly
 * as upstream drops them, and `homework_vocab_completions` is left untouched so
 * a student who already passed stays passed.
 */
export async function publishHomeworkVocabulary(
  db: SupabaseClient<Database>,
  topicId: string,
  words: VocabularyWordInput[],
  tasks: HomeworkTaskInput[] = []
): Promise<GuardedWriteResult> {
  const { error } = await callGuardedRpc(db, "publish_homework_vocabulary", {
    p_topic_id: topicId,
    p_words: words,
    p_tasks: tasks,
  });
  return toWriteResult(error);
}

/** Removes a topic's words and vocabulary test, preserving student completions. */
export async function clearHomeworkVocabulary(
  db: SupabaseClient<Database>,
  topicId: string
): Promise<GuardedWriteResult> {
  const { error } = await callGuardedRpc(db, "clear_homework_vocabulary", { p_topic_id: topicId });
  return toWriteResult(error);
}

/* ── W-12…W-17 · grammar (upstream features/teacher/grammarActions.ts) ─────── */

/**
 * Replaces a topic's grammar points and its grammar test in one statement.
 *
 * Same shape and the same atomicity fix as {@link publishHomeworkVocabulary}.
 * The one difference is inherited from upstream: a grammar test cannot be
 * generated deterministically, so `tasks` is the teacher-reviewed AI draft and
 * is stored as sent.
 */
export async function publishHomeworkGrammar(
  db: SupabaseClient<Database>,
  topicId: string,
  points: GrammarPointInput[],
  tasks: HomeworkTaskInput[] = []
): Promise<GuardedWriteResult> {
  const { error } = await callGuardedRpc(db, "publish_homework_grammar", {
    p_topic_id: topicId,
    p_points: points,
    p_tasks: tasks,
  });
  return toWriteResult(error);
}

/** Removes a topic's grammar points and grammar test, preserving student completions. */
export async function clearHomeworkGrammar(
  db: SupabaseClient<Database>,
  topicId: string
): Promise<GuardedWriteResult> {
  const { error } = await callGuardedRpc(db, "clear_homework_grammar", { p_topic_id: topicId });
  return toWriteResult(error);
}

/* ── W-18…W-20 · homework Q&A (upstream features/homework/qa/actions.ts) ───── */

/**
 * Posts a message into a topic's thread as the signed-in user and returns its id.
 *
 * Unlike the teacher functions, the boundary here is `can_see_topic` —
 * visibility, not ownership — because a group member asking a question in their
 * own group's thread is the entire point of the thread. What the RPC adds over
 * `hw_messages_insert` is that `author_id` and `created_at` both come from the
 * database: the policy pinned `author_id` but said nothing about `created_at`,
 * so a client could backdate its own message.
 */
export async function postTopicMessage(
  db: SupabaseClient<Database>,
  topicId: string,
  body: string
): Promise<GuardedInsertResult> {
  const { data, error } = await callGuardedRpc(db, "post_topic_message", {
    p_topic_id: topicId,
    p_body: body,
  });

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "The message could not be posted." };

  return { ok: true, id: data };
}

/**
 * Marks a topic's thread read up to now for the signed-in user, clearing its
 * unread badge.
 *
 * `hw_reads_insert_own` only ever checked that `user_id = auth.uid()` and never
 * looked at `topic_id`, so any signed-in user could create a read marker for a
 * topic in a group they have nothing to do with. `mark_topic_read` adds the
 * `can_see_topic` check and takes `last_read_at` from the database clock.
 */
export async function markTopicRead(
  db: SupabaseClient<Database>,
  topicId: string
): Promise<GuardedWriteResult> {
  const { error } = await callGuardedRpc(db, "mark_topic_read", { p_topic_id: topicId });
  return toWriteResult(error);
}

/**
 * Deletes a thread message: the caller's own, or — for the owning teacher or an
 * admin — any message in their topic.
 *
 * The teacher-moderation branch is not new; `hw_messages_delete` has allowed it
 * since `20260722000002_homework_qa.sql`, whose own comment calls it "light
 * moderation without a separate role check". What changes is that a delete the
 * caller may not perform now raises `42501` instead of reporting `{ ok: true }`
 * and removing nothing.
 */
export async function deleteTopicMessage(
  db: SupabaseClient<Database>,
  messageId: string
): Promise<GuardedWriteResult> {
  const { error } = await callGuardedRpc(db, "delete_topic_message", { p_message_id: messageId });
  return toWriteResult(error);
}

/* ── W-21 + W-22 · onboarding (upstream features/onboarding/actions.ts) ────── */

/**
 * Creates the signed-in user's own `profiles` row and its zeroed `user_stats`
 * row, in one transaction.
 *
 * This is the one function in the package that closes a hole rather than making
 * an existing boundary explicit, and the hole is live on the web today
 * (finding F1). `user_stats_insert_own` is `with check (auth.uid() =
 * profile_id)` — it constrains *which row* a caller may insert and never *what
 * is in it*, and there is no CHECK, INSERT trigger or column-level grant behind
 * it. Any user with a profile and no stats row can `POST /rest/v1/user_stats`
 * with whatever `xp`, `coins`, `level` and streaks they like, which breaks the
 * `AGENTS.md` rule that those only ever move server-side. That state is
 * reachable deliberately (create the profile through PostgREST instead of the
 * form) and by accident, because the two inserts it replaces are not
 * transactional.
 *
 * `role` is not a parameter: the function hard-codes `'student'`, so this path
 * cannot mint a teacher. The counters are fixed at `0 / 0 / 1 / 0 / 0` in SQL.
 * `age` is passed through to the column's own CHECK (5–90, upstream's
 * `20261001000001_widen_profile_age_range.sql`) rather than re-validated here,
 * so the column and the form cannot disagree again.
 *
 * A duplicate username propagates as `23505`, which is what lets a caller keep
 * mapping it to "That username is already taken."
 */
export async function createMyProfile(
  db: SupabaseClient<Database>,
  username: string,
  level: KnowledgeLevel,
  age: number | null = null
): Promise<GuardedWriteResult> {
  const { error } = await callGuardedRpc(db, "create_my_profile", {
    p_username: username,
    p_age: age,
    p_level: level,
  });
  return toWriteResult(error);
}
