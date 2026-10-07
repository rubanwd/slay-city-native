import { QueryClient } from "@tanstack/react-query";

/**
 * The one TanStack Query cache for this app (AGENTS.md "State and data" —
 * server state is TanStack Query, never useEffect + useState). Exported as a
 * plain instance, not just through `QueryClientProvider`'s context, so
 * `~/hooks/useSession` can clear it on sign-out without depending on where in
 * the tree it is read from.
 */
export const queryClient = new QueryClient();
