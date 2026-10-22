import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";

/**
 * The one TanStack Query cache for this app (AGENTS.md "State and data" —
 * server state is TanStack Query, never useEffect + useState). Exported as a
 * plain instance, not just through `QueryClientProvider`'s context, so
 * `~/hooks/useSession` can clear it on sign-out without depending on where in
 * the tree it is read from.
 *
 * Refetch-on-focus is off by default: a phone has no window focus, and a
 * mission or homework flow must not reload under the student when they come
 * back to the app. A query that should be current whenever it is looked at —
 * the teacher's class progress — opts in with `refetchOnWindowFocus: true`.
 */
export const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

// "Focus" on a phone is the app coming back to the foreground.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
  return () => subscription.remove();
});
