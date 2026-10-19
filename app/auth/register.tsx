import { AuthForm, AuthScreen } from "~/features/auth";

/** Once signed in, the route guard moves the user on to their role's home. */
export default function RegisterScreen() {
  return (
    <AuthScreen>
      <AuthForm mode="register" />
    </AuthScreen>
  );
}
