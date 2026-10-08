import { describe, expect, it, vi } from "vitest";

import {
  cacheVocabImage,
  clearHomeworkGrammar,
  clearHomeworkVocabulary,
  createHomeworkTopic,
  createMyProfile,
  deleteHomeworkTopic,
  deleteTopicMessage,
  markTopicRead,
  postTopicMessage,
  publishHomeworkGrammar,
  publishHomeworkVocabulary,
  updateHomeworkTopic,
} from "./guardedWrites";

/**
 * These wrappers have no logic of their own to test — the authorization they
 * exist for lives in SQL, and `docs/migrations/wp-2.3/tests/negative-tests.sql`
 * is what proves a student and a non-owning teacher are rejected.
 *
 * What is worth pinning here is the wire contract, because it is the half that
 * cannot be caught by the type-checker once the arguments cross into `jsonb`:
 * the SQL reads `p_words -> 'image_url'` with `->>`, so a key renamed to
 * camelCase would compile and then silently publish words with no image. Each
 * test therefore asserts the exact function name and argument object handed to
 * `rpc()`, plus that a raised exception comes back as `{ ok: false, error }`
 * rather than throwing.
 */

/** A `rpc()` spy shaped like PostgREST's reply, with the call recorded. */
function makeDb(reply: { data?: unknown; error?: { message: string } | null } = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: reply.data ?? null, error: reply.error ?? null });
  return { db: { rpc } as never, rpc };
}

const REFUSED = { message: "Topic not found or not yours to edit." };

describe("homework topic writes", () => {
  it("creates a topic and returns its new id", async () => {
    const { db, rpc } = makeDb({ data: "topic-1" });

    const result = await createHomeworkTopic(db, "group-1", {
      title: "Past Simple",
      description: "Regular verbs",
      orderIndex: 2,
      noteLinkUrl: "https://example.com/notes",
      noteImageUrl: null,
    });

    expect(result).toEqual({ ok: true, id: "topic-1" });
    expect(rpc).toHaveBeenCalledWith("create_homework_topic", {
      p_group_id: "group-1",
      p_title: "Past Simple",
      p_description: "Regular verbs",
      p_order_index: 2,
      p_note_link_url: "https://example.com/notes",
      p_note_image_url: null,
    });
  });

  it("defaults the optional topic fields the way the SQL does", async () => {
    const { db, rpc } = makeDb({ data: "topic-2" });

    await createHomeworkTopic(db, "group-1", { title: "Nouns" });

    expect(rpc).toHaveBeenCalledWith("create_homework_topic", {
      p_group_id: "group-1",
      p_title: "Nouns",
      p_description: null,
      p_order_index: 0,
      p_note_link_url: null,
      p_note_image_url: null,
    });
  });

  it("reports a refused create instead of inventing an id", async () => {
    const { db } = makeDb({ error: REFUSED });

    expect(await createHomeworkTopic(db, "group-1", { title: "Nouns" })).toEqual({
      ok: false,
      error: REFUSED.message,
    });
  });

  it("reports a create that returned no id", async () => {
    const { db } = makeDb({ data: null });

    expect(await createHomeworkTopic(db, "group-1", { title: "Nouns" })).toEqual({
      ok: false,
      error: "The topic could not be created.",
    });
  });

  it("updates a topic", async () => {
    const { db, rpc } = makeDb();

    const result = await updateHomeworkTopic(db, "topic-1", { title: "Past Simple II" });

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("update_homework_topic", {
      p_topic_id: "topic-1",
      p_title: "Past Simple II",
      p_description: null,
      p_order_index: 0,
      p_note_link_url: null,
      p_note_image_url: null,
    });
  });

  // Finding F4: the direct UPDATE this replaces was filtered to zero rows for a
  // non-owning teacher and reported success. The RPC raises 42501, and the
  // wrapper must pass that through rather than swallowing it.
  it("surfaces a refused update as an error, not a silent success", async () => {
    const { db } = makeDb({ error: REFUSED });

    expect(await updateHomeworkTopic(db, "topic-1", { title: "x" })).toEqual({
      ok: false,
      error: REFUSED.message,
    });
  });

  it("deletes a topic", async () => {
    const { db, rpc } = makeDb();

    expect(await deleteHomeworkTopic(db, "topic-1")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("delete_homework_topic", { p_topic_id: "topic-1" });
  });
});

describe("vocabulary writes", () => {
  it("caches a generated image against its word key", async () => {
    const { db, rpc } = makeDb();

    expect(await cacheVocabImage(db, "apple", "https://cdn.example.com/apple.png")).toEqual({
      ok: true,
    });
    expect(rpc).toHaveBeenCalledWith("cache_vocab_image", {
      p_word_key: "apple",
      p_image_url: "https://cdn.example.com/apple.png",
    });
  });

  // The function sends `p_words` as jsonb and the SQL reads it with `->>`, so
  // these keys are column names, not a TypeScript naming choice.
  it("publishes words and tasks under the snake_case keys the SQL reads", async () => {
    const { db, rpc } = makeDb();

    const result = await publishHomeworkVocabulary(
      db,
      "topic-1",
      [
        { word: "apple", transcription: "ˈæp.əl", translation: "яблоко", image_url: null },
        { word: "cat", translation: "кіт" },
      ],
      [{ task_type: "quiz", content: { prompt: "apple?" }, order_index: 0 }]
    );

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("publish_homework_vocabulary", {
      p_topic_id: "topic-1",
      p_words: [
        { word: "apple", transcription: "ˈæp.əl", translation: "яблоко", image_url: null },
        { word: "cat", translation: "кіт" },
      ],
      p_tasks: [{ task_type: "quiz", content: { prompt: "apple?" }, order_index: 0 }],
    });
  });

  it("publishes an empty task list rather than omitting the argument", async () => {
    const { db, rpc } = makeDb();

    await publishHomeworkVocabulary(db, "topic-1", [{ word: "cat", translation: "кіт" }]);

    expect(rpc).toHaveBeenCalledWith("publish_homework_vocabulary", {
      p_topic_id: "topic-1",
      p_words: [{ word: "cat", translation: "кіт" }],
      p_tasks: [],
    });
  });

  it("reports a refused publish", async () => {
    const { db } = makeDb({ error: REFUSED });

    expect(await publishHomeworkVocabulary(db, "topic-1", [])).toEqual({
      ok: false,
      error: REFUSED.message,
    });
  });

  it("clears a topic's vocabulary", async () => {
    const { db, rpc } = makeDb();

    expect(await clearHomeworkVocabulary(db, "topic-1")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("clear_homework_vocabulary", { p_topic_id: "topic-1" });
  });
});

describe("grammar writes", () => {
  it("publishes points and tasks under the snake_case keys the SQL reads", async () => {
    const { db, rpc } = makeDb();

    const result = await publishHomeworkGrammar(
      db,
      "topic-1",
      [{ title: "Plurals", explanation: "Add -s", example: "cat → cats" }],
      [{ task_type: "fill_blank", content: { sentence: "one cat, two ___" } }]
    );

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("publish_homework_grammar", {
      p_topic_id: "topic-1",
      p_points: [{ title: "Plurals", explanation: "Add -s", example: "cat → cats" }],
      p_tasks: [{ task_type: "fill_blank", content: { sentence: "one cat, two ___" } }],
    });
  });

  it("clears a topic's grammar", async () => {
    const { db, rpc } = makeDb();

    expect(await clearHomeworkGrammar(db, "topic-1")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("clear_homework_grammar", { p_topic_id: "topic-1" });
  });
});

describe("homework Q&A writes", () => {
  it("posts a message and returns its id", async () => {
    const { db, rpc } = makeDb({ data: "message-1" });

    const result = await postTopicMessage(db, "topic-1", "Is question 3 a typo?");

    expect(result).toEqual({ ok: true, id: "message-1" });
    expect(rpc).toHaveBeenCalledWith("post_topic_message", {
      p_topic_id: "topic-1",
      p_body: "Is question 3 a typo?",
    });
  });

  // author_id and created_at are deliberately absent: the function takes both
  // from auth.uid() and the database clock, which is what stops a client
  // backdating its own message.
  it("sends only the topic and the body", async () => {
    const { db, rpc } = makeDb({ data: "message-1" });

    await postTopicMessage(db, "topic-1", "hi");

    expect(Object.keys(rpc.mock.calls[0][1])).toEqual(["p_topic_id", "p_body"]);
  });

  it("reports a message that was not posted", async () => {
    const { db } = makeDb({ data: null });

    expect(await postTopicMessage(db, "topic-1", "hi")).toEqual({
      ok: false,
      error: "The message could not be posted.",
    });
  });

  it("marks a topic read", async () => {
    const { db, rpc } = makeDb();

    expect(await markTopicRead(db, "topic-1")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("mark_topic_read", { p_topic_id: "topic-1" });
  });

  it("reports a read marker refused for a topic the caller cannot see", async () => {
    const { db } = makeDb({ error: { message: "Topic not found." } });

    expect(await markTopicRead(db, "topic-9")).toEqual({
      ok: false,
      error: "Topic not found.",
    });
  });

  it("deletes a message", async () => {
    const { db, rpc } = makeDb();

    expect(await deleteTopicMessage(db, "message-1")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("delete_topic_message", { p_message_id: "message-1" });
  });

  it("surfaces a refused delete instead of reporting success", async () => {
    const { db } = makeDb({ error: { message: "That message is not yours to delete." } });

    expect(await deleteTopicMessage(db, "message-1")).toEqual({
      ok: false,
      error: "That message is not yours to delete.",
    });
  });
});

describe("createMyProfile", () => {
  it("creates the profile and its zeroed stats row in one call", async () => {
    const { db, rpc } = makeDb();

    const result = await createMyProfile(db, "Anna Maria", "elementary", 9);

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("create_my_profile", {
      p_username: "Anna Maria",
      p_age: 9,
      p_level: "elementary",
    });
  });

  it("treats age as optional", async () => {
    const { db, rpc } = makeDb();

    await createMyProfile(db, "Anna", "beginner");

    expect(rpc).toHaveBeenCalledWith("create_my_profile", {
      p_username: "Anna",
      p_age: null,
      p_level: "beginner",
    });
  });

  // Finding F1: the role and the starting counters are fixed in SQL, so this
  // path cannot mint a teacher or a non-zero XP balance. Nothing in the call
  // may offer either.
  it("sends no role and no counters", async () => {
    const { db, rpc } = makeDb();

    await createMyProfile(db, "Anna", "beginner", 9);

    expect(Object.keys(rpc.mock.calls[0][1])).toEqual(["p_username", "p_age", "p_level"]);
  });

  it("passes a duplicate username through for the caller to map", async () => {
    const { db } = makeDb({ error: { message: 'duplicate key value violates unique constraint' } });

    expect(await createMyProfile(db, "Anna", "beginner")).toEqual({
      ok: false,
      error: 'duplicate key value violates unique constraint',
    });
  });
});
