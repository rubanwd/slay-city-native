/**
 * Supabase data access, shared in shape with the web app.
 *
 * Every exported function takes a SupabaseClient as its first argument and
 * never constructs one, so the same code path is driven by a SecureStore-bound
 * client here and a cookie-bound one on the web:
 *
 *   export async function submitMissionCompletion(
 *     db: SupabaseClient<Database>,
 *     missionId: string,
 *     rewardFraction = 1,
 *   ): Promise<MissionCompletionResult>
 *
 * Not tracked in the sync manifest: signatures differ from upstream by design.
 * See docs/SYNC.md §6.
 *
 * Covers the Category A thin-wrapper actions and the read-only queries.ts
 * files from docs/MIGRATION-MAP.md §2, plus — in guardedWrites.ts, and not
 * callable yet — the Category B teacher/Q&A/onboarding writes that WP-2.3's
 * unmerged RPCs will carry (docs/MIGRATIONS-NEEDED.md,
 * docs/UPSTREAM-PR-WP-2.3.md). Not Category C (OpenRouter, see
 * docs/EDGE-FUNCTIONS-PLAN.md). Admin-only reads (`list_feedback_reports`,
 * `unread_feedback_count`, `mark_feedback_read`) are out of scope — the admin
 * console stays web-only, per AGENTS.md — and so are the admin-only
 * `placement_test_questions` writes upstream added in `02630a3`.
 */

export * from "./mission";
export * from "./wardrobe";
export * from "./levels";
export * from "./homework";
export * from "./study";
export * from "./profile";
export * from "./feedback";
export * from "./map";
export * from "./parent";
export * from "./guardedWrites";
