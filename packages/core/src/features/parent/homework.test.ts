import { describe, expect, it } from "vitest";

import { newestTopicsFirst, toHomeworkTopicProgress, type HomeworkTopicRow } from "./homework";

const base: HomeworkTopicRow = {
  topic_id: "topic-1",
  title: "Food and drinks",
  group_name: "Group 1",
  teacher_username: "Olena",
  word_count: 0,
  grammar_count: 0,
  vocab_completed_at: null,
  grammar_completed_at: null,
};

describe("toHomeworkTopicProgress", () => {
  it("passes a vocabulary-only topic on the vocabulary alone", () => {
    const result = toHomeworkTopicProgress({
      ...base,
      word_count: 10,
      vocab_completed_at: "2026-07-20T10:00:00Z",
    });

    expect(result.passed).toBe(true);
    expect(result.started).toBe(false);
  });

  it("does not pass a two-module topic on one module", () => {
    const result = toHomeworkTopicProgress({
      ...base,
      word_count: 10,
      grammar_count: 3,
      vocab_completed_at: "2026-07-20T10:00:00Z",
    });

    expect(result.passed).toBe(false);
    expect(result.started).toBe(true);
  });

  it("passes once both modules are done", () => {
    const result = toHomeworkTopicProgress({
      ...base,
      word_count: 10,
      grammar_count: 3,
      vocab_completed_at: "2026-07-20T10:00:00Z",
      grammar_completed_at: "2026-07-21T10:00:00Z",
    });

    expect(result.passed).toBe(true);
    expect(result.started).toBe(false);
  });

  it("reports an untouched topic as neither started nor passed", () => {
    const result = toHomeworkTopicProgress({ ...base, word_count: 10, grammar_count: 3 });

    expect(result.passed).toBe(false);
    expect(result.started).toBe(false);
  });

  it("carries the teacher's wording through untouched", () => {
    const result = toHomeworkTopicProgress({ ...base, word_count: 4 });

    expect(result.title).toBe("Food and drinks");
    expect(result.groupName).toBe("Group 1");
    expect(result.teacherUsername).toBe("Olena");
  });
});

describe("newestTopicsFirst", () => {
  const row = (topic_id: string, group_name: string) => ({ ...base, topic_id, group_name });

  it("reverses topics within each group and keeps the group order", () => {
    const rows = [
      row("a1", "Group 1"),
      row("a2", "Group 1"),
      row("a3", "Group 1"),
      row("b1", "Group 2"),
      row("b2", "Group 2"),
    ];
    expect(newestTopicsFirst(rows).map((r) => r.topic_id)).toEqual(["a3", "a2", "a1", "b2", "b1"]);
  });

  it("handles an empty list", () => {
    expect(newestTopicsFirst([])).toEqual([]);
  });
});
