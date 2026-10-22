import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, KnowledgeLevel } from "@slay/core/types";
import { DEFAULT_KNOWLEDGE_LEVEL, isKnowledgeLevel, resolveMascotImage } from "@slay/core";

import { getAvailableLevels } from "./levels";
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
}

/**
 * The profile — the queries of upstream's server page `src/app/profile/page.tsx`:
 * the mascot as it is dressed, the name and level on the profile row, the
 * account's email, and the levels that have content to switch to.
 *
 * Not yet: upstream's latest placement attempt, which belongs to the placement
 * test this app has not ported.
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
    };
  }

  const [mascotImageUrl, profileRes, availableLevels] = await Promise.all([
    loadMascotImage(db, user.id),
    db.from("profiles").select("username, level").eq("id", user.id).maybeSingle(),
    getAvailableLevels(db),
  ]);
  // A failed read must not look like a nameless player on the default level.
  if (profileRes.error) throw profileRes.error;

  return {
    username: profileRes.data?.username ?? null,
    email: user.email ?? null,
    mascotImageUrl,
    level: isKnowledgeLevel(profileRes.data?.level) ? profileRes.data.level : DEFAULT_KNOWLEDGE_LEVEL,
    availableLevels,
  };
}
