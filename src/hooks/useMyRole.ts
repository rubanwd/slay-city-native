import { useQuery } from "@tanstack/react-query";
import { getMyRole } from "@slay/data";
import type { UserRole } from "@slay/core/types";

import { useSession } from "~/hooks/useSession";
import { useSupabase } from "~/hooks/useSupabase";

/**
 * The signed-in user's role, cached by TanStack Query and keyed off the
 * session's user id (WP-2.6). Disabled while signed out — there is nothing to
 * fetch, and the route guard never consults `role` in that case anyway.
 *
 * Returns `undefined` while the query hasn't resolved yet, so the root layout
 * can tell "still loading" apart from "loaded, no role" (`null`).
 */
export function useMyRole(): UserRole | null | undefined {
  const supabase = useSupabase();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data } = useQuery({
    queryKey: ["my-role", userId],
    queryFn: () => getMyRole(supabase),
    enabled: !!userId,
  });

  return data;
}
