import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";

/**
 * Email/password auth — the native counterpart of upstream's
 * `src/features/auth/actions.ts`, minus everything Next-specific: no
 * `redirect`, no `revalidatePath`, no cookies. Each function returns what
 * happened and the screen decides where to go.
 *
 * The form checks and every user-facing string are upstream's, word for word
 * (WP-2.2 AC2), so a validation message reads the same on the phone as in the
 * browser. Supabase's own `error.message` is passed through unchanged, exactly
 * as the web does.
 *
 * Upstream keeps these checks inline in its Server Actions, so there is no
 * pure module for packages/core to track. If they change there, change them
 * here — `auth.test.ts` names each one.
 */

/** Roles a user may self-select at registration. Admin is never self-assigned. */
export type SignupRole = "student" | "parent";

export type AuthResult =
  | { status: "error"; error: string }
  /** A non-redirecting success, e.g. "confirm your email". */
  | { status: "message"; message: string }
  | { status: "signed-in" }
  /** The recovery session has been used and signed out. */
  | { status: "password-updated" };

/** Shown on the login screen after a successful password reset. */
export const PASSWORD_UPDATED_MESSAGE = "Password updated. Log in with your new password.";

/** Shown on the login screen when the reset screen is opened without a recovery session. */
export const RESET_LINK_EXPIRED_ERROR = "That reset link has expired. Request a new one.";

/** Loose email shape check — the real validation is done by Supabase Auth. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 6;

const fail = (error: string): AuthResult => ({ status: "error", error });

export interface SignInInput {
  email: string;
  password: string;
}

/** Log in with email + password. */
export async function signIn(db: SupabaseClient<Database>, input: SignInInput): Promise<AuthResult> {
  const email = input.email.trim();
  const { password } = input;

  if (!email || !password) {
    return fail("Enter your email and password.");
  }

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    return fail(error.message);
  }
  return { status: "signed-in" };
}

export interface SignUpInput {
  email: string;
  password: string;
  confirmPassword: string;
  role: SignupRole;
  /** Parents only: the student account to link, stashed in user metadata. */
  studentEmail?: string;
}

/**
 * Register a new account. `role` is chosen at signup; parents additionally
 * supply the (future-linked) student's email. If the project requires email
 * confirmation there is no session yet, and a message is returned instead.
 *
 * `emailRedirectTo` is where the confirmation link lands — the app's
 * `auth/callback` deep link, which must be on the Supabase redirect allow-list.
 */
export async function signUp(
  db: SupabaseClient<Database>,
  input: SignUpInput,
  emailRedirectTo: string,
): Promise<AuthResult> {
  const email = input.email.trim();
  const { password, confirmPassword, role } = input;
  const studentEmail = (input.studentEmail ?? "").trim();

  if (!email || !password) {
    return fail("Enter your email and password.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail("Password must be at least 6 characters.");
  }
  if (password !== confirmPassword) {
    return fail("Passwords do not match.");
  }

  if (role === "parent") {
    if (!studentEmail) {
      return fail("Enter your student's email to link their account.");
    }
    if (!EMAIL_PATTERN.test(studentEmail)) {
      return fail("Enter a valid student email address.");
    }
    if (studentEmail.toLowerCase() === email.toLowerCase()) {
      return fail("The student email must be different from your own.");
    }
  }

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        role,
        ...(role === "parent" ? { student_email: studentEmail } : {}),
      },
    },
  });

  if (error) {
    return fail(error.message);
  }
  if (data.session) {
    return { status: "signed-in" };
  }
  return { status: "message", message: "Account created! Check your email to confirm, then log in." };
}

/**
 * Send a password-reset email whose link opens `redirectTo` — the app's
 * `auth/callback` deep link, which recognises the recovery session and moves
 * on to the reset screen.
 */
export async function requestPasswordReset(
  db: SupabaseClient<Database>,
  emailInput: string,
  redirectTo: string,
): Promise<AuthResult> {
  const email = emailInput.trim();

  if (!email) {
    return fail("Enter your email.");
  }

  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    return fail(error.message);
  }

  // Same message whether or not the email is registered, so this can't be
  // used to enumerate accounts.
  return { status: "message", message: "If an account exists for that email, a reset link has been sent." };
}

export interface UpdatePasswordInput {
  password: string;
  confirmPassword: string;
}

/**
 * Set a new password for the signed-in user. Only valid within the recovery
 * session a reset-password link creates. Signs the user out afterward so they
 * log back in with the new password.
 */
export async function updatePassword(db: SupabaseClient<Database>, input: UpdatePasswordInput): Promise<AuthResult> {
  const { password, confirmPassword } = input;

  if (!password) {
    return fail("Enter a new password.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail("Password must be at least 6 characters.");
  }
  if (password !== confirmPassword) {
    return fail("Passwords do not match.");
  }

  const { error } = await db.auth.updateUser({ password });
  if (error) {
    return fail(error.message);
  }

  await db.auth.signOut();
  return { status: "password-updated" };
}

/**
 * Clear the session. Upstream also drops its "view as teacher" and demo
 * cookies; the app has neither. `useSession` clears the query cache when the
 * sign-out event arrives, and the route guard sends the user to login.
 */
export async function signOut(db: SupabaseClient<Database>): Promise<void> {
  const { error } = await db.auth.signOut();
  if (error) {
    throw error;
  }
}
