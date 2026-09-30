"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { requireTeacher } from "./requireTeacher";

/** State returned to teacher forms via useActionState. */
export type TeacherFormState = {
  error?: string;
  success?: string;
};

/** Parses a non-negative integer from a form field, defaulting to `fallback`. */
function parseNonNegativeInt(raw: FormDataEntryValue | null, fallback = 0): number | null {
  const value = String(raw ?? "").trim();
  if (value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

/** Parses an optional http(s) URL. Empty means "none" (`null`); present-but-invalid is rejected. */
function parseOptionalUrl(raw: FormDataEntryValue | null): string | null | undefined {
  const value = String(raw ?? "").trim();
  if (value === "") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }
  return value;
}

function revalidateGroup(groupId: string): void {
  revalidatePath(`/teacher/groups/${groupId}`);
  // Homework pages are per-student server components — bust them too so a student
  // sees a topic/task change without waiting for their own next navigation.
  revalidatePath("/homework", "layout");
}

/* ── Homework topics ───────────────────────────────────────────────────────── */
//
// WP-2.3: these three writes now go through the `SECURITY DEFINER` RPCs added
// by `docs/migrations/wp-2.3/20260930000001_teacher_authoring_rpcs.sql`
// (`create_homework_topic`, `update_homework_topic`, `delete_homework_topic`)
// instead of a direct `.from("homework_topics")` write. `requireTeacher()`
// stays as the fast, friendly pre-check it always was — it is a read, not a
// write, and it is what distinguishes "You must be signed in." from "Only
// teachers can manage homework." The RPC re-checks ownership in SQL regardless
// (`can_author_group` / `can_author_topic`), which is what actually closes the
// gap for a client that skips this file entirely.

export async function createHomeworkTopic(
  _prevState: TeacherFormState,
  formData: FormData
): Promise<TeacherFormState> {
  const supabase = await createClient();
  const teacher = await requireTeacher(supabase);
  if (!teacher.ok) return { error: teacher.error };

  const groupId = String(formData.get("group_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const orderIndex = parseNonNegativeInt(formData.get("order_index"));
  const noteLinkUrl = parseOptionalUrl(formData.get("note_link_url"));
  const noteImageUrl = parseOptionalUrl(formData.get("note_image_url"));

  if (!groupId) return { error: "A group is required." };
  if (!title) return { error: "Title is required." };
  if (orderIndex === null) return { error: "Order must be a non-negative whole number." };
  if (noteLinkUrl === undefined) return { error: "Link must be a valid http(s) URL." };
  if (noteImageUrl === undefined) return { error: "Image URL must be valid." };

  const { error } = await supabase.rpc("create_homework_topic", {
    p_group_id: groupId,
    p_title: title,
    p_description: description || null,
    p_order_index: orderIndex,
    p_note_link_url: noteLinkUrl,
    p_note_image_url: noteImageUrl,
  });

  if (error) return { error: error.message };

  revalidateGroup(groupId);
  return { success: `Topic "${title}" added.` };
}

export async function updateHomeworkTopic(
  _prevState: TeacherFormState,
  formData: FormData
): Promise<TeacherFormState> {
  const supabase = await createClient();
  const teacher = await requireTeacher(supabase);
  if (!teacher.ok) return { error: teacher.error };

  const id = String(formData.get("id") ?? "").trim();
  const groupId = String(formData.get("group_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const orderIndex = parseNonNegativeInt(formData.get("order_index"));
  const noteLinkUrl = parseOptionalUrl(formData.get("note_link_url"));
  const noteImageUrl = parseOptionalUrl(formData.get("note_image_url"));

  if (!id) return { error: "A topic is required." };
  if (!title) return { error: "Title is required." };
  if (orderIndex === null) return { error: "Order must be a non-negative whole number." };
  if (noteLinkUrl === undefined) return { error: "Link must be a valid http(s) URL." };
  if (noteImageUrl === undefined) return { error: "Image URL must be valid." };

  // group_id is intentionally not sent — update_homework_topic doesn't accept
  // it, so a topic can't be moved between groups through this call, matching
  // the direct update this replaces.
  const { error } = await supabase.rpc("update_homework_topic", {
    p_topic_id: id,
    p_title: title,
    p_description: description || null,
    p_order_index: orderIndex,
    p_note_link_url: noteLinkUrl,
    p_note_image_url: noteImageUrl,
  });

  if (error) return { error: error.message };

  if (groupId) revalidateGroup(groupId);
  return { success: `Topic "${title}" updated.` };
}

export async function deleteHomeworkTopic(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const teacher = await requireTeacher(supabase);
  if (!teacher.ok) return;

  const id = String(formData.get("id") ?? "").trim();
  const groupId = String(formData.get("group_id") ?? "").trim();
  if (!id) return;

  const { error } = await supabase.rpc("delete_homework_topic", { p_topic_id: id });
  if (!error && groupId) revalidateGroup(groupId);
}
