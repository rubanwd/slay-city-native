import { describe, expect, it, vi } from "vitest";

import { createTopic, getReusableTopicSources, loadGroupTopics, loadTeacherTopic, parseTopicForm, updateTopic } from "./teacherTopics";

/** `single` is what `.maybeSingle()` resolves to, when a table is read both ways. */
type Result = { data: unknown; error?: unknown; single?: unknown };

function client(tables: Record<string, Result>, rpcs: Record<string, Result> = {}, user: { id: string } | null = { id: "t1" }) {
  const chain = (result: Result): unknown =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
          if (prop === "maybeSingle") return () => Promise.resolve("single" in result ? { error: null, data: result.single } : result);
          return () => chain(result);
        },
      },
    );
  const rpc = vi.fn((fn: string) => Promise.resolve({ error: null, ...(rpcs[fn] ?? { data: null }) }));
  const from = vi.fn((table: string) => chain({ error: null, ...(tables[table] ?? { data: [] }) }));
  return { db: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) }, from, rpc } as never, rpc, from };
}

const form = { title: "  Animals ", description: " Pets ", noteLinkUrl: "", noteImageUrl: "" };

describe("parseTopicForm", () => {
  it("trims, and treats blanks as none", () => {
    expect(parseTopicForm(form, 3)).toEqual({
      ok: true,
      fields: { title: "Animals", description: "Pets", orderIndex: 3, noteLinkUrl: null, noteImageUrl: null },
    });
  });

  it("refuses what upstream refuses, in its words", () => {
    expect(parseTopicForm({ ...form, title: " " }, 0)).toEqual({ ok: false, error: "Title is required." });
    expect(parseTopicForm(form, -1)).toEqual({ ok: false, error: "Order must be a non-negative whole number." });
    expect(parseTopicForm({ ...form, noteLinkUrl: "javascript:alert(1)" }, 0)).toEqual({ ok: false, error: "Link must be a valid http(s) URL." });
    expect(parseTopicForm({ ...form, noteImageUrl: "not a url" }, 0)).toEqual({ ok: false, error: "Image URL must be valid." });
  });
});

describe("createTopic / updateTopic", () => {
  it("creates through create_homework_topic", async () => {
    const { db, rpc } = client({}, { create_homework_topic: { data: "new-id" } });
    expect(await createTopic(db, "g1", { ...form, noteLinkUrl: "https://example.com" }, 4)).toEqual({ ok: true, id: "new-id" });
    expect(rpc).toHaveBeenCalledWith("create_homework_topic", {
      p_group_id: "g1",
      p_title: "Animals",
      p_description: "Pets",
      p_order_index: 4,
      p_note_link_url: "https://example.com",
      p_note_image_url: null,
    });
  });

  it("never calls the database with an invalid form", async () => {
    const { db, rpc } = client({});
    expect(await updateTopic(db, "t9", { ...form, title: "" }, 0)).toEqual({ ok: false, error: "Title is required." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the database's refusal through", async () => {
    const { db } = client({}, { update_homework_topic: { data: null, error: { message: "You can only edit your own topics." } } });
    expect(await updateTopic(db, "t9", form, 0)).toEqual({ ok: false, error: "You can only edit your own topics." });
  });
});

const topicRow = (id: string, order: number, extra: Record<string, unknown> = {}) => ({
  id,
  title: id,
  description: null,
  order_index: order,
  note_text: null,
  note_link_url: null,
  note_image_url: null,
  ...extra,
});

describe("loadGroupTopics", () => {
  it("is null for a group that isn't this teacher's", async () => {
    expect(await loadGroupTopics(client({ teacher_groups: { data: null } }).db, "g9")).toBeNull();
  });

  it("counts each topic's words and rules, its unread Q&A, and the next order", async () => {
    const { db } = client(
      {
        teacher_groups: { data: { id: "g1", name: "5-A" } },
        homework_topics: { data: [topicRow("b", 5), topicRow("a", 1, { note_link_url: "https://x.y" })] },
        homework_vocab_words: { data: [{ topic_id: "b" }, { topic_id: "b" }] },
        homework_grammar_points: { data: [{ topic_id: "a" }] },
      },
      { get_unread_topics: { data: [{ topic_id: "a", unread_count: 3 }] } },
    );
    const data = await loadGroupTopics(db, "g1");
    expect(data?.group).toEqual({ id: "g1", name: "5-A" });
    expect(data?.nextOrder).toBe(6);
    expect(data?.topics.map(({ id, wordCount, grammarCount, unreadCount, noteLinkUrl }) => ({ id, wordCount, grammarCount, unreadCount, noteLinkUrl }))).toEqual([
      { id: "b", wordCount: 2, grammarCount: 0, unreadCount: 0, noteLinkUrl: null },
      { id: "a", wordCount: 0, grammarCount: 1, unreadCount: 3, noteLinkUrl: "https://x.y" },
    ]);
  });
});

describe("loadTeacherTopic", () => {
  it("is null for a topic outside the group", async () => {
    const { db } = client({ teacher_groups: { data: { id: "g1", name: "5-A" } }, homework_topics: { data: null } });
    expect(await loadTeacherTopic(db, "g1", "t9")).toBeNull();
  });

  it("loads the modules, who passed each, and the Q&A", async () => {
    const { db } = client(
      {
        teacher_groups: { data: [{ id: "g1", name: "5-A" }], single: { id: "g1", name: "5-A" } },
        // Read as the topic itself, and (as a list) for the reuse picker.
        homework_topics: { data: [], single: topicRow("t1", 0) },
        homework_vocab_words: { data: [{ word: "cat", transcription: null, translation: "кіт", image_url: null, order_index: 0 }] },
        homework_vocab_tasks: { data: [{ id: "x" }, { id: "y" }] },
        homework_grammar_points: { data: [] },
        homework_grammar_tasks: { data: [] },
        teacher_group_members: { data: [{ student_id: "s1", profiles: { username: "anna" } }, { student_id: "s2", profiles: null }] },
        homework_vocab_completions: { data: [{ student_id: "s1" }] },
        homework_grammar_completions: { data: [] },
      },
      { get_topic_messages: { data: [] }, get_unread_topics: { data: [{ topic_id: "t1", unread_count: 2 }] } },
    );
    const data = await loadTeacherTopic(db, "g1", "t1");
    expect(data?.teacherId).toBe("t1");
    expect(data?.vocabWords).toEqual([{ word: "cat", transcription: null, translation: "кіт", imageUrl: null }]);
    expect(data?.vocabTaskCount).toBe(2);
    expect(data?.vocabRows).toEqual([
      { studentId: "s1", username: "anna", passed: true },
      { studentId: "s2", username: "Unknown", passed: false },
    ]);
    expect(data?.grammarRows.every((r) => !r.passed)).toBe(true);
    expect(data?.unreadCount).toBe(2);
  });
});

describe("getReusableTopicSources", () => {
  it("labels topics with content by group, leaving out the one being edited", async () => {
    const { db } = client({
      teacher_groups: { data: [{ id: "g1", name: "5-A" }] },
      homework_topics: { data: [{ id: "t1", group_id: "g1", title: "Food", order_index: 1 }, { id: "t2", group_id: "g1", title: "Animals", order_index: 2 }] },
      homework_vocab_words: { data: [{ topic_id: "t1" }, { topic_id: "t2" }] },
      homework_grammar_points: { data: [] },
    });
    expect(await getReusableTopicSources(db, "t", "t2")).toEqual([{ topicId: "t1", title: "Food", groupName: "5-A", wordCount: 1, pointCount: 0 }]);
  });
});
