import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, KnowledgeLevel } from "@slay/core/types";
import {
  DEFAULT_KNOWLEDGE_LEVEL,
  isKnowledgeLevel,
  parseLevelScores,
  parsePlacementResult,
  sanitizePlacementAnswers,
  type PlacementQuestion,
  type PlacementResult,
} from "@slay/core";

import { getAvailableLevels } from "./levels";
import { loadMascotImage } from "./wardrobe";

/** A stored attempt, as the profile and the teacher dashboard show it. */
export interface PlacementAttemptSummary extends PlacementResult {
  takenAt: string;
}

/**
 * The published placement questions, in level order — without the answer key.
 * Port of upstream's `placement/queries.ts`: backed by the `get_placement_test()`
 * SECURITY DEFINER RPC; students have no read access to the questions table.
 */
export async function getPlacementTest(db: SupabaseClient<Database>): Promise<PlacementQuestion[]> {
  const { data, error } = await db.rpc("get_placement_test");
  if (error) throw error;
  return (data ?? []).flatMap((row) =>
    isKnowledgeLevel(row.level) && row.options.length >= 2
      ? [{ id: row.id, level: row.level, prompt: row.prompt, options: row.options }]
      : []
  );
}

type AttemptRow = {
  profile_id: string;
  total_correct: number;
  total_questions: number;
  level_scores: unknown;
  recommended_level: string;
  created_at: string;
};

function toSummary(row: AttemptRow): PlacementAttemptSummary | null {
  if (!isKnowledgeLevel(row.recommended_level)) return null;
  return {
    totalCorrect: row.total_correct,
    totalQuestions: row.total_questions,
    levelScores: parseLevelScores(row.level_scores),
    recommendedLevel: row.recommended_level,
    takenAt: row.created_at,
  };
}

const ATTEMPT_COLUMNS = "profile_id, total_correct, total_questions, level_scores, recommended_level, created_at";

/** The student's most recent placement attempt, or null if they never took it. */
export async function getLatestPlacementAttempt(
  db: SupabaseClient<Database>,
  profileId: string
): Promise<PlacementAttemptSummary | null> {
  const { data } = await db
    .from("placement_test_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toSummary(data) : null;
}

/**
 * Latest attempt per student, for a teacher's class list. RLS limits the rows
 * to students the caller teaches (or is linked to, or is).
 */
export async function getLatestPlacementAttempts(
  db: SupabaseClient<Database>,
  profileIds: readonly string[]
): Promise<Map<string, PlacementAttemptSummary>> {
  const latest = new Map<string, PlacementAttemptSummary>();
  if (profileIds.length === 0) return latest;

  const { data } = await db
    .from("placement_test_attempts")
    .select(ATTEMPT_COLUMNS)
    .in("profile_id", [...profileIds])
    .order("created_at", { ascending: false });

  for (const row of data ?? []) {
    if (latest.has(row.profile_id)) continue;
    const summary = toSummary(row);
    if (summary) latest.set(row.profile_id, summary);
  }
  return latest;
}

export type SubmitPlacementResult = { ok: true; result: PlacementResult } | { ok: false; error: string };

/**
 * Port of upstream's `placement/actions.ts`: sends the choices to
 * `submit_placement_test`, which grades them against the answer key and
 * returns the per-level breakdown — nothing is scored on the phone, which
 * never sees the key. A signed-in student's attempt is stored. Unanswered
 * questions count as wrong, so finishing early is allowed.
 */
export async function submitPlacementTest(db: SupabaseClient<Database>, answers: unknown): Promise<SubmitPlacementResult> {
  const { data, error } = await db.rpc("submit_placement_test", { p_answers: sanitizePlacementAnswers(answers) });
  if (error) return { ok: false, error: error.message };

  const result = parsePlacementResult(data);
  if (!result) return { ok: false, error: "Couldn't read the test result. Please try again." };
  return { ok: true, result };
}

export interface PlacementScreenData {
  questions: PlacementQuestion[];
  /** The level the student is studying now. */
  currentLevel: KnowledgeLevel;
  /** Levels with content — what the result can switch them to. */
  availableLevels: KnowledgeLevel[];
  mascotImageUrl: string;
}

/** The queries of upstream's `src/app/placement-test/page.tsx`. */
export async function loadPlacementScreen(db: SupabaseClient<Database>): Promise<PlacementScreenData> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const [questions, availableLevels, profileRes, mascotImageUrl] = await Promise.all([
    getPlacementTest(db),
    getAvailableLevels(db),
    db.from("profiles").select("level").eq("id", user.id).maybeSingle(),
    loadMascotImage(db, user.id),
  ]);

  return {
    questions,
    currentLevel: isKnowledgeLevel(profileRes.data?.level) ? profileRes.data.level : DEFAULT_KNOWLEDGE_LEVEL,
    availableLevels,
    mascotImageUrl,
  };
}
