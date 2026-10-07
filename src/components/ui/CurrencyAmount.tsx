import {
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { artwork, colors, fluidFontSize, type TextVariant } from "@slay/tokens";

import { CoinIcon, XpIcon } from "./icons";
import { SlayText } from "./SlayText";

export interface CurrencyAmountProps {
  /** The number to show. Pass a preformatted string for signed values ("+30"). */
  value: number | string;
  /**
   * Type scale step for the amount. The icon is rendered at the same size — the
   * web's `1em`.
   * @default "bodyStrong"
   */
  variant?: TextVariant;
  /** Overrides the default colour (coin gold, XP cyan). */
  color?: string;
  /** Accessible label for the whole amount, e.g. "49 coins". */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * design/SCN-56 "CoinAmount, XpAmount" — a row, gap 4, weight 700, tabular
 * figures, icon sized to the text. Ported from
 * `src/components/ui/CurrencyAmount.tsx` upstream.
 *
 * Upstream takes the colour and size through `className` because the icon scales
 * to `1em`. React Native has neither CSS inheritance nor `em`, so the size comes
 * from a `SlayText` variant and the icon is measured from it with
 * `fluidFontSize` — the one place in the design system that needs the font size
 * as a number.
 */
function useIconSize(variant: TextVariant): number {
  const { width } = useWindowDimensions();
  return fluidFontSize(variant, width);
}

/**
 * A coin balance, price or reward: the canonical Slay City coin followed by the
 * amount. The single place inline coin amounts are composed, so every screen
 * shows the same icon, gap and alignment.
 *
 * The number is `artwork.coin.text`, the token for the web's `text-yellow-300`
 * at every coin call site (design/SCN-56 X2) — gold is not a brand colour.
 */
export function CoinAmount({
  value,
  variant = "bodyStrong",
  color = artwork.coin.text,
  label,
  style,
}: CurrencyAmountProps) {
  const iconSize = useIconSize(variant);

  return (
    <View accessible={label != null} accessibilityLabel={label} style={[styles.row, style]}>
      <CoinIcon size={iconSize} />
      <SlayText variant={variant} weight="700" color={color} style={styles.amount}>
        {value}
      </SlayText>
    </View>
  );
}

/**
 * An XP amount: the cyan XP bolt followed by the amount. Mirrors
 * {@link CoinAmount} so coins and XP stay visually parallel but never identical.
 */
export function XpAmount({
  value,
  variant = "bodyStrong",
  color = colors.cyan,
  label,
  style,
}: CurrencyAmountProps) {
  const iconSize = useIconSize(variant);

  return (
    <View accessible={label != null} accessibilityLabel={label} style={[styles.row, style]}>
      <XpIcon size={iconSize} color={color} />
      <SlayText variant={variant} weight="700" color={color} style={styles.amount}>
        {value}
      </SlayText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  amount: {
    fontVariant: ["tabular-nums"],
  },
});
