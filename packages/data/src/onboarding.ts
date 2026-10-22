import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";
import { checkUsername, isKnowledgeLevel, knowledgeLevelLabel, parseAge, usernameProblemMessage } from "@slay/core";

import { getAvailableLevels } from "./levels";

export interface OnboardingInput {
  username: string;
  /** The age field as typed; blank means not given. */
  age: string;
  level: string | null;
}

export type CreateProfileResult = { ok: true } | { ok: false; error: string };

/**
 * Creates the signed-in student's profile — the native counterpart of
 * upstream's `features/onboarding/actions.ts` `createProfile`, with the same
 * checks in the same order and the same messages, minus the redirect: the
 * caller refetches the account and the route guard moves on to `roleHome()`.
 *
 * `create_my_profile` inserts `profiles` and a zeroed `user_stats` in one
 * transaction with `role` fixed to `student`, and re-validates all of this in
 * SQL — the checks here exist to give a friendly message first, not to
 * enforce anything.
 */
export async function createProfile(db: SupabaseClient<Database>, input: OnboardingInput): Promise<CreateProfileResult> {
  // Any alphabet, up to 32 characters — players type their real first name.
  const usernameCheck = checkUsername(input.username);
  if (!usernameCheck.ok) {
    return { ok: false, error: usernameProblemMessage(usernameCheck.problem) };
  }

  const ageCheck = parseAge(input.age);
  if (!ageCheck.ok) {
    return { ok: false, error: ageCheck.error };
  }

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: "Your session expired. Please log in again." };
  }

  // The picker only offers levels with content, but the list may have changed
  // since the screen loaded — check again rather than trust it.
  const level = (input.level ?? "").trim();
  const availableLevels = await getAvailableLevels(db);
  if (availableLevels.length === 0) {
    return { ok: false, error: "No levels are open yet. Please try again later." };
  }
  if (!isKnowledgeLevel(level)) {
    return { ok: false, error: "Choose your level." };
  }
  if (!availableLevels.includes(level)) {
    return { ok: false, error: `${knowledgeLevelLabel(level)} has no content yet. Pick another level.` };
  }

  const { error } = await db.rpc("create_my_profile", {
    p_username: usernameCheck.username,
    p_age: ageCheck.age ?? undefined,
    p_level: level,
  });
  if (error) {
    // 23505 = unique_violation on profiles.username.
    return { ok: false, error: error.code === "23505" ? usernameProblemMessage("taken") : error.message };
  }

  return { ok: true };
}
