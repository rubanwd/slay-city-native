// Gate-order tests for `generate-image`.
//
// `index.ts` is two lines around `serveImageFunction`, so there is nothing in
// it to test; the chain is in `../_shared/imageHandler.ts`. Driving it with
// fake ports covers the whole request path under Node/Vitest, matching
// `draft-vocabulary/index.test.ts`'s approach for the two text functions.
//
// Every rejection case asserts `calls.requestImage` is empty — the OpenRouter
// call is the only billed line, and a gate that fires after it protects
// nothing. A cache hit is its own kind of "free": it must also make no
// outbound call, but unlike a rejection it still returns 200.

import { describe, expect, it } from "vitest";

import { handleGenerateImageRequest } from "../_shared/imageHandler.ts";
import { createFakeImagePorts, postRawRequest, postRequest, readError } from "../_shared/testPorts.ts";

const TEACHER = "11111111-1111-4111-8111-111111111111";
const OTHER_TEACHER = "22222222-2222-4222-8222-222222222222";
const STUDENT = "33333333-3333-4333-8333-333333333333";
const ADMIN = "44444444-4444-4444-8444-444444444444";
const TOPIC = "55555555-5555-4555-8555-555555555555";

const TOPIC_CONTEXT = { title: "Animals", description: "Farm animals" };

/** The happy-path port set: a teacher who owns the topic, quota available. */
function teacherPorts(overrides = {}) {
  return createFakeImagePorts({
    user: { id: TEACHER },
    roles: { [TEACHER]: "teacher" },
    ownedTopics: { [`${TOPIC}|${TEACHER}`]: TOPIC_CONTEXT },
    ...overrides,
  });
}

function run(req: Request, fake: ReturnType<typeof createFakeImagePorts>) {
  return handleGenerateImageRequest(req, fake.ports);
}

describe("generate-image — success", () => {
  it("generates, uploads under the teacher's folder, caches, and spends one unit of quota", async () => {
    const fake = teacherPorts();
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { image_url: string; cached: boolean };
    expect(body.cached).toBe(false);
    expect(body.image_url).toContain(`homework/${TEACHER}/`);

    expect(fake.calls.requestImage).toHaveLength(1);
    expect(fake.calls.uploads).toEqual([
      { dataUrl: "data:image/png;base64,QQ==", teacherId: TEACHER },
    ]);
    expect(fake.calls.cacheWrites).toEqual([{ wordKey: "cow", imageUrl: body.image_url }]);
    expect(fake.calls.claims).toEqual([
      { userId: TEACHER, teacherId: TEACHER, kind: "generate_image", topicId: TOPIC },
    ]);
  });

  it("builds the prompt from the word and image hint, not from the topic", async () => {
    const fake = teacherPorts();
    await run(postRequest({ topic_id: TOPIC, word: "apple", image_prompt: "a shiny red apple" }), fake);

    const [prompt] = fake.calls.requestImage;
    expect(prompt).toContain("a shiny red apple");
    expect(prompt).toContain("No text");
  });

  it("falls back to the word when there is no image hint", async () => {
    const fake = teacherPorts();
    await run(postRequest({ topic_id: TOPIC, word: "apple" }), fake);
    expect(fake.calls.requestImage[0]).toContain("apple");
  });

  it("returns a cache hit for free: no OpenRouter call, no quota claim", async () => {
    const fake = teacherPorts({ cached: { cow: "https://cdn.test/content/homework/existing.png" } });
    const res = await run(postRequest({ topic_id: TOPIC, word: "Cow " }), fake);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      image_url: "https://cdn.test/content/homework/existing.png",
      cached: true,
    });
    expect(fake.calls.requestImage).toHaveLength(0);
    expect(fake.calls.claims).toHaveLength(0);
    expect(fake.calls.uploads).toHaveLength(0);
  });

  it("force_regenerate bypasses a cache hit", async () => {
    const fake = teacherPorts({ cached: { cow: "https://cdn.test/content/homework/existing.png" } });
    const res = await run(
      postRequest({ topic_id: TOPIC, word: "cow", force_regenerate: true }),
      fake,
    );

    expect(res.status).toBe(200);
    expect((await res.json()) as { cached: boolean }).toMatchObject({ cached: false });
    expect(fake.calls.requestImage).toHaveLength(1);
    expect(fake.calls.claims).toHaveLength(1);
  });

  it("still returns the image when the cache write fails — non-fatal", async () => {
    const fake = teacherPorts({ cacheFailure: true });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(200);
    expect((await res.json()) as { cached: boolean }).toMatchObject({ cached: false });
  });

  it("lets an admin generate for the teacher they named", async () => {
    const fake = teacherPorts({
      user: { id: ADMIN },
      roles: { [ADMIN]: "admin", [TEACHER]: "teacher" },
    });
    const res = await run(
      postRequest({ topic_id: TOPIC, word: "cow", act_as_teacher_id: TEACHER }),
      fake,
    );

    expect(res.status).toBe(200);
    expect(fake.calls.claims[0]).toEqual({
      userId: ADMIN,
      teacherId: TEACHER,
      kind: "generate_image",
      topicId: TOPIC,
    });
    expect(fake.calls.uploads[0].teacherId).toBe(TEACHER);
  });

  it("logs the outcome without the prompt, the image data, or the response body", async () => {
    const fake = teacherPorts();
    await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    const [entry] = fake.calls.logs;
    expect(entry).toMatchObject({
      kind: "generate_image",
      user_id: TEACHER,
      teacher_id: TEACHER,
      topic_id: TOPIC,
      outcome: "ok",
    });
    expect(typeof entry.duration_ms).toBe("number");
    expect(JSON.stringify(entry)).not.toContain("Animals");
    expect(JSON.stringify(entry)).not.toContain("base64");
  });
});

describe("generate-image — every gate rejects before the billed call", () => {
  it("405s a GET", async () => {
    const fake = teacherPorts();
    const res = await run(
      new Request("https://example.test/", { method: "GET", headers: { Authorization: "Bearer t" } }),
      fake,
    );

    expect(res.status).toBe(405);
    expect((await readError(res)).code).toBe("method_not_allowed");
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("401s with no Authorization header", async () => {
    const fake = teacherPorts();
    const res = await run(
      new Request("https://example.test/", {
        method: "POST",
        body: JSON.stringify({ topic_id: TOPIC, word: "cow" }),
      }),
      fake,
    );

    expect(res.status).toBe(401);
    expect(await readError(res)).toEqual({
      code: "unauthorized",
      message: "Your session expired. Sign in again.",
    });
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("401s when the token does not resolve to a user", async () => {
    const fake = teacherPorts({ user: null });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(401);
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("403s a student whose group contains the topic", async () => {
    const fake = teacherPorts({ user: { id: STUDENT }, roles: { [STUDENT]: "student" } });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(403);
    expect(await readError(res)).toEqual({
      code: "forbidden",
      message: "Only teachers can manage homework.",
    });
    expect(fake.calls.requestImage).toHaveLength(0);
    expect(fake.calls.claims).toHaveLength(0);
  });

  it("403s a caller with no profile row at all", async () => {
    const fake = teacherPorts({ user: { id: STUDENT }, roles: {} });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(403);
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("403s a teacher against another teacher's topic", async () => {
    const fake = teacherPorts({ user: { id: OTHER_TEACHER }, roles: { [OTHER_TEACHER]: "teacher" } });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(403);
    expect(await readError(res)).toEqual({
      code: "forbidden",
      message: "Topic not found or not yours to edit.",
    });
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("403s a non-admin that sends act_as_teacher_id", async () => {
    const fake = teacherPorts();
    const res = await run(
      postRequest({ topic_id: TOPIC, word: "cow", act_as_teacher_id: OTHER_TEACHER }),
      fake,
    );

    expect(res.status).toBe(403);
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("403s an admin that names a non-teacher", async () => {
    const fake = teacherPorts({
      user: { id: ADMIN },
      roles: { [ADMIN]: "admin", [STUDENT]: "student" },
    });
    const res = await run(
      postRequest({ topic_id: TOPIC, word: "cow", act_as_teacher_id: STUDENT }),
      fake,
    );

    expect(res.status).toBe(403);
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("403s an admin that names nobody", async () => {
    const fake = teacherPorts({ user: { id: ADMIN }, roles: { [ADMIN]: "admin" } });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(403);
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("400s a body that is not JSON", async () => {
    const fake = teacherPorts();
    const res = await run(postRawRequest("not json at all"), fake);

    expect(res.status).toBe(400);
    expect(await readError(res)).toEqual({
      code: "invalid_request",
      message: "Something was wrong with that request. Try again.",
    });
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("400s a topic_id that is not a uuid", async () => {
    const fake = teacherPorts();
    const res = await run(postRequest({ topic_id: "topic-1", word: "cow" }), fake);

    expect(res.status).toBe(400);
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("400s a missing, empty, or non-string word instead of silently failing later", async () => {
    const fake = teacherPorts();
    for (const word of [undefined, "", "   ", 7, [], {}]) {
      const res = await run(postRequest({ topic_id: TOPIC, word }), fake);
      expect(res.status).toBe(400);
    }
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("400s a non-string image_prompt", async () => {
    const fake = teacherPorts();
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow", image_prompt: 7 }), fake);

    expect(res.status).toBe(400);
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("400s a non-boolean force_regenerate", async () => {
    const fake = teacherPorts();
    const res = await run(
      postRequest({ topic_id: TOPIC, word: "cow", force_regenerate: "yes" }),
      fake,
    );

    expect(res.status).toBe(400);
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("500s not_configured without spending quota — openRouterImage.ts's own wording", async () => {
    const fake = teacherPorts({ configured: false });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(500);
    expect(await readError(res)).toEqual({
      code: "not_configured",
      message: "Image generation is not configured on this server.",
    });
    expect(fake.calls.claims).toHaveLength(0);
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("429s once the budget is spent, naming the wait", async () => {
    const fake = teacherPorts({
      claim: { allowed: false, retry_after_seconds: 40, remaining_today: 0 },
    });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("40");
    expect(await readError(res)).toEqual({
      code: "rate_limited",
      message: "You've generated a lot recently. Try again in 1 minute.",
    });
    expect(fake.calls.requestImage).toHaveLength(0);
  });

  it("fails closed when the ledger itself is unreachable", async () => {
    const fake = teacherPorts({ claim: null });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(500);
    expect((await readError(res)).code).toBe("internal");
    expect(fake.calls.requestImage).toHaveLength(0);
  });
});

describe("generate-image — model and upload failures keep openRouterImage.ts's existing messages", () => {
  it("504s a model timeout", async () => {
    const fake = teacherPorts({
      openRouter: {
        ok: false,
        code: "upstream_timeout",
        message: "The image model took too long. Try again.",
      },
    });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(504);
    expect((await readError(res)).message).toBe("The image model took too long. Try again.");
  });

  it("502s an OpenRouter error, passing its own message through verbatim", async () => {
    const fake = teacherPorts({
      openRouter: {
        ok: false,
        code: "upstream_error",
        message: "Insufficient credits. Add more at openrouter.ai/credits",
      },
    });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(502);
    expect(await readError(res)).toEqual({
      code: "upstream_error",
      message: "Insufficient credits. Add more at openrouter.ai/credits",
    });
  });

  it("502s when the model returns no image", async () => {
    const fake = teacherPorts({
      openRouter: {
        ok: false,
        code: "empty_response",
        message: "The model did not return an image. Try regenerating.",
      },
    });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(502);
    expect((await readError(res)).message).toBe("The model did not return an image. Try regenerating.");
  });

  it("500s with the storage error when the upload fails, after the model call already billed", async () => {
    const fake = teacherPorts({ uploadFailure: "The generated image was unreadable. Try again." });
    const res = await run(postRequest({ topic_id: TOPIC, word: "cow" }), fake);

    expect(res.status).toBe(500);
    expect(await readError(res)).toEqual({
      code: "internal",
      message: "The generated image was unreadable. Try again.",
    });
    // The quota was already claimed and the model already called — this is a
    // failure after the money was spent, not a gate.
    expect(fake.calls.requestImage).toHaveLength(1);
    expect(fake.calls.claims).toHaveLength(1);
  });
});
