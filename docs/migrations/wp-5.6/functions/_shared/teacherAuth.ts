/**
 * Who is allowed to spend money on this topic, re-checked in the database.
 *
 * This is the single most important file in the work package. The guard it
 * replaces does not hold:
 *
 *   `requireTopicAccess()` = `requireTeacher()` + a `SELECT` on
 *   `homework_topics`. But `homework_topics_select` grants
 *   `is_group_member(group_id)`, so **every student in the group can already
 *   read every one of their teacher's topics**. The topic lookup therefore
 *   proves nothing about the caller, and `requireTeacher()` alone stands between
 *   a student and an OpenRouter bill. Nothing else can: these calls write
 *   nothing before they spend money, so no RLS policy is in the path.
 *
 * (`docs/MIGRATIONS-NEEDED.md` §6.2 / `EDGE-FUNCTIONS-PLAN.md` §3.4, native
 * repo.) So ownership is checked here against `teacher_groups.teacher_id`
 * — ownership, never visibility — and it is checked *before* the outbound
 * request, because failing a write afterwards is not a mitigation. The money is
 * spent at the API call.
 *
 * Pure: every database read arrives as a narrow port, so the handler tests can
 * drive each branch (student, non-owning teacher, admin without `act_as`,
 * non-admin *with* `act_as`) and assert no `fetch` happened. The real ports are
 * built from a service-role Supabase client in `edgeRuntime.ts`.
 */

import { MESSAGES } from "./response.ts";

/** What the topic contributes to the prompt. Read server-side, never accepted. */
export interface TopicContext {
  title: string;
  description: string | null;
}

export interface TeacherAuthPorts {
  /** `profiles.role` for a user id, or null when there is no profile row. */
  getProfileRole(userId: string): Promise<string | null>;
  /**
   * The topic, only if `teacherId` owns the group it belongs to. Null covers
   * "no such topic" and "not yours" alike — the caller must not be able to tell
   * those apart, and both are the same 403 with the same message.
   */
  getOwnedTopic(topicId: string, teacherId: string): Promise<TopicContext | null>;
}

export type TeacherResolution =
  | { ok: true; teacherId: string }
  | { ok: false; message: string };

/**
 * Resolves whose budget and whose topics this caller acts on.
 *
 * - a `teacher` acts as themselves;
 * - an `admin` acts as `actAsTeacherId`, but only if that id really is a
 *   `teacher`. This is the explicit, server-verified replacement for the
 *   `view-as-teacher` cookie: `readViewAsTeacherId()` reads `next/headers`,
 *   which does not exist in Deno and has no mobile equivalent;
 * - an admin who sends no `actAsTeacherId` is refused, exactly as an admin with
 *   no cookie is refused today;
 * - everyone else — `student`, `parent`, no profile — is refused.
 *
 * `actAsTeacherId` equal to the caller's own id is treated as absent, so a stale
 * cookie on a teacher account is harmless. A *different* id from a non-admin is
 * an impersonation attempt and is refused rather than ignored.
 */
export async function resolveTeacherId(
  ports: TeacherAuthPorts,
  userId: string,
  actAsTeacherId: string | null,
): Promise<TeacherResolution> {
  const actAs = actAsTeacherId && actAsTeacherId !== userId ? actAsTeacherId : null;
  const role = await ports.getProfileRole(userId);

  if (role === "teacher") {
    if (actAs) return { ok: false, message: MESSAGES.forbidden_not_teacher };
    return { ok: true, teacherId: userId };
  }

  if (role === "admin" && actAs) {
    const targetRole = await ports.getProfileRole(actAs);
    if (targetRole === "teacher") return { ok: true, teacherId: actAs };
  }

  return { ok: false, message: MESSAGES.forbidden_not_teacher };
}

export type TopicResolution =
  | { ok: true; topic: TopicContext }
  | { ok: false; message: string };

/**
 * Confirms `teacherId` owns `topicId` and returns the title and description the
 * prompt needs, in the same query. One round trip, one source of truth, and the
 * prompt's topic text can no longer be forged by the client.
 *
 * Note the deliberate difference from `can_author_topic()` (WP-2.3): that
 * predicate lets an `admin` author on *any* topic, on the parity argument that
 * narrowing an admin would be a new rule (U-7). Here an admin has already had to
 * name the teacher they are acting as, so scoping them to that teacher's topics
 * is not a new rule — it is what "acting as this teacher" means, and it keeps the
 * spend attributable to one budget.
 */
export async function resolveOwnedTopic(
  ports: TeacherAuthPorts,
  topicId: string,
  teacherId: string,
): Promise<TopicResolution> {
  const topic = await ports.getOwnedTopic(topicId, teacherId);
  if (!topic) return { ok: false, message: MESSAGES.forbidden_topic };
  return { ok: true, topic };
}
