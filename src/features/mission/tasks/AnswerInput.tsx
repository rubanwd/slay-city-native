import { forwardRef, useState } from "react";
import { Platform, StyleSheet, TextInput, type TextInputProps } from "react-native";

import { alpha, colors, fontFamilyByWeight, radii, typeScale, withAlpha } from "@slay/tokens";

/**
 * Keyboard settings for a field whose answer is the lesson: no autocorrect, no
 * spelling suggestions, no autofill — a keyboard that offers the right word
 * gives the exercise away (AGENTS.md "Mission tasks", WP-3.5 AC2).
 *
 * Android keyboards don't all honour `autoCorrect={false}`'s no-suggestions
 * flag; the `visible-password` input type is the one every keyboard respects,
 * so Android uses it. It is still a plain letter keyboard.
 */
export const NO_HELP_KEYBOARD: TextInputProps = {
  autoCorrect: false,
  spellCheck: false,
  autoComplete: "off",
  importantForAutofill: "no",
  keyboardType: Platform.OS === "android" ? "visible-password" : "default",
};

export type AnswerState = "idle" | "right" | "wrong";

export interface AnswerInputProps extends TextInputProps {
  state?: AnswerState;
}

/**
 * The big centred answer field of upstream's typing tasks — `text-h3
 * font-bold`, a pink caret, and a green or pink border once checked.
 */
export const AnswerInput = forwardRef<TextInput, AnswerInputProps>(function AnswerInput(
  { state = "idle", style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      {...NO_HELP_KEYBOARD}
      selectionColor={colors.neonPink}
      placeholderTextColor={alpha.white40}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.field,
        state === "right" ? styles.right : state === "wrong" ? styles.wrong : focused ? styles.focused : null,
        style,
      ]}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  field: {
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha.white20,
    backgroundColor: alpha.white10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.white,
    textAlign: "center",
    fontFamily: fontFamilyByWeight["700"],
    fontSize: typeScale.h3.min,
  },
  focused: { borderColor: colors.neonPink, boxShadow: `0 0 0px 2px ${withAlpha(colors.neonPink, 0.6)}` },
  right: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.1) },
  wrong: { borderColor: colors.neonPink, backgroundColor: withAlpha(colors.neonPink, 0.1) },
});
