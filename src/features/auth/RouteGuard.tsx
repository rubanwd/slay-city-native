import { useQuery } from "@tanstack/react-query";
import { useGlobalSearchParams, usePathname, useRouter, type Href } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { loadAccount } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { FullScreenLoader, SlayButton, SlayText } from "~/components/ui";
import { useSession } from "~/hooks/useSession";
import { decideRoute, type GuardDecision } from "~/lib/routeGuard";
import { supabase } from "~/lib/supabase";

import { SignOutButton } from "./SignOutButton";

/** Invalidate after anything that changes the user's profile or role, e.g. onboarding. */
export const ACCOUNT_QUERY_KEY = "account";

/**
 * Applies `decideRoute` to wherever the app currently is (WP-2.6). Wraps the
 * root navigator: the screens always mount, so Expo Router can resolve a deep
 * link, but until the decision is "allow" an opaque cover sits over them — a
 * protected screen is never shown, not even for the frame before a redirect.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { next } = useGlobalSearchParams<{ next?: string | string[] }>();
  const { session, isLoading } = useSession();
  const userId = session?.user.id;

  const account = useQuery({
    queryKey: [ACCOUNT_QUERY_KEY, userId],
    queryFn: () => loadAccount(supabase),
    enabled: Boolean(userId),
    staleTime: Infinity,
  });

  const decision: GuardDecision = isLoading
    ? { kind: "wait" }
    : decideRoute({
        pathname,
        next: Array.isArray(next) ? next[0] : next,
        signedIn: Boolean(session),
        account: account.data,
        allowDevRoutes: __DEV__,
      });

  const redirectTo = decision.kind === "redirect" ? decision.to : null;
  useEffect(() => {
    if (redirectTo) router.replace(redirectTo as Href);
  }, [redirectTo, router]);

  return (
    <View style={styles.fill}>
      {children}
      {decision.kind === "allow" ? null : (
        <View style={styles.cover}>
          {decision.kind === "wait" && account.isError ? (
            <View style={styles.error}>
              <SlayText variant="body" color={alpha.white60} style={styles.center}>
                Could not load your account. Check your connection and try again.
              </SlayText>
              <SlayButton onPress={() => account.refetch()} loading={account.isFetching}>
                Try again
              </SlayButton>
              <SignOutButton />
            </View>
          ) : (
            <FullScreenLoader />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  cover: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
    paddingHorizontal: 24,
  },
  error: {
    width: "100%",
    maxWidth: 400,
    gap: 16,
  },
  center: {
    textAlign: "center",
  },
});
