import { StyleSheet, Switch, View } from "react-native";

import type { Locale } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayText } from "~/components/ui";
import { setHapticsEnabled, useHapticsEnabled } from "~/lib/haptics";

/**
 * The card's words. Native-only — the web has no vibration, so `@slay/core`'s
 * messages have no entry for it — translated here in the same three languages.
 */
const STRINGS: Record<Locale, { title: string; hint: string }> = {
  en: { title: "Vibration", hint: "A buzz on taps, answers and rewards." },
  uk: { title: "Вібрація", hint: "Легка вібрація на дотиках, відповідях і нагородах." },
  ru: { title: "Вибрация", hint: "Лёгкая вибрация на нажатиях, ответах и наградах." },
};

/**
 * The global haptics switch (WP-6.3): one toggle on every role's profile,
 * stored on the device, that silences every pattern in `~/lib/haptics`.
 */
export function HapticsCard({ locale }: { locale: Locale }) {
  const enabled = useHapticsEnabled();
  const strings = STRINGS[locale];

  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <SlayText variant="label" color={alpha.white50}>
          {strings.title}
        </SlayText>
        <SlayText variant="small" color={alpha.white50}>
          {strings.hint}
        </SlayText>
      </View>
      <Switch
        accessibilityLabel={strings.title}
        value={enabled}
        onValueChange={(value) => void setHapticsEnabled(value)}
        trackColor={{ false: alpha.white15, true: withAlpha(colors.limeGreen, 0.5) }}
        thumbColor={enabled ? colors.limeGreen : colors.white}
        ios_backgroundColor={alpha.white15}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: colors.surface,
    padding: 16,
  },
  text: { flex: 1, gap: 4 },
});
