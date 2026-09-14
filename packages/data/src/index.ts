/**
 * Supabase data access, shared in shape with the web app.
 *
 * Every exported function takes a SupabaseClient as its first argument and never
 * constructs one, so the same code path is driven by a SecureStore-bound client here
 * and a cookie-bound one on the web:
 *
 *   export async function completeMission(
 *     db: SupabaseClient<Database>,
 *     missionId: string,
 *     rewardFraction = 1,
 *   ): Promise<MissionCompletionResult>
 *
 * Not tracked in the sync manifest: signatures differ from upstream by design.
 * See docs/SYNC.md §6.
 *
 * Populated by WP-0.3.
 */
export {};
