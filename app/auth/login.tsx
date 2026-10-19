import { useLocalSearchParams } from "expo-router";

import { AuthForm, AuthScreen } from "~/features/auth";

/**
 * `message`/`error` carry a status in from another screen — a finished
 * password reset, or a reset link that had already expired. Once signed in,
 * the route guard moves the user on: to `next` if a deep link brought them
 * here, otherwise to their role's home.
 */
export default function LoginScreen() {
  const { message, error } = useLocalSearchParams<{ message?: string; error?: string }>();

  return (
    <AuthScreen>
      <AuthForm mode="login" initialMessage={message} initialError={error} />
    </AuthScreen>
  );
}
