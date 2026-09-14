/**
 * Pure rules behind the Feedback & Bugs form — shared by the client form (to
 * disable the submit button and show a counter) and by the server action (which
 * re-validates, because the client is never trusted). No React, no Supabase, so
 * it unit tests on its own.
 */

/** The two things a report can be. Mirrors the `kind` check constraint in SQL. */
export const FEEDBACK_KINDS = ["bug", "feedback"] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** Matches the `message` length check in the `feedback_reports` migration. */
export const MAX_MESSAGE_LENGTH = 4000;

/** Matches the `image_urls` length check in the `feedback_reports` migration. */
export const MAX_IMAGES = 5;

/** Storage folder (inside the public `content` bucket) screenshots are uploaded to. */
export const FEEDBACK_IMAGE_FOLDER = "feedback";

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === "string" && (FEEDBACK_KINDS as readonly string[]).includes(value);
}

/**
 * Whether a screenshot URL is one of ours — a public object in the `content`
 * bucket's `feedback/` folder of this project's Supabase instance.
 *
 * The URLs arrive from the browser, so without this an author could store any
 * address they liked and have every admin's browser fetch it when the inbox
 * renders. Uploads already go through Storage RLS; this keeps what we *record*
 * pinned to the same place.
 */
export function isAllowedFeedbackImageUrl(url: string, supabaseUrl: string): boolean {
  if (!supabaseUrl) return false;
  const base = supabaseUrl.replace(/\/+$/, "");
  return url.startsWith(`${base}/storage/v1/object/public/content/${FEEDBACK_IMAGE_FOLDER}/`);
}

export type FeedbackValidation =
  | { ok: true; kind: FeedbackKind; message: string; imageUrls: string[] }
  | { ok: false; error: string };

/**
 * Validates a submitted report. Trims the message, drops blank image URLs, and
 * rejects anything the database would reject anyway — with a message a child
 * can act on rather than a Postgres constraint name.
 */
export function validateFeedbackReport(
  input: { kind: string; message: string; imageUrls: readonly string[] },
  supabaseUrl: string
): FeedbackValidation {
  if (!isFeedbackKind(input.kind)) {
    return { ok: false, error: "Pick whether this is a bug or feedback." };
  }

  const message = input.message.trim();
  if (!message) {
    return { ok: false, error: "Tell us what happened first." };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Keep it to ${MAX_MESSAGE_LENGTH} characters or fewer.` };
  }

  const imageUrls = input.imageUrls.map((url) => url.trim()).filter(Boolean);
  if (imageUrls.length > MAX_IMAGES) {
    return { ok: false, error: `You can attach up to ${MAX_IMAGES} images.` };
  }
  if (imageUrls.some((url) => !isAllowedFeedbackImageUrl(url, supabaseUrl))) {
    return { ok: false, error: "Images must be uploaded through this form." };
  }

  return { ok: true, kind: input.kind, message, imageUrls };
}

/** Human label for a report kind, used in both the form and the admin inbox. */
export function feedbackKindLabel(kind: string): string {
  return kind === "feedback" ? "Feedback" : "Bug";
}
