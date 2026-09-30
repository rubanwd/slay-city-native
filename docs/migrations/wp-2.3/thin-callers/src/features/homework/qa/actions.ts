"use server";

import { createClient } from "@/lib/supabase/server";

/** Longest a single Q&A message may be — matches the textarea's guidance. */
const MAX_BODY_LENGTH = 2000;

export type PostMessageResult = { ok: true } | { ok: false; error: string };

/**
 * Post a message to a topic's shared Q&A thread, as the signed-in user.
 *
 * WP-2.3 W-18: the direct `homework_topic_messages` insert is now
 * `post_topic_message`, which sets `author_id` and `created_at` itself in SQL
 * — both were client-settable through the old insert (a caller could back-date
 * a message above someone else's in a thread ordered by `created_at`). The
 * function also re-checks topic visibility (`can_see_topic`) and the 2000-char
 * limit, so a caller that skips this file entirely gets the same guarantees.
 */
export async function postTopicMessage(
  topicId: string,
  body: string
): Promise<PostMessageResult> {
  const trimmed = body.trim();
  if (!topicId) return { ok: false, error: "Missing topic." };
  if (!trimmed) return { ok: false, error: "Message can't be empty." };
  if (trimmed.length > MAX_BODY_LENGTH) {
    return { ok: false, error: `Message must be ${MAX_BODY_LENGTH} characters or fewer.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase.rpc("post_topic_message", {
    p_topic_id: topicId,
    p_body: trimmed,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Mark a topic's Q&A thread read up to now for the signed-in user, clearing its
 * unread badge. Fire-and-forget from the client when the thread is opened.
 *
 * WP-2.3 W-19: the direct `homework_topic_reads` upsert is now
 * `mark_topic_read`, which uses the database clock for `last_read_at` (it used
 * to come from the Next.js server) and checks topic visibility, which the old
 * RLS policy never did.
 */
export async function markTopicRead(topicId: string): Promise<void> {
  if (!topicId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("mark_topic_read", { p_topic_id: topicId });
}

/**
 * Delete a message. The author, the owning teacher, or an admin may do this —
 * the `hw_messages_delete` rule.
 *
 * WP-2.3 W-20: the direct delete relied purely on RLS and reported
 * `{ ok: true }` even when it matched zero rows — a caller without permission
 * saw success and nothing happened. `delete_topic_message` raises `42501`
 * instead. No successful flow changes: the UI only renders the delete button
 * on the caller's own messages.
 */
export async function deleteTopicMessage(messageId: string): Promise<PostMessageResult> {
  if (!messageId) return { ok: false, error: "Missing message." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_topic_message", { p_message_id: messageId });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
