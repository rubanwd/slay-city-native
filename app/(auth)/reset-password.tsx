import { Redirect } from "expo-router";

import { ResetPasswordForm } from "~/features/auth";
import { useSession } from "~/hooks/useSession";

/**
 * Landing screen for a recovery deep link (app/(auth)/callback.tsx), once
 * `verifyOtp`/`setSession` has produced a valid session for the user named in
 * the reset email. Without a session (e.g. this route opened directly, not
 * via the callback) there is nothing to reset, so it bounces to `/`.
 */
export default function ResetPasswordScreen() {
  const { session, isLoading } = useSession();

  if (!isLoading && !session) {
    return <Redirect href="/" />;
  }

  return <ResetPasswordForm />;
}
