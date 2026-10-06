import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";
import { validateFeedbackReport } from "@slay/core";

export type SubmitFeedbackResult = { ok: true } | { ok: false; error: string };

export interface SubmitFeedbackInput {
  kind: string;
  message: string;
  imageUrls: string[];
}

/**
 * Files a bug report or a piece of feedback from the signed-in student or
 * teacher. RLS (`feedback_reports_insert_student_or_teacher`) is what
 * actually enforces the author and the allowed roles; the validation here
 * exists to reject bad input with a readable message instead of a constraint
 * violation, and to pin attached screenshots to our own storage.
 *
 * `supabaseUrl` is passed in rather than read from an environment variable —
 * this package never reads app configuration, the caller injects it exactly
 * like the Supabase client.
 */
export async function submitFeedbackReport(
  db: SupabaseClient<Database>,
  input: SubmitFeedbackInput,
  supabaseUrl: string
): Promise<SubmitFeedbackResult> {
  const validated = validateFeedbackReport(input, supabaseUrl);
  if (!validated.ok) return validated;

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  // Same rule as the insert policy, checked here so a caller who legitimately
  // can't post (e.g. a parent) gets an explanation instead of an RLS error.
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "student" && profile?.role !== "teacher") {
    return { ok: false, error: "Only students and teachers can send reports." };
  }

  const { error } = await db.from("feedback_reports").insert({
    author_id: user.id,
    kind: validated.kind,
    message: validated.message,
    image_urls: validated.imageUrls,
  });

  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
