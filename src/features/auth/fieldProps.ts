import type { TextInputProps } from "react-native";

/**
 * Keyboard settings for the auth fields. Each is set explicitly because the
 * platform defaults are wrong for credentials: autocorrect "fixes" an email
 * address, auto-capitalisation turns `anna@` into `Anna@`, and a password must
 * be masked and kept out of the keyboard's learned words (WP-2.2 AC4).
 */
const NO_ASSIST = {
  autoCapitalize: "none",
  autoCorrect: false,
  spellCheck: false,
} satisfies TextInputProps;

export const emailFieldProps = {
  ...NO_ASSIST,
  keyboardType: "email-address",
  autoComplete: "email",
  textContentType: "emailAddress",
  placeholder: "you@example.com",
} satisfies TextInputProps;

export const currentPasswordFieldProps = {
  ...NO_ASSIST,
  secureTextEntry: true,
  autoComplete: "current-password",
  textContentType: "password",
  placeholder: "••••••••",
} satisfies TextInputProps;

export const newPasswordFieldProps = {
  ...NO_ASSIST,
  secureTextEntry: true,
  autoComplete: "new-password",
  textContentType: "newPassword",
  placeholder: "••••••••",
} satisfies TextInputProps;
