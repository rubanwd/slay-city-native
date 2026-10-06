import { describe, expect, it, vi } from "vitest";

import { submitFeedbackReport } from "./feedback";

const SUPABASE_URL = "https://project.supabase.co";
const ALLOWED_IMAGE = `${SUPABASE_URL}/storage/v1/object/public/content/feedback/a.png`;

function makeDb({
  user,
  role,
  insertError,
}: {
  user?: { id: string } | null;
  role?: string | null;
  insertError?: { message: string } | null;
}) {
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: role ? { role } : null }) }),
        }),
      };
    }
    return { insert: vi.fn().mockResolvedValue({ error: insertError ?? null }) };
  });

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: user ?? null } }) },
    from,
  } as never;
}

describe("submitFeedbackReport", () => {
  it("rejects invalid input before touching the database", async () => {
    const db = makeDb({ user: { id: "u1" }, role: "student" });

    const result = await submitFeedbackReport(db, { kind: "bug", message: "", imageUrls: [] }, SUPABASE_URL);

    expect(result).toEqual({ ok: false, error: "Tell us what happened first." });
  });

  it("rejects when signed out", async () => {
    const db = makeDb({ user: null });

    const result = await submitFeedbackReport(
      db,
      { kind: "bug", message: "it broke", imageUrls: [] },
      SUPABASE_URL
    );

    expect(result).toEqual({ ok: false, error: "You must be signed in." });
  });

  it("rejects a role that may not report", async () => {
    const db = makeDb({ user: { id: "u1" }, role: "parent" });

    const result = await submitFeedbackReport(
      db,
      { kind: "bug", message: "it broke", imageUrls: [] },
      SUPABASE_URL
    );

    expect(result).toEqual({ ok: false, error: "Only students and teachers can send reports." });
  });

  it("inserts a validated report for the signed-in author", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) =>
      table === "profiles"
        ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { role: "teacher" } }) }) }) }
        : { insert }
    );
    const db = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) }, from } as never;

    const result = await submitFeedbackReport(
      db,
      { kind: "bug", message: "it broke", imageUrls: [ALLOWED_IMAGE] },
      SUPABASE_URL
    );

    expect(insert).toHaveBeenCalledWith({
      author_id: "u1",
      kind: "bug",
      message: "it broke",
      image_urls: [ALLOWED_IMAGE],
    });
    expect(result).toEqual({ ok: true });
  });

  it("propagates an insert error", async () => {
    const db = makeDb({ user: { id: "u1" }, role: "student", insertError: { message: "db down" } });

    const result = await submitFeedbackReport(
      db,
      { kind: "feedback", message: "nice game", imageUrls: [] },
      SUPABASE_URL
    );

    expect(result).toEqual({ ok: false, error: "db down" });
  });
});
