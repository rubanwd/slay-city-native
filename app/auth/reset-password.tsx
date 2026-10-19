import { Redirect, useRouter } from "expo-router";
import { useState } from "react";

import { PASSWORD_UPDATED_MESSAGE, RESET_LINK_EXPIRED_ERROR } from "@slay/data";

import { AuthScreen, ResetPasswordForm } from "~/features/auth";
import { useSession } from "~/hooks/useSession";

/**
 * Reached from app/auth/callback.tsx once a recovery link has produced a
 * session. Without that session `updateUser` would fail with a cryptic "Auth
 * session missing" after the user has already typed a new password, so — as
 * upstream does — an expired or directly opened link goes back to login with
 * an error instead.
 *
 * The session is checked once, on arrival. Updating the password signs the
 * recovery session out, and reacting to that would send the user to login with
 * the "expired" error instead of the "updated" message.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { session, isLoading } = useSession();
  const [arrival, setArrival] = useState<"pending" | "with-session" | "without-session">("pending");

  if (arrival === "pending" && !isLoading) {
    setArrival(session ? "with-session" : "without-session");
  }

  if (arrival === "without-session") {
    return <Redirect href={{ pathname: "/auth/login", params: { error: RESET_LINK_EXPIRED_ERROR } }} />;
  }

  return (
    <AuthScreen>
      {arrival === "with-session" ? (
        <ResetPasswordForm
          onUpdated={() => router.replace({ pathname: "/auth/login", params: { message: PASSWORD_UPDATED_MESSAGE } })}
        />
      ) : null}
    </AuthScreen>
  );
}
