import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { queryClient } from "~/lib/query-client";
import { supabase } from "~/lib/supabase";

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

/**
 * Owns the one `onAuthStateChange` subscription for the app and exposes the
 * current session through context. Clears the TanStack Query cache on
 * sign-out so a signed-out user never sees another account's cached data —
 * the mobile equivalent of the web's `revalidatePath` on logout.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // A stored session that cannot be read — an Android Keystore entry that no
    // longer decrypts after a backup restore, say — is treated as signed out.
    // Left unhandled, `isLoading` would never clear and the app would sit on a
    // blank screen.
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setIsLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
      if (event === "SIGNED_OUT") {
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={{ session, isLoading }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
