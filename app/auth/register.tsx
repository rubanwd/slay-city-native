import { useRouter } from "expo-router";

import { AuthForm, AuthScreen } from "~/features/auth";

/** A signed-in user goes to `/` until WP-2.6's role guard takes over. */
export default function RegisterScreen() {
  const router = useRouter();

  return (
    <AuthScreen>
      <AuthForm mode="register" onSignedIn={() => router.replace("/")} />
    </AuthScreen>
  );
}
