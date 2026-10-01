// Gate-order tests for `draft-grammar`.
//
// The gate chain is shared with `draft-vocabulary` and is covered exhaustively in
// `../draft-vocabulary/index.test.ts` (405 / 401 / 403 × 5 / 400 × 4 / 429 / 500,
// each asserting no outbound call). This file covers the same chain once end to
// end — so a wiring mistake in `./spec.ts` cannot hide behind the sibling's
// coverage — and then everything that is specific to grammar: two count fields,
// the points/tasks response shape, and the deliberate asymmetry that empty
// `points` is a 422 while empty `tasks` is a success.

import { describe, expect, it } from "vitest";

import { handleDraftRequest } from "../_shared/draftHandler.ts";
import { createFakePorts, postRequest, readError } from "../_shared/testPorts.ts";

import { draftGrammarSpec } from "./spec.ts";

const TEACHER = "11111111-1111-4111-8111-111111111111";
const STUDENT = "33333333-3333-4333-8333-333333333333";
const TOPIC = "55555555-5555-4555-8555-555555555555";

const TOPIC_CONTEXT = { title: "Present Simple", description: "he/she/it + s" };

const MODEL_RESPONSE = JSON.stringify({
  points: [
    {
      title: "Present Simple: he/she/it + s",
      explanation: "Add -s for he, she and it.",
      example: "She goes to school.",
    },
  ],
  tasks: [
    {
      type: "fill_blank",
      sentence: "She ___ to school.",
      answer: "goes",
      options: ["goes", "go", "going", "gone"],
      translation: "Вона ходить до школи.",
    },
  ],
});

function teacherPorts(overrides = {}) {
  return createFakePorts({
    user: { id: TEACHER },
    roles: { [TEACHER]: "teacher" },
    ownedTopics: { [`${TOPIC}|${TEACHER}`]: TOPIC_CONTEXT },
    openRouter: { ok: true, content: MODEL_RESPONSE },
    ...overrides,
  });
}

function run(req: Request, fake: ReturnType<typeof createFakePorts>) {
  return handleDraftRequest(req, draftGrammarSpec, fake.ports);
}

describe("draft-grammar — success", () => {
  it("returns points and tasks, and claims draft_grammar quota", async () => {
    const fake = teacherPorts();
    const res = await run(
      postRequest({ topic_id: TOPIC, point_count: 4, task_count: 3 }),
      fake,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      points: [
        {
          title: "Present Simple: he/she/it + s",
          explanation: "Add -s for he, she and it.",
          example: "She goes to school.",
        },
      ],
      tasks: [
        {
          taskType: "fill_blank",
          content: {
            sentence: "She ___ to school.",
            answer: "goes",
            options: ["goes", "go", "going", "gone"],
            translation: "Вона ходить до школи.",
          },
        },
      ],
    });
    expect(fake.calls.claims).toEqual([
      { userId: TEACHER, teacherId: TEACHER, kind: "draft_grammar", topicId: TOPIC },
    ]);
  });

  it("asks for both counts and takes the topic text from the database", async () => {
    const fake = teacherPorts();
    await run(
      postRequest({
        topic_id: TOPIC,
        point_count: 6,
        task_count: 2,
        topic_title: "forged",
      }),
      fake,
    );

    const [prompt] = fake.calls.requestJson;
    expect(prompt).toContain("Present Simple");
    expect(prompt).toContain("he/she/it + s");
    expect(prompt).not.toContain("forged");
    expect(prompt).toContain("exactly 6");
    expect(prompt).toContain("exactly 2");
  });

  it("clamps both counts server-side", async () => {
    const fake = teacherPorts();
    await run(postRequest({ topic_id: TOPIC, point_count: 999, task_count: -4 }), fake);

    const [prompt] = fake.calls.requestJson;
    expect(prompt).toContain("exactly 20");
    expect(prompt).toContain("exactly 0 test question");
  });

  it("defaults both counts when absent", async () => {
    const fake = teacherPorts();
    await run(postRequest({ topic_id: TOPIC }), fake);

    const [prompt] = fake.calls.requestJson;
    expect(prompt).toContain("exactly 4");
    expect(prompt).toContain("exactly 3 test question");
  });

  it("succeeds with points but no usable tasks — the shipped behaviour", async () => {
    const fake = teacherPorts({
      openRouter: {
        ok: true,
        content: JSON.stringify({
          points: [{ title: "T", explanation: "E" }],
          tasks: [{ type: "mystery", question: "unknown type", options: ["a", "b"] }],
        }),
      },
    });
    const res = await run(postRequest({ topic_id: TOPIC }), fake);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      points: [{ title: "T", explanation: "E", example: null }],
      tasks: [],
    });
  });
});

describe("draft-grammar — gates", () => {
  it("403s a student before any outbound call", async () => {
    const fake = teacherPorts({ user: { id: STUDENT }, roles: { [STUDENT]: "student" } });
    const res = await run(postRequest({ topic_id: TOPIC }), fake);

    expect(res.status).toBe(403);
    expect(fake.calls.requestJson).toHaveLength(0);
    expect(fake.calls.claims).toHaveLength(0);
  });

  it("403s a teacher who does not own the topic", async () => {
    const fake = teacherPorts({ ownedTopics: {} });
    const res = await run(postRequest({ topic_id: TOPIC }), fake);

    expect(res.status).toBe(403);
    expect((await readError(res)).message).toBe("Topic not found or not yours to edit.");
    expect(fake.calls.requestJson).toHaveLength(0);
  });

  it("400s a point_count that is not a number", async () => {
    const fake = teacherPorts();
    const res = await run(postRequest({ topic_id: TOPIC, point_count: "4" }), fake);

    expect(res.status).toBe(400);
    expect(fake.calls.requestJson).toHaveLength(0);
  });

  it("429s with Retry-After once the budget is spent", async () => {
    const fake = teacherPorts({
      claim: { allowed: false, retry_after_seconds: 20, remaining_today: 0 },
    });
    const res = await run(postRequest({ topic_id: TOPIC }), fake);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("20");
    // Sub-minute waits round up: "try again in 20 seconds" invites counting.
    expect((await readError(res)).message).toBe(
      "You've generated a lot recently. Try again in 1 minute.",
    );
    expect(fake.calls.requestJson).toHaveLength(0);
  });

  it("422s a response with no usable grammar points", async () => {
    const fake = teacherPorts({
      openRouter: { ok: true, content: JSON.stringify({ points: [], tasks: [] }) },
    });
    const res = await run(postRequest({ topic_id: TOPIC }), fake);

    expect(res.status).toBe(422);
    expect(await readError(res)).toEqual({
      code: "unusable_response",
      message: "The AI didn't return any usable grammar points. Try again.",
    });
  });
});
