import { describe, expect, it } from "vitest";

import {
  MAX_IMAGES,
  MAX_MESSAGE_LENGTH,
  feedbackKindLabel,
  isAllowedFeedbackImageUrl,
  isFeedbackKind,
  validateFeedbackReport,
} from "./feedback";

const SUPABASE_URL = "https://example.supabase.co";
const imageUrl = (name: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/content/feedback/${name}.png`;

describe("isFeedbackKind", () => {
  it("accepts the two supported kinds", () => {
    expect(isFeedbackKind("bug")).toBe(true);
    expect(isFeedbackKind("feedback")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isFeedbackKind("praise")).toBe(false);
    expect(isFeedbackKind(null)).toBe(false);
  });
});

describe("isAllowedFeedbackImageUrl", () => {
  it("accepts a public URL from our feedback folder", () => {
    expect(isAllowedFeedbackImageUrl(imageUrl("shot"), SUPABASE_URL)).toBe(true);
  });

  it("tolerates a trailing slash on the configured project URL", () => {
    expect(isAllowedFeedbackImageUrl(imageUrl("shot"), `${SUPABASE_URL}/`)).toBe(true);
  });

  it("rejects another host, another bucket, and another folder", () => {
    expect(isAllowedFeedbackImageUrl("https://evil.test/shot.png", SUPABASE_URL)).toBe(false);
    expect(
      isAllowedFeedbackImageUrl(
        `${SUPABASE_URL}/storage/v1/object/public/private/feedback/shot.png`,
        SUPABASE_URL
      )
    ).toBe(false);
    expect(
      isAllowedFeedbackImageUrl(
        `${SUPABASE_URL}/storage/v1/object/public/content/tasks/shot.png`,
        SUPABASE_URL
      )
    ).toBe(false);
  });

  it("rejects everything when the project URL is missing", () => {
    expect(isAllowedFeedbackImageUrl(imageUrl("shot"), "")).toBe(false);
  });
});

describe("validateFeedbackReport", () => {
  it("trims the message and drops blank image slots", () => {
    const result = validateFeedbackReport(
      { kind: "bug", message: "  the map froze  ", imageUrls: [imageUrl("a"), "", "  "] },
      SUPABASE_URL
    );

    expect(result).toEqual({
      ok: true,
      kind: "bug",
      message: "the map froze",
      imageUrls: [imageUrl("a")],
    });
  });

  it("rejects an unknown kind", () => {
    const result = validateFeedbackReport(
      { kind: "complaint", message: "hi", imageUrls: [] },
      SUPABASE_URL
    );

    expect(result.ok).toBe(false);
  });

  it("rejects an empty or whitespace-only message", () => {
    expect(
      validateFeedbackReport({ kind: "bug", message: "   ", imageUrls: [] }, SUPABASE_URL).ok
    ).toBe(false);
  });

  it("rejects a message past the database limit", () => {
    const result = validateFeedbackReport(
      { kind: "feedback", message: "x".repeat(MAX_MESSAGE_LENGTH + 1), imageUrls: [] },
      SUPABASE_URL
    );

    expect(result.ok).toBe(false);
  });

  it("rejects more images than the database allows", () => {
    const urls = Array.from({ length: MAX_IMAGES + 1 }, (_, i) => imageUrl(`shot-${i}`));
    const result = validateFeedbackReport(
      { kind: "bug", message: "look", imageUrls: urls },
      SUPABASE_URL
    );

    expect(result.ok).toBe(false);
  });

  it("rejects an image URL that did not come from our storage", () => {
    const result = validateFeedbackReport(
      { kind: "bug", message: "look", imageUrls: ["https://evil.test/shot.png"] },
      SUPABASE_URL
    );

    expect(result.ok).toBe(false);
  });
});

describe("feedbackKindLabel", () => {
  it("labels both kinds, defaulting unknown values to Bug", () => {
    expect(feedbackKindLabel("bug")).toBe("Bug");
    expect(feedbackKindLabel("feedback")).toBe("Feedback");
    expect(feedbackKindLabel("whatever")).toBe("Bug");
  });
});
