import { useLocalSearchParams, useRouter } from "expo-router";

import { AuthForm, AuthScreen } from "~/features/auth";

/**
 * `message`/`error` carry a status in from another screen — a finished
 * password reset, or a reset link that had already expired.
 *
 * A signed-in user goes to `/` until WP-2.6's role guard sends them to their
 * role's home.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { message, error } = useLocalSearchParams<{ message?: string; error?: string }>();

  return (
    <AuthScreen>
      <AuthForm mode="login" initialMessage={message} initialError={error} onSignedIn={() => router.replace("/")} />
    </AuthScreen>
  );
}
