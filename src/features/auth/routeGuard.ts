import type { Session } from "@supabase/supabase-js";

import { roleHome } from "@slay/core";
import type { UserRole } from "@slay/core/types";

/** Where a signed-out user is sent — the only screen reachable without a session. */
export const SIGNED_OUT_ROUTE = "/login";

/**
 * `roleHome()`'s web paths, translated into this app's own route segments.
 * `(teacher)`/`(parent)`'s home tabs are named `groups`/`progress` rather than
 * `teacher`/`parent`, to avoid colliding with the student group's bare screen
 * names (see those groups' `_layout.tsx` files) — this is the one place that
 * naming difference is bridged back to `roleHome()`'s web-route vocabulary.
 * `admin` has no route group at all; it is a single top-level screen.
 */
const SEGMENT_BY_WEB_HOME: Record<string, string> = {
  "/map": "(student)",
  "/teacher": "(teacher)",
  "/parent": "(parent)",
  "/admin": "admin",
};

const NATIVE_ROUTE_BY_WEB_HOME: Record<string, string> = {
  "/map": "/map",
  "/teacher": "/groups",
  "/parent": "/progress",
  "/admin": "/admin",
};

/**
 * `(auth)` screens a signed-in user is allowed to sit on. Mirrors upstream's
 * `middleware.ts`, which exempts the same two paths from "a signed-in user
 * shouldn't see the auth pages": `callback` is mid code-exchange, and
 * `reset-password` is reached *because* the recovery link signs the user in
 * (via a temporary session) specifically so they can set a new password —
 * redirecting either away mid-flow would break WP-2.2/WP-2.4's reset flow.
 */
const AUTH_SCREENS_ALLOWED_SIGNED_IN = new Set(["callback", "reset-password"]);

/**
 * Pure redirect decision for the root layout's route guard (WP-2.6).
 *
 * `segments` is `useSegments()`'s current value. `session`/`role` are
 * `undefined` while still loading — the caller keeps the splash screen up
 * until both are known, so this never has to guess. `roleHome()` from
 * `@slay/core` is the one source of the role → destination rule (AC1); this
 * function only translates its web paths into this app's own route segments.
 *
 * Returns the path to redirect to, or `null` to stay where `segments` already
 * are.
 */
export function resolveRedirect(
  segments: string[],
  session: Session | null | undefined,
  role: UserRole | null | undefined,
): string | null {
  if (session === undefined) {
    return null;
  }

  const onAuthScreen = segments[0] === "(auth)";
  if (session === null) {
    return onAuthScreen ? null : SIGNED_OUT_ROUTE;
  }
  if (onAuthScreen && AUTH_SCREENS_ALLOWED_SIGNED_IN.has(segments[1])) {
    return null;
  }
  if (role === undefined) {
    return null;
  }

  const webHome = roleHome(role);
  if (segments[0] !== SEGMENT_BY_WEB_HOME[webHome]) {
    return NATIVE_ROUTE_BY_WEB_HOME[webHome];
  }
  return null;
}
