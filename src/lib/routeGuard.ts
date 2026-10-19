import { roleHome } from "@slay/core";
import type { Account } from "@slay/data";

/**
 * Who may see which screen — the app's equivalent of upstream's
 * `src/middleware.ts`, as a pure function so every rule is testable without a
 * navigator.
 *
 * Landing routes come from `roleHome()` in `@slay/core` and are never restated
 * here (WP-2.6 AC1): `/teacher`, `/parent` and `/map` are real routes in this
 * app precisely so its strings address them. What this adds is upstream's
 * area rules, which live inline in middleware and so cannot be copied:
 *
 * - signed out: only `/auth/*`; anything else goes to login, remembering the
 *   target in `next` (AC3)
 * - signed in on login/register: on to `next` or home
 * - no profile yet: onboarding only
 * - parents only in `/parent`, teachers only in `/teacher`, students anywhere
 *   but those two and `/admin` (AC2)
 *
 * One deliberate difference: upstream lets admins onto the student map to
 * check content there. The admin console is web-only (CLAUDE.md), so on the
 * phone an admin is kept to `/admin`, which says so.
 *
 * A client-side guard is navigation, not authorisation — RLS and the RPCs
 * decide what anyone can read or write (AGENTS.md).
 */

export type GuardDecision = { kind: "allow" } | { kind: "wait" } | { kind: "redirect"; to: string };

export interface GuardInput {
  pathname: string;
  /** The `next` search param, read on the login and register screens. */
  next?: string;
  signedIn: boolean;
  /** `undefined` while it is still loading. */
  account: Account | undefined;
  /** `/dev/*` screens are reachable by anyone in a development build. */
  allowDevRoutes: boolean;
}

const LOGIN = "/auth/login";
const ONBOARDING = "/onboarding";

function inArea(pathname: string, area: string): boolean {
  return pathname === area || pathname.startsWith(`${area}/`);
}

/** Only an in-app path may be followed, and never back into the auth screens. */
function safeNext(next: string | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !inArea(next, "/auth") ? next : null;
}

function mayVisit(role: string, pathname: string): boolean {
  if (role === "admin") return inArea(pathname, "/admin");
  if (role === "parent") return inArea(pathname, "/parent");
  if (role === "teacher") return inArea(pathname, "/teacher");
  return !inArea(pathname, "/parent") && !inArea(pathname, "/teacher") && !inArea(pathname, "/admin");
}

export function decideRoute({ pathname, next, signedIn, account, allowDevRoutes }: GuardInput): GuardDecision {
  const allow: GuardDecision = { kind: "allow" };
  const redirect = (to: string): GuardDecision => (to === pathname ? allow : { kind: "redirect", to });

  if (allowDevRoutes && inArea(pathname, "/dev")) {
    return allow;
  }

  const onAuth = inArea(pathname, "/auth");

  if (!signedIn) {
    if (onAuth) return allow;
    return redirect(pathname === "/" ? LOGIN : `${LOGIN}?next=${encodeURIComponent(pathname)}`);
  }

  // The callback is mid-exchange and the reset screen runs on the recovery
  // session the link created — both are signed in on purpose.
  if (inArea(pathname, "/auth/callback") || inArea(pathname, "/auth/reset-password")) {
    return allow;
  }

  if (!account) {
    return { kind: "wait" };
  }

  if (account.kind === "needs-onboarding") {
    return inArea(pathname, ONBOARDING) ? allow : redirect(ONBOARDING);
  }

  const home = roleHome(account.role);

  if (onAuth) {
    // The next pass checks the target against the role like any other path.
    return redirect(safeNext(next) ?? home);
  }
  if (pathname === "/" || inArea(pathname, ONBOARDING)) {
    return redirect(home);
  }
  return mayVisit(account.role, pathname) ? allow : redirect(home);
}
