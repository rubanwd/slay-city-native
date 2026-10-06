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
 * files from docs/MIGRATION-MAP.md §2 — not the Category B direct-write files
 * (need new RPCs, see docs/MIGRATIONS-NEEDED.md) and not Category C
 * (OpenRouter, see docs/EDGE-FUNCTIONS-PLAN.md). Admin-only reads
 * (`list_feedback_reports`, `unread_feedback_count`, `mark_feedback_read`) are
 * also out of scope — the admin console stays web-only, per AGENTS.md.
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
