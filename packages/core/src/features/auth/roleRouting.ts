/**
 * Role-based post-auth routing.
 *
 * ADAPTED COPY — see docs/SYNC.md. Upstream's src/features/auth/roleRouting.ts
 * also holds `ensureRoleProfile` and `resolveHomePath`, which take a Supabase
 * client and query `profiles`. Those belong in packages/data; only the pure
 * mapping below is shared logic.
 *
 * On a drift alert for this file: check whether the upstream change touched
 * `roleHome`. If it only touched the data-access functions, the change belongs
 * in packages/data and this file stays as it is — update the hash and say so.
 *
 * The returned paths are upstream's web routes. Expo Router's role groups are
 * laid out to match, so the same strings address the same screen on both
 * platforms and the routing rules are never restated (WP-2.6).
 */
/** The screen a given role lands on after auth. */
export function roleHome(role: string | null | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "parent") return "/parent";
  if (role === "teacher") return "/teacher";
  return "/map";
}
