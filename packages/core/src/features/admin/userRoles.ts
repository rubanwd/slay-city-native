import type { UserRole } from "@/types";

/**
 * The four roles an account can hold, in the order the admin user list shows
 * them: most privileged first, because that's the order an admin scans for.
 * Same set as the `user_role` Postgres enum (see
 * `supabase/migrations/20260725000001_rename_child_role_to_student.sql`).
 */
export const USER_ROLES = [
  "admin",
  "teacher",
  "parent",
  "student",
] as const satisfies readonly UserRole[];

/** Human-readable names, used in the role filter and the per-user role picker. */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

/**
 * Brand-token classes for a role badge. Each role keeps the colour it already
 * has elsewhere in the console — admins purple (Manage Admins), teachers orange
 * (Manage Teachers) — so the list reads the same way as the landing cards.
 */
export const USER_ROLE_BADGE_CLASS: Record<UserRole, string> = {
  admin: "bg-purple/20 text-purple",
  teacher: "bg-neon-orange/20 text-neon-orange",
  parent: "bg-cyan/20 text-cyan",
  student: "bg-lime-green/20 text-lime-green",
};

/** Narrows unknown input (a form field, a query string) to a real role. */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/** Display name for a role; falls back to the raw value for unknown input. */
export function userRoleLabel(value: string | null | undefined): string {
  if (!value) return "No profile";
  return isUserRole(value) ? USER_ROLE_LABELS[value] : value;
}

/**
 * Turns a failure `reason` from `admin_set_user_role` / `admin_delete_user` /
 * `admin_create_profile` into something an admin can act on. Unknown reasons
 * fall back to `fallback` rather than leaking a raw enum string.
 */
export function userAdminErrorMessage(reason: string | null | undefined, fallback: string): string {
  switch (reason) {
    case "not_admin":
      return "Only admins can manage users.";
    case "cannot_change_self":
      return "You can't change your own role — ask another admin.";
    case "cannot_delete_self":
      return "You can't delete your own account.";
    case "invalid_role":
      return "Pick one of the four roles.";
    case "invalid_level":
      return "Pick a knowledge level that exists.";
    case "invalid_username":
      return "Enter a username.";
    case "username_taken":
      return "That username is already taken.";
    case "user_not_found":
      return "That account no longer exists.";
    case "profile_exists":
      return "That account already has a profile.";
    default:
      return fallback;
  }
}

/**
 * Creation date as the list shows it — short, unambiguous and locale-independent
 * (`10 Aug 2026`), so a server-rendered row can't disagree with the browser.
 * Returns an empty string for a missing or unparseable timestamp.
 */
export function formatUserDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
