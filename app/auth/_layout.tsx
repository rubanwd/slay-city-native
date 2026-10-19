import { Slot } from "expo-router";

/**
 * Sign-in, sign-up and password-reset screens, plus the deep-link callback.
 *
 * A plain `auth/` segment, not an `(auth)` group: `slaycity://auth/callback`
 * resolves to the path `/auth/callback`, so the callback has to live at
 * `app/auth/callback.tsx` for the link to reach it. The paths match upstream's
 * (`/auth/login`, `/auth/reset-password`, …) as a result.
 */
export default function AuthLayout() {
  return <Slot />;
}
