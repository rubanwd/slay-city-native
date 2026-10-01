// Tests for request-body validation. New — the Server Actions had no equivalent,
// because a Server Action's input is already typed by the TypeScript call site.
// An HTTP endpoint's is not: the body is whatever a client sends, and these are
// the rules that decide what reaches a prompt.

import { describe, expect, it } from "vitest";

import { isUuid, parseCount, parseDraftBase, parseOptionalText } from "./requestBody.ts";

const UUID = "55555555-5555-4555-8555-555555555555";

describe("isUuid", () => {
  it("accepts a canonical uuid in either case", () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid(UUID.toUpperCase())).toBe(true);
  });

  it("rejects anything else", () => {
    for (const bad of ["topic-1", "", `${UUID} `, `${UUID}x`, 1, null, undefined, {}]) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});

describe("parseOptionalText", () => {
  it("treats absent, null and blank alike", () => {
    expect(parseOptionalText(undefined)).toEqual({ ok: true, value: null });
    expect(parseOptionalText(null)).toEqual({ ok: true, value: null });
    expect(parseOptionalText("   ")).toEqual({ ok: true, value: null });
  });

  it("trims and keeps real text", () => {
    expect(parseOptionalText("  beginner only  ")).toEqual({ ok: true, value: "beginner only" });
  });

  it("clamps to the length the prompt builders clamp to", () => {
    const result = parseOptionalText("x".repeat(900));
    expect(result.ok && result.value).toHaveLength(500);
  });

  it("rejects a non-string rather than coercing it into the prompt", () => {
    // `String({})` is "[object Object]", which would otherwise be sent to the
    // model as teacher instructions.
    for (const bad of [{}, [], 7, true]) expect(parseOptionalText(bad)).toEqual({ ok: false });
  });
});

describe("parseCount", () => {
  it("defaults when absent", () => {
    expect(parseCount(undefined, 1, 20, 8)).toEqual({ ok: true, value: 8 });
    expect(parseCount(null, 1, 20, 8)).toEqual({ ok: true, value: 8 });
  });

  it("clamps into range and rounds", () => {
    expect(parseCount(0, 1, 20, 8)).toEqual({ ok: true, value: 1 });
    expect(parseCount(5000, 1, 20, 8)).toEqual({ ok: true, value: 20 });
    expect(parseCount(3.6, 1, 20, 8)).toEqual({ ok: true, value: 4 });
    expect(parseCount(-9, 0, 20, 3)).toEqual({ ok: true, value: 0 });
  });

  it("rejects a non-number and a non-finite number", () => {
    for (const bad of ["8", [], {}, true, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parseCount(bad, 1, 20, 8)).toEqual({ ok: false });
    }
  });
});

describe("parseDraftBase", () => {
  it("reads the snake_case wire shape into camelCase", () => {
    expect(
      parseDraftBase({
        topic_id: UUID,
        extra_instructions: " focus on verbs ",
        act_as_teacher_id: null,
      }),
    ).toEqual({
      ok: true,
      value: { topicId: UUID, extraInstructions: "focus on verbs", actAsTeacherId: null },
    });
  });

  it("requires topic_id to be a uuid", () => {
    expect(parseDraftBase({ topic_id: "nope" })).toEqual({ ok: false });
    expect(parseDraftBase({})).toEqual({ ok: false });
  });

  it("requires act_as_teacher_id to be a uuid when present", () => {
    expect(parseDraftBase({ topic_id: UUID, act_as_teacher_id: "someone" })).toEqual({
      ok: false,
    });
  });

  it("rejects a non-object body", () => {
    for (const bad of [null, "x", 1, [UUID]]) expect(parseDraftBase(bad)).toEqual({ ok: false });
  });

  it("ignores topic_title and topic_description entirely", () => {
    // Not merely unused: there is nowhere in the parsed value for them to land, so
    // a forged title cannot reach the prompt even by accident.
    const result = parseDraftBase({
      topic_id: UUID,
      topic_title: "forged",
      topic_description: "forged",
    });
    expect(result).toEqual({
      ok: true,
      value: { topicId: UUID, extraInstructions: null, actAsTeacherId: null },
    });
  });
});
