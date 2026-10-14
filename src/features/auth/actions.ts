import { getAuthRedirectUrl } from "~/lib/authRedirect";
import { supabase } from "~/lib/supabase";

/**
 * Client-side counterpart to the web's `"use server"` auth actions
 * (`src/features/auth/actions.ts` upstream) — same validation and the same
 * error/message copy (WP-2.2 AC2). There is no FormData, cookies, `redirect()`
 * or `revalidatePath` here; those are Next.js-only. Where upstream redirects on
 * success, these just resolve — the screen component navigates with
 * `useRouter()` once the call returns.
 */

/** Result of an auth action. */
export type AuthState = {
  /** Present when the action failed — shown to the user. */
  error?: string;
  /** Present on a success with no destination to navigate to, e.g. "confirm your email". */
  message?: string;
};

/** Roles a user may self-select at registration. Admin and teacher are never self-assigned. */
export type SignupRole = "student" | "parent";

/** Log in with email + password. */
export async function signIn(email: string, password: string): Promise<AuthState> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
}

export async function loginFormAction(email: string, password: string): Promise<AuthState> {
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  return signIn(email, password);
}

/**
 * Register a new account. `role` is chosen at signup; parents additionally
 * supply the (future-linked) student's email, stashed in user metadata —
 * the same shape upstream's `signUp` writes. `emailRedirectTo` points at
 * `app/(auth)/callback.tsx` via `getAuthRedirectUrl()`, the one redirect
 * target every auth email is pointed at (src/lib/authRedirect.ts).
 */
export async function signUp(
  email: string,
  password: string,
  role: SignupRole,
  studentEmail?: string,
): Promise<AuthState> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: {
        role,
        ...(role === "parent" && studentEmail ? { student_email: studentEmail } : {}),
      },
    },
  });

  if (error) {
    return { error: error.message };
  }
  if (data.session) {
    return {};
  }

  return { message: "Account created! Check your email to confirm, then log in." };
}

/** Loose email shape check — the real validation is done by Supabase Auth. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerFormAction(
  email: string,
  password: string,
  confirmPassword: string,
  role: SignupRole,
  studentEmail: string,
): Promise<AuthState> {
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  if (role === "parent") {
    if (!studentEmail) {
      return { error: "Enter your student's email to link their account." };
    }
    if (!EMAIL_PATTERN.test(studentEmail)) {
      return { error: "Enter a valid student email address." };
    }
    if (studentEmail.toLowerCase() === email.toLowerCase()) {
      return { error: "The student email must be different from your own." };
    }
  }

  return signUp(email, password, role, role === "parent" ? studentEmail : undefined);
}

/**
 * Send a password-reset email. The link opens `app/(auth)/callback.tsx`, which
 * recognises the recovery link and forwards on to
 * `app/(auth)/reset-password.tsx` — no `?next=` query param needed, unlike
 * upstream, because the callback screen already branches on the link's `type`.
 */
export async function requestPasswordReset(email: string): Promise<AuthState> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(),
  });

  // Same message whether or not the email is registered, so this can't be
  // used to enumerate accounts.
  return error
    ? { error: error.message }
    : { message: "If an account exists for that email, a reset link has been sent." };
}

export async function forgotPasswordFormAction(email: string): Promise<AuthState> {
  if (!email) {
    return { error: "Enter your email." };
  }

  return requestPasswordReset(email);
}

/**
 * Set a new password for the signed-in user. Only valid within the recovery
 * session `app/(auth)/callback.tsx` produced. Unlike upstream this does not
 * sign the user out afterward — the caller routes straight to the role home
 * with the new session still live, per WP-2.2's step 5.
 */
export async function updatePassword(password: string): Promise<AuthState> {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { error: error.message } : {};
}

/** Sign the current user out. The session listener handles the rest (WP-2.1). */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function resetPasswordFormAction(password: string, confirmPassword: string): Promise<AuthState> {
  if (!password) {
    return { error: "Enter a new password." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  return updatePassword(password);
}
