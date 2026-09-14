import type { KnowledgeLevel } from "@/types";

/**
 * Every knowledge level the city can hold, in learning order — the same order
 * the `knowledge_level` Postgres enum declares (see
 * `supabase/migrations/20260724000010_knowledge_levels.sql`).
 *
 * Having content is a separate question from existing: only levels returned by
 * `available_knowledge_levels()` are offered to students. See
 * {@link file://./queries.ts}.
 */
export const KNOWLEDGE_LEVELS = [
  "beginner",
  "elementary",
  "pre_intermediate",
  "intermediate",
  "upper_intermediate",
] as const satisfies readonly KnowledgeLevel[];

/** The level every profile and district starts on — the only one with content today. */
export const DEFAULT_KNOWLEDGE_LEVEL: KnowledgeLevel = "elementary";

/** Human-readable names, used in every level picker and admin heading. */
export const KNOWLEDGE_LEVEL_LABELS: Record<KnowledgeLevel, string> = {
  beginner: "Beginner",
  elementary: "Elementary",
  pre_intermediate: "Pre-Intermediate",
  intermediate: "Intermediate",
  upper_intermediate: "Upper Intermediate",
};

/** One-line "what you'll learn here" blurb shown under each level in the picker. */
export const KNOWLEDGE_LEVEL_DESCRIPTIONS: Record<KnowledgeLevel, string> = {
  beginner: "First words, letters and sounds.",
  elementary: "Everyday words and simple sentences.",
  pre_intermediate: "Longer sentences and past tense.",
  intermediate: "Confident conversations and stories.",
  upper_intermediate: "Complex ideas and rich vocabulary.",
};

/** Narrows unknown input (a form field, a route segment) to a real level. */
export function isKnowledgeLevel(value: unknown): value is KnowledgeLevel {
  return (
    typeof value === "string" && (KNOWLEDGE_LEVELS as readonly string[]).includes(value)
  );
}

/** Display name for a level; falls back to the raw value for unknown input. */
export function knowledgeLevelLabel(value: string): string {
  return isKnowledgeLevel(value) ? KNOWLEDGE_LEVEL_LABELS[value] : value;
}

/** Position in the learning ladder — the sort key for lists of levels. */
export function knowledgeLevelOrder(level: KnowledgeLevel): number {
  return KNOWLEDGE_LEVELS.indexOf(level);
}

/**
 * Sorts levels into learning order regardless of the order they arrived in
 * (the RPC already sorts, but callers merging lists shouldn't have to care).
 */
export function sortKnowledgeLevels(levels: readonly KnowledgeLevel[]): KnowledgeLevel[] {
  return [...levels].sort((a, b) => knowledgeLevelOrder(a) - knowledgeLevelOrder(b));
}

/**
 * The next level up the ladder, or null at the top. Says nothing about whether
 * that level has content — it names what comes next so a finished level can
 * promise it ("Pre-Intermediate is coming soon").
 */
export function nextKnowledgeLevel(level: KnowledgeLevel): KnowledgeLevel | null {
  return KNOWLEDGE_LEVELS[knowledgeLevelOrder(level) + 1] ?? null;
}

/**
 * The level a picker should start on: the student's current level when it is
 * still selectable, otherwise the first available one. Null when nothing is
 * available at all (no published content anywhere yet).
 */
export function resolveSelectableLevel(
  available: readonly KnowledgeLevel[],
  current: KnowledgeLevel | null
): KnowledgeLevel | null {
  if (current && available.includes(current)) return current;
  return sortKnowledgeLevels(available)[0] ?? null;
}
