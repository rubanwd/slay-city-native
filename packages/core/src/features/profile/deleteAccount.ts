/**
 * Self-service account deletion (`delete_my_account`). Shared with the native
 * app, which calls the same RPC from its profile screens.
 */

/** Why the account was not deleted, as the profile screen explains it. */
export type DeleteAccountProblem = "admin_account" | "teacher_has_groups" | "unknown";

const KNOWN_PROBLEMS: readonly DeleteAccountProblem[] = ["admin_account", "teacher_has_groups"];

/**
 * Reads `delete_my_account`'s `reason`: null when the account is gone, else
 * the problem to show. A missing or unexpected reason is never read as
 * success — the button must not claim an account was deleted when it was not.
 */
export function deleteAccountProblem(reason: string | null | undefined): DeleteAccountProblem | null {
  if (reason === "ok") return null;
  return KNOWN_PROBLEMS.find((problem) => problem === reason) ?? "unknown";
}
