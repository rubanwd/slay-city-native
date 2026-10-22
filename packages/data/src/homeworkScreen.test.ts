import { describe, expect, it, vi } from "vitest";

import { loadHomeworkList, loadHomeworkTopic } from "./homeworkScreen";

type Result = { data: unknown; error?: unknown };

/** `from(table)` answers with that table's results in read order; `rpc(name)` by name. */
function client(user: { id: string } | null, tables: Record<string, Result[]>, rpcs: Record<string, unknown[]> = {}) {
  const chain = (result: Result): unknown =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
          if (prop === "maybeSingle") return () => Promise.resolve(result);
          return () => chain(result);
        },
      },
    );
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      const next = tables[table]?.shift();
      if (!next) throw new Error(`unexpected read of ${table}`);
      return chain({ error: null, ...next });
    }),
    rpc: vi.fn((name: string) => Promise.resolve({ data: rpcs[name] ?? [], error: null })),
  } as never;
}

const myGroups = [
  { group_id: "g1", group_name: "5-A", teacher_id: "t1", teacher_username: "ms_kate" },
];

describe("loadHomeworkList", () => {
  it("is empty for a student in no group", async () => {
    expect(await loadHomeworkList(client({ id: "u1" }, {}, { my_groups: [] }))).toEqual({ groupNames: [], topics: [] });
  });

  it("counts passed modules per topic and carries unread counts", async () => {
    const db = client(
      { id: "u1" },
      {
        homework_topics: [
          {
            data: [
              { id: "t2", group_id: "g1", title: "Food", description: null, order_index: 1 },
              { id: "t1", group_id: "g1", title: "Animals", description: "Pets", order_index: 0 },
            ],
          },
        ],
        homework_vocab_words: [{ data: [{ topic_id: "t1" }, { topic_id: "t2" }] }],
        homework_grammar_points: [{ data: [{ topic_id: "t1" }] }],
        homework_vocab_completions: [{ data: [{ topic_id: "t1" }] }],
        homework_grammar_completions: [{ data: [{ topic_id: "t1" }] }],
      },
      { my_groups: myGroups, get_unread_topics: [{ topic_id: "t2", unread_count: 3 }] },
    );

    expect(await loadHomeworkList(db)).toEqual({
      groupNames: ["5-A"],
      topics: [
        { id: "t2", title: "Food", description: null, teacherUsername: "ms_kate", totalModules: 1, passedModules: 0, unreadCount: 3 },
        { id: "t1", title: "Animals", description: "Pets", teacherUsername: "ms_kate", totalModules: 2, passedModules: 2, unreadCount: 0 },
      ],
    });
  });

  it("throws on a failed read instead of showing no homework", async () => {
    const db = client({ id: "u1" }, { homework_topics: [{ data: null, error: { message: "offline" } }] }, { my_groups: myGroups });
    await expect(loadHomeworkList(db)).rejects.toEqual({ message: "offline" });
  });
});

describe("loadHomeworkTopic", () => {
  const topicRow = {
    id: "t1",
    title: "Animals",
    description: null,
    note_text: "Read p. 12",
    note_link_url: null,
    note_image_url: null,
  };

  it("maps the topic, its word and grammar sets, and the thread", async () => {
    const db = client(
      { id: "u1" },
      {
        homework_topics: [{ data: topicRow }],
        homework_vocab_words: [
          { data: [{ id: "w1", word: "cat", transcription: "/kæt/", translation: "кіт", image_url: null, order_index: 0 }] },
        ],
        homework_vocab_tasks: [{ data: [{ id: "q1", task_type: "quiz", order_index: 0, content: {} }] }],
        homework_vocab_completions: [{ data: { id: "c1" } }],
        homework_grammar_points: [{ data: [] }],
        homework_grammar_tasks: [{ data: [] }],
        homework_grammar_completions: [{ data: null }],
      },
      {
        get_topic_messages: [
          { id: "m1", author_id: "u2", author_username: "ms_kate", author_is_teacher: true, body: "Hi", created_at: "2026-10-22T10:00:00Z" },
        ],
      },
    );

    expect(await loadHomeworkTopic(db, "t1")).toEqual({
      topic: { id: "t1", title: "Animals", description: null },
      note: { text: "Read p. 12", linkUrl: null, imageUrl: null },
      currentUserId: "u1",
      messages: [
        { id: "m1", authorId: "u2", authorUsername: "ms_kate", authorIsTeacher: true, body: "Hi", createdAt: "2026-10-22T10:00:00Z" },
      ],
      vocab: {
        words: [{ id: "w1", word: "cat", transcription: "/kæt/", translation: "кіт", imageUrl: null, orderIndex: 0 }],
        tasks: [{ id: "q1", taskType: "quiz", orderIndex: 0, content: {} }],
        passed: true,
      },
      // No rules: no grammar module.
      grammar: null,
    });
  });

  it("returns null for a topic outside the student's groups", async () => {
    const empty = { data: [] };
    const db = client(
      { id: "u1" },
      {
        homework_topics: [{ data: null }],
        homework_vocab_words: [empty],
        homework_vocab_tasks: [empty],
        homework_vocab_completions: [{ data: null }],
        homework_grammar_points: [empty],
        homework_grammar_tasks: [empty],
        homework_grammar_completions: [{ data: null }],
      },
    );
    expect(await loadHomeworkTopic(db, "nope")).toBeNull();
  });
});
