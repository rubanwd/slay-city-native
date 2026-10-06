import { describe, expect, it, vi } from "vitest";

import {
  completeHomeworkGrammar,
  completeHomeworkVocab,
  getMyGroups,
  getTopicMessages,
  getUnreadCounts,
  hasAnyGroup,
} from "./homework";

function makeAuthDb(overrides: {
  user?: { id: string } | null;
  single?: ReturnType<typeof vi.fn>;
}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: overrides.user ?? null } }) },
    rpc: vi.fn().mockReturnValue({ single: overrides.single ?? vi.fn() }),
  } as never;
}

describe("completeHomeworkVocab", () => {
  it("rejects when signed out", async () => {
    const db = makeAuthDb({ user: null });
    expect(await completeHomeworkVocab(db, "topic-1")).toEqual({
      ok: false,
      error: "You must be signed in to save your progress.",
    });
  });

  it("returns the XP earned on a first pass", async () => {
    const single = vi.fn().mockResolvedValue({ data: { already_completed: false, xp_earned: 20 }, error: null });
    const db = makeAuthDb({ user: { id: "u1" }, single });

    expect(await completeHomeworkVocab(db, "topic-1")).toEqual({
      ok: true,
      xpEarned: 20,
      alreadyPassed: false,
    });
  });

  it("propagates an RPC error", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const db = makeAuthDb({ user: { id: "u1" }, single });

    expect(await completeHomeworkVocab(db, "topic-1")).toEqual({ ok: false, error: "boom" });
  });
});

describe("completeHomeworkGrammar", () => {
  it("returns alreadyPassed with no XP on a replay", async () => {
    const single = vi.fn().mockResolvedValue({ data: { already_completed: true, xp_earned: 0 }, error: null });
    const db = makeAuthDb({ user: { id: "u1" }, single });

    expect(await completeHomeworkGrammar(db, "topic-1")).toEqual({
      ok: true,
      xpEarned: 0,
      alreadyPassed: true,
    });
  });
});

describe("getMyGroups / hasAnyGroup", () => {
  it("maps my_groups rows into camelCase", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ group_id: "g1", group_name: "Group A", teacher_id: "t1", teacher_username: "Ms. T" }],
    });
    const db = { rpc } as never;

    expect(await getMyGroups(db)).toEqual([
      { groupId: "g1", groupName: "Group A", teacherId: "t1", teacherUsername: "Ms. T" },
    ]);
    expect(rpc).toHaveBeenCalledWith("my_groups");
  });

  it("hasAnyGroup is false with no groups and true with at least one", async () => {
    const empty = { rpc: vi.fn().mockResolvedValue({ data: [] }) } as never;
    const some = { rpc: vi.fn().mockResolvedValue({ data: [{ group_id: "g1" }] }) } as never;

    expect(await hasAnyGroup(empty)).toBe(false);
    expect(await hasAnyGroup(some)).toBe(true);
  });
});

describe("getTopicMessages", () => {
  it("calls get_topic_messages with the topic id and maps rows", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: "msg-1",
          author_id: "u1",
          author_username: "Ann",
          author_is_teacher: false,
          body: "hi",
          created_at: "2026-10-01T00:00:00Z",
        },
      ],
    });
    const db = { rpc } as never;

    expect(await getTopicMessages(db, "topic-1")).toEqual([
      {
        id: "msg-1",
        authorId: "u1",
        authorUsername: "Ann",
        authorIsTeacher: false,
        body: "hi",
        createdAt: "2026-10-01T00:00:00Z",
      },
    ]);
    expect(rpc).toHaveBeenCalledWith("get_topic_messages", { p_topic_id: "topic-1" });
  });
});

describe("getUnreadCounts", () => {
  it("builds a topic id -> count map", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { topic_id: "t1", unread_count: 2 },
        { topic_id: "t2", unread_count: 0 },
      ],
    });
    const db = { rpc } as never;

    const counts = await getUnreadCounts(db);

    expect(counts.get("t1")).toBe(2);
    expect(counts.get("t2")).toBe(0);
    expect(rpc).toHaveBeenCalledWith("get_unread_topics");
  });
});
