import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";

/**
 * Which role the signed-in user plays — the input to `roleHome()` from
 * `@slay/core` and to the app's route guard.
 *
 * Port of `resolveHomePath` / `ensureRoleProfile` in upstream's
 * `src/features/auth/roleRouting.ts`, with the path left to the caller: this
 * returns the account, `roleHome()` turns it into a screen. The steps and the
 * trust rules are upstream's unchanged.
 */
export type Account =
  /** Has a `profiles` row. `role` is whatever the row says. */
  | { kind: "profile"; role: string }
  /** Signed in, no profile yet — a student who has not finished onboarding. */
  | { kind: "needs-onboarding" };

type ProvisionRole = "parent" | "admin";

const USERNAME_PATTERN = /[^a-zA-Z0-9_ ]/g;

/** Derives a valid (2-20 char) username from an email's local part. */
function deriveUsername(email: string | null | undefined, fallback: string): string {
  const local = (email ?? "").split("@")[0] ?? "";
  const cleaned = local.replace(USERNAME_PATTERN, "").slice(0, 20);
  return cleaned.length >= 2 ? cleaned : fallback;
}

/**
 * Ensures a signed-in non-student user has a `profiles` row, so they skip the
 * student onboarding. Best-effort, as upstream: a failure leaves the user
 * profile-less and they land on onboarding.
 *
 * SECURITY: only for a role the caller was actually granted — `parent` from
 * `user_metadata` (self-selected at signup, low stakes) or `admin` from
 * `app_metadata` (service-role-set). The database's
 * `profiles_prevent_role_insert_escalation` trigger is what enforces it.
 */
async function ensureRoleProfile(db: SupabaseClient<Database>, user: User, role: ProvisionRole): Promise<boolean> {
  const base = deriveUsername(user.email, role);
  for (let attempt = 0; attempt < 3; attempt++) {
    const username = attempt === 0 ? base : `${base}_${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await db.from("profiles").insert({ id: user.id, username, role });

    if (!error) {
      if (role === "parent") {
        // A zeroed row keeps the parent dashboard's stats query symmetrical
        // with the student flow.
        await db.from("user_stats").insert({ profile_id: user.id });
      }
      return true;
    }
    // 23505 = unique_violation, i.e. the derived username is taken — retry.
    if (error.code !== "23505") return false;
  }
  return false;
}

/**
 * Resolves the signed-in user's account, provisioning a profile for a trusted
 * role flag the way upstream does after sign-in:
 *
 * 1. `claim_admin()` — an allow-listed email becomes an admin server-side.
 * 2. An existing `profiles` row decides the role.
 * 3. No row: an `app_metadata` admin or a `user_metadata` parent gets one;
 *    anyone else is a student who still has to onboard.
 *
 * Throws when the session is gone or a read fails, so the caller can retry
 * rather than mistake a network error for "no profile".
 */
export async function loadAccount(db: SupabaseClient<Database>): Promise<Account> {
  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser();
  if (userError || !user) {
    throw userError ?? new Error("Not signed in.");
  }

  const { data: claimedAdmin } = await db.rpc("claim_admin");
  if (claimedAdmin === true) return { kind: "profile", role: "admin" };

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    throw profileError;
  }
  if (profile) {
    return { kind: "profile", role: profile.role };
  }

  if (user.app_metadata?.role === "admin" && (await ensureRoleProfile(db, user, "admin"))) {
    return { kind: "profile", role: "admin" };
  }
  if (user.user_metadata?.role === "parent" && (await ensureRoleProfile(db, user, "parent"))) {
    return { kind: "profile", role: "parent" };
  }
  return { kind: "needs-onboarding" };
}
