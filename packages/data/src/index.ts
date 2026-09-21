/**
 * Supabase data access, shared in shape with the web app.
 *
 * Every exported function takes a SupabaseClient as its first argument and never
 * constructs one, so the same code path is driven by a SecureStore-bound client here
 * and a cookie-bound one on the web.
 *
 * Not tracked in the sync manifest: signatures differ from upstream by design.
 * See docs/SYNC.md §6.
 *
 * Covers the 18 Category A RPC wrappers from docs/MIGRATION-MAP.md §2. The plain
 * `queries.ts` ports (homework, levels, parent, teacher, study, feedback, demo,
 * wardrobe reads) still need a real `upstream/` checkout to port faithfully — see
 * that file's "Data access" section.
 */
export * from "./mission";
export * from "./wardrobe";
export * from "./levels";
export * from "./map";
export * from "./homework";
export * from "./study";
export * from "./profile";
export * from "./feedback";
export * from "./parent";
export * from "./teacher";
