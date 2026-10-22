import { isKnowledgeLevel, knowledgeLevelOrder, sortKnowledgeLevels } from "@/features/levels/levels";
import type { KnowledgeLevel } from "@/types";

/**
 * A level block passes at this share of correct answers. Mirrors the 60% rule
 * in `submit_placement_test` (see
 * `supabase/migrations/20261003000001_placement_test.sql`), which is what
 * actually decides the result — this copy only labels the bars on screen.
 */
export const PLACEMENT_PASS_PERCENT = 60;

/** One question as the student sees it: no answer key ever reaches the browser. */
export interface PlacementQuestion {
  id: string;
  level: KnowledgeLevel;
  prompt: string;
  options: string[];
}

export interface PlacementLevelScore {
  level: KnowledgeLevel;
  correct: number;
  total: number;
  passed: boolean;
}

export interface PlacementResult {
  totalCorrect: number;
  totalQuestions: number;
  levelScores: PlacementLevelScore[];
  recommendedLevel: KnowledgeLevel;
}

/** Answers keyed by question id → the chosen option's index in the stored order. */
export type PlacementAnswers = Record<string, number>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** No question holds more than six options (a CHECK constraint in the table). */
const MAX_OPTION_INDEX = 5;

/**
 * Drops anything that isn't a real answer before it reaches the RPC. The
 * database tolerates junk anyway — this just keeps the payload honest and small.
 */
export function sanitizePlacementAnswers(input: unknown): PlacementAnswers {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  const clean: PlacementAnswers = {};
  for (const [id, value] of Object.entries(input)) {
    if (!UUID_RE.test(id)) continue;
    if (typeof value !== "number" || !Number.isInteger(value)) continue;
    if (value < 0 || value > MAX_OPTION_INDEX) continue;
    clean[id] = value;
  }
  return clean;
}

function toCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/** Narrows one `level_scores` entry (or a whole attempt row's array) from JSON. */
export function parseLevelScores(value: unknown): PlacementLevelScore[] {
  if (!Array.isArray(value)) return [];
  const scores: PlacementLevelScore[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const { level, correct, total, passed } = entry as Record<string, unknown>;
    const c = toCount(correct);
    const t = toCount(total);
    if (!isKnowledgeLevel(level) || c === null || t === null || t === 0) continue;
    scores.push({ level, correct: c, total: t, passed: passed === true });
  }
  return scores.sort((a, b) => knowledgeLevelOrder(a.level) - knowledgeLevelOrder(b.level));
}

/**
 * Narrows the JSON returned by `submit_placement_test` into a typed result.
 * Null when the shape is wrong — the caller shows a generic error.
 */
export function parsePlacementResult(value: unknown): PlacementResult | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const totalCorrect = toCount(raw.total_correct);
  const totalQuestions = toCount(raw.total_questions);
  if (totalCorrect === null || totalQuestions === null) return null;
  if (!isKnowledgeLevel(raw.recommended_level)) return null;
  return {
    totalCorrect,
    totalQuestions,
    levelScores: parseLevelScores(raw.level_scores),
    recommendedLevel: raw.recommended_level,
  };
}

/** Whole-number percentage, 0 when there is nothing to divide by. */
export function percent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((Math.max(0, Math.min(correct, total)) / total) * 100);
}

/**
 * The level a student can actually start on for a recommendation: the
 * recommended level itself when it has content, otherwise the nearest level
 * below it that does (safer to start a little easy than on an empty map),
 * otherwise the nearest one above. Null when no level has content at all.
 */
export function closestAvailableLevel(
  recommended: KnowledgeLevel,
  available: readonly KnowledgeLevel[]
): KnowledgeLevel | null {
  if (available.includes(recommended)) return recommended;
  const target = knowledgeLevelOrder(recommended);
  const sorted = sortKnowledgeLevels(available);
  const below = sorted.filter((level) => knowledgeLevelOrder(level) < target);
  if (below.length > 0) return below[below.length - 1];
  return sorted.find((level) => knowledgeLevelOrder(level) > target) ?? null;
}

/**
 * A stable shuffled display order for a question's options, as indices into
 * the stored order. Seeded so a re-render never reshuffles under the student's
 * finger, while different questions (and different attempts) come out in
 * different orders — the stored answer key must never be guessable from
 * position ("always pick A").
 */
export function shuffledOptionOrder(optionCount: number, seed: string): number[] {
  // FNV-1a hash of the seed → mulberry32 PRNG → Fisher–Yates.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let state = h >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const order = Array.from({ length: Math.max(0, optionCount) }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
