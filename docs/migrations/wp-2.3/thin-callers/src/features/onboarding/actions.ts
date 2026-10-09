"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { isKnowledgeLevel, knowledgeLevelLabel } from "@/features/levels/levels";
import { getAvailableLevels } from "@/features/levels/queries";
import { parseAge } from "./age";
import { checkUsername, usernameProblemMessage } from "@/features/profile/username";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = {
  /** Present when the action failed — shown to the user. */
  error?: string;
};

/**
 * WP-2.3 W-21+W-22: the two direct inserts (`profiles`, then `user_stats`)
 * are now one call to `create_my_profile`, which does both in a single
 * transaction with `role` hard-coded to `student` and the stats counters fixed
 * at `0 / 0 / 1 / 0 / 0` in SQL. This closes finding F1 — before this, any
 * signed-in user could `POST /rest/v1/user_stats` directly with arbitrary
 * `xp`/`coins`/`level`, because the RLS policy on that table checked only
 * *which row* was being inserted, never *what was in it*. Once
 * `…0004_revoke_direct_write_grants.sql` is applied upstream, `user_stats`
 * INSERT is no longer granted to `authenticated` at all — this RPC becomes the
 * only path. All existing validation and error messages are unchanged; the
 * function re-validates the same rules in SQL as a backstop for a client that
 * skips this file entirely.
 */
export async function createProfile(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const levelRaw = String(formData.get("level") ?? "").trim();

  // Any alphabet, up to 32 characters — players type their real first name
  // here. See {@link checkUsername} for the full rules.
  const usernameCheck = checkUsername(String(formData.get("username") ?? ""));
  if (!usernameCheck.ok) {
    return { error: usernameProblemMessage(usernameCheck.problem) };
  }
  const username = usernameCheck.username;

  const ageCheck = parseAge(String(formData.get("age") ?? ""));
  if (!ageCheck.ok) {
    return { error: ageCheck.error };
  }
  const age = ageCheck.age;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your session expired. Please log in again." };
  }

  // The picker only ever offers levels that have content, but the choice
  // arrives from the browser — re-check it here rather than trusting the form.
  const availableLevels = await getAvailableLevels(supabase);
  if (availableLevels.length === 0) {
    return { error: "No levels are open yet. Please try again later." };
  }
  if (!isKnowledgeLevel(levelRaw)) {
    return { error: "Choose your level." };
  }
  if (!availableLevels.includes(levelRaw)) {
    return { error: `${knowledgeLevelLabel(levelRaw)} has no content yet. Pick another level.` };
  }

  // No avatar_url: the player's avatar everywhere is their mascot wearing the
  // wardrobe item they have equipped, so there is nothing to pick at signup.
  const { error: profileError } = await supabase.rpc("create_my_profile", {
    p_username: username,
    p_age: age,
    p_level: levelRaw,
  });

  if (profileError) {
    if (profileError.code === "23505") {
      return { error: usernameProblemMessage("taken") };
    }
    return { error: profileError.message };
  }

  revalidatePath("/", "layout");
  redirect("/map");
}
