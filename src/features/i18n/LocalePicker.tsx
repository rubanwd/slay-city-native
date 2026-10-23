import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { LOCALE_LABELS, LOCALES, type Locale } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";

export interface LocalePickerProps {
  /** The language currently being rendered. */
  locale: Locale;
  /** Section heading — "Language" in the reader's own language. */
  title: string;
  /** One line under the heading saying what changes. */
  hint: string;
  /** Stores the choice; null is "Automatic". */
  onChoose: (value: Locale | null) => Promise<void> | void;
  /**
   * The parent console's "Automatic" option, which clears the stored choice so
   * the phone's language decides again. Students have no such option: their
   * default is one fixed language, so the three languages are the whole choice.
   */
  auto?: {
    label: string;
    /** True when no manual choice is stored. */
    selected: boolean;
    /** Names the language Automatic currently resolves to. */
    hint: string;
  };
}

/**
 * Port of upstream's `i18n/LocalePicker.tsx`: the language switcher shared by
 * the student profile and, in `P8`, the parent console. Each language is named
 * in itself. Choosing one re-renders the translated chrome at once — the
 * profile and the tab bar on the student side; missions and authored content
 * stay English.
 */
export function LocalePicker({ locale, title, hint, onChoose, auto }: LocalePickerProps) {
  const [pending, setPending] = useState(false);

  const choose = async (value: Locale | null) => {
    setPending(true);
    try {
      await onChoose(value);
    } finally {
      setPending(false);
    }
  };

  const options: { value: Locale | null; label: string; selected: boolean }[] = [
    ...(auto ? [{ value: null, label: auto.label, selected: auto.selected }] : []),
    ...LOCALES.map((option) => ({
      value: option,
      label: LOCALE_LABELS[option],
      // With Automatic in effect no specific language is the choice, even though one is on screen.
      selected: option === locale && !auto?.selected,
    })),
  ];

  return (
    <View accessibilityLabel={title} style={[styles.box, pending && styles.pending]}>
      <View style={styles.text}>
        <SlayText variant="label" color={alpha.white50} accessibilityRole="header">
          {title}
        </SlayText>
        <SlayText variant="small" color={alpha.white50}>
          {hint}
        </SlayText>
      </View>

      <View style={styles.options}>
        {options.map((option) => (
          <SlayPressable
            key={option.value ?? "auto"}
            accessibilityRole="button"
            aria-pressed={option.selected}
            disabled={pending}
            onPress={() => void choose(option.value)}
            style={[styles.chip, option.selected ? styles.chipSelected : styles.chipIdle]}
          >
            <SlayText variant="small" weight="600" color={option.selected ? colors.limeGreen : alpha.white70}>
              {option.label}
            </SlayText>
          </SlayPressable>
        ))}
      </View>

      {auto?.selected ? (
        <SlayText variant="small" color={alpha.white50}>
          {auto.hint}
        </SlayText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: colors.surface,
    padding: 16,
  },
  pending: { opacity: 0.6 },
  text: { gap: 4 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  chipSelected: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.15) },
  chipIdle: { borderColor: alpha.white15 },
});
