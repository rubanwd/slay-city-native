import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, KnowledgeLevel } from "@slay/core/types";
import { DEFAULT_KNOWLEDGE_LEVEL, isKnowledgeLevel, resolveMascotImage } from "@slay/core";

import { getAvailableLevels } from "./levels";
import { getLatestPlacementAttempt, type PlacementAttemptSummary } from "./placement";
import { loadMascotImage } from "./wardrobe";

export interface ProfileData {
  /** Display name chosen at signup; null only for profiles predating onboarding. */
  username: string | null;
  email: string | null;
  /** The player's snake wearing their currently equipped wardrobe item. */
  mascotImageUrl: string;
  /** The knowledge level whose districts the player's map is showing. */
  level: KnowledgeLevel;
  /** Levels with content — what the player can switch to. */
  availableLevels: KnowledgeLevel[];
  /** The latest placement test result; null if the student never took it. */
  latestPlacement: PlacementAttemptSummary | null;
}

/**
 * The profile — the queries of upstream's server page `src/app/profile/page.tsx`:
 * the mascot as it is dressed, the name and level on the profile row, the
 * account's email, the levels that have content to switch to, and the latest
 * placement test result.
 */
export async function loadProfile(db: SupabaseClient<Database>): Promise<ProfileData> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return {
      username: null,
      email: null,
      mascotImageUrl: resolveMascotImage([]),
      level: DEFAULT_KNOWLEDGE_LEVEL,
      availableLevels: [],
      latestPlacement: null,
    };
  }

  const [mascotImageUrl, profileRes, availableLevels, latestPlacement] = await Promise.all([
    loadMascotImage(db, user.id),
    db.from("profiles").select("username, level").eq("id", user.id).maybeSingle(),
    getAvailableLevels(db),
    getLatestPlacementAttempt(db, user.id),
  ]);
  // A failed read must not look like a nameless player on the default level.
  if (profileRes.error) throw profileRes.error;

  return {
    username: profileRes.data?.username ?? null,
    email: user.email ?? null,
    mascotImageUrl,
    level: isKnowledgeLevel(profileRes.data?.level) ? profileRes.data.level : DEFAULT_KNOWLEDGE_LEVEL,
    availableLevels,
    latestPlacement,
  };
}
