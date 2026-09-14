/**
 * Shared domain logic — the public surface of @slay/core.
 *
 * Everything re-exported here is a TRACKED COPY of logic that also lives in
 * rubanwd/slay-city (see ../.upstream.json and docs/SYNC.md). Fix shared bugs
 * upstream, then sync; a local edit to a tracked file is how the phone starts
 * paying different XP than the browser for the same mission.
 *
 * The internal layout mirrors upstream's src/ exactly — `features/…`, `types/…`,
 * `lib/…` — so the copies stay byte-identical and their `@/` imports resolve
 * unchanged. That makes drift resolution a `cp` and lets a reviewer diff a file
 * here against upstream/ directly.
 *
 * This barrel is the one file in the package that is NOT a copy. Several upstream
 * modules deliberately re-export each other (admin/taskTypes re-exports from
 * mission/types; i18n/index re-exports locales), so the blocks below name one
 * owner per symbol rather than star-exporting every module and colliding.
 */

// ── Domain types ──────────────────────────────────────────────────────────────
// Database-derived aliases (Profile, District, Mission, the enums, …) are NOT
// re-exported here. Upstream declares MissionTaskType in both types/index and
// features/mission/types — same database enum, two declarations — and two star
// exports providing one name make it ambiguous, which drops the name from the
// module instead of re-exporting it.
//
// Import them from the subpath instead, exactly as upstream does:
//
//   import type { Profile } from "@slay/core/types";   // from this app's code
//   import type { Profile } from "@/types";            // inside ported modules
//
// Both resolve to packages/core/src/types.

// ── Missions: rewards, task shapes, puzzle generation ─────────────────────────
export * from "./features/mission/missionReward";
export * from "./features/mission/snakeGrid";
export * from "./features/mission/wordPuzzle";
export * from "./features/mission/taskUtils";
export * from "./features/mission/types";

// ── Map: unlock state and layout constants ────────────────────────────────────
export * from "./features/map/mapState";
export * from "./features/map/mapConstants";

// ── Player progression ────────────────────────────────────────────────────────
export * from "./features/levels/levels";
export * from "./features/study/studyTime";
export * from "./features/profile/username";
export * from "./features/wardrobe/categories";
export * from "./features/wardrobe/mascot";
export * from "./features/demo/demoProgress";

// ── Teacher- and parent-facing logic ──────────────────────────────────────────
export * from "./features/parent/homework";
export * from "./features/parent/taskFamilies";
export * from "./features/teacher/topicSources";
export * from "./features/feedback/feedback";

// ── Authored-content vocabulary (shared with the teacher console) ─────────────
// MissionTaskType and taskTypeLabel come from mission/types above; this module
// only adds the ordered list of task types the content editors work through.
export { TASK_TYPES } from "./features/admin/taskTypes";
export * from "./features/admin/taskImageSlots";
export * from "./features/admin/taskImageMeta";
export * from "./features/admin/userRoles";

// ── Routing ───────────────────────────────────────────────────────────────────
export * from "./features/auth/roleRouting";

// ── Internationalisation ──────────────────────────────────────────────────────
// i18n/index already re-exports the locale constants and the Locale/Messages
// types, so only the plural helpers are added alongside it.
export * from "./features/i18n";
export * from "./features/i18n/plural";

// ── Audio synthesis (playback lives in the platform adapter, WP-6.2) ──────────
export * from "./lib/hiss";
