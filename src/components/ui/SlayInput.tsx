import { forwardRef, useState } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { alpha, colors, fontFamilyByWeight, radii, typeScale, withAlpha } from "@slay/tokens";

import { SlayText } from "./SlayText";

export interface SlayInputProps extends TextInputProps {
  label?: string;
  hint?: string;
  /** Announced with `accessibilityRole="alert"`. The field itself is never restyled for an error — see design/SCN-5 D7. */
  error?: string;
  success?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * design/SCN-5 "SlayInput". Ported from the web's shared `INPUT_CLASS` string
 * (`src/features/admin/formStyles.ts` upstream), which every web form copies
 * verbatim rather than importing a component.
 */
export const SlayInput = forwardRef<TextInput, SlayInputProps>(function SlayInput(
  { label, hint, error, success, style, containerStyle, editable = true, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const disabled = !editable;

  const handleFocus: NonNullable<TextInputProps["onFocus"]> = (event) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur: NonNullable<TextInputProps["onBlur"]> = (event) => {
    setFocused(false);
    onBlur?.(event);
  };

  return (
    <View style={containerStyle}>
      {label ? (
        <SlayText variant="label" color={alpha.white50} style={styles.label}>
          {label}
        </SlayText>
      ) : null}
      <TextInput
        ref={ref}
        editable={editable}
        selectionColor={colors.neonPink}
        placeholderTextColor={alpha.white40}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[styles.field, focused && styles.fieldFocused, disabled && styles.fieldDisabled, style]}
        {...rest}
      />
      {error ? (
        <SlayText variant="small" weight="600" color={colors.neonPink} accessibilityRole="alert" style={styles.message}>
          {error}
        </SlayText>
      ) : success ? (
        <SlayText variant="small" weight="600" color={colors.limeGreen} style={styles.message}>
          {success}
        </SlayText>
      ) : hint ? (
        <SlayText variant="small" color={alpha.white40} style={styles.message}>
          {hint}
        </SlayText>
      ) : null}
    </View>
  );
});

const fieldTextStyle: TextStyle = {
  fontFamily: fontFamilyByWeight[typeScale.body.weight],
  fontSize: typeScale.body.min,
  lineHeight: typeScale.body.min * typeScale.body.lineHeightRatio,
};

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
  },
  field: {
    ...fieldTextStyle,
    height: 47,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: alpha.white10,
    borderWidth: 1,
    borderColor: alpha.white20,
    color: colors.white,
  },
  fieldFocused: {
    backgroundColor: alpha.white15,
    borderColor: colors.neonPink,
    boxShadow: `0 0 0px 2px ${withAlpha(colors.neonPink, 0.6)}`,
  } as TextStyle,
  fieldDisabled: {
    opacity: 0.5,
  },
  message: {
    marginTop: 6,
  },
});
