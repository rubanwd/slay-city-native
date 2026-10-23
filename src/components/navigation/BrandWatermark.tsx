import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated from "react-native-reanimated";

import { colors, fontFamilyByWeight, withAlpha } from "@slay/tokens";

import { useWatermarkBreathe } from "~/animations";

const WATERMARK_TEXT = "Slay School";
/** How far each letter's flash trails the one before it — the sweep speed. */
const WATERMARK_STAGGER_MS = 55;
const STRIP_HEIGHT = 38;

/**
 * Port of upstream's `BrandWatermark` in `BottomNav.tsx`: the "Slay School"
 * wordmark in a 38pt strip under the tab bar. Each letter runs its own
 * `watermark-breathe` flash, offset by 55ms, so the highlight sweeps left to
 * right instead of the word blinking at once.
 *
 * The web stretches an SVG `<text>` to 70% of the screen; here the letters are
 * spread across a row 70% wide, sized as that SVG scales its 80-unit font, so
 * the wordmark fills the same span at the same height.
 */
export function BrandWatermark() {
  const { width } = useWindowDimensions();
  const span = Math.min(width, 448) * 0.7;
  // The web's SVG is 700×100 units fitted ("meet") into 70% × 38pt, so the
  // strip's height caps the scale on a phone.
  const fontSize = Math.min(span / 700, STRIP_HEIGHT / 100) * 80;

  return (
    <View style={styles.strip} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.row, { width: span }]}>
        {[...WATERMARK_TEXT].map((char, index) => (
          <Letter key={`${char}-${index}`} char={char} fontSize={fontSize} delayMs={index * WATERMARK_STAGGER_MS} />
        ))}
      </View>
    </View>
  );
}

function Letter({ char, fontSize, delayMs }: { char: string; fontSize: number; delayMs: number }) {
  const breathe = useWatermarkBreathe(delayMs);
  return (
    <Animated.Text style={[styles.letter, { fontSize, lineHeight: fontSize }, breathe]}>{char}</Animated.Text>
  );
}

const styles = StyleSheet.create({
  strip: { height: STRIP_HEIGHT, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(colors.white, 0.06), overflow: "hidden" },
  // The web nudges the wordmark 6px down inside the strip.
  row: { flexDirection: "row", justifyContent: "space-between", transform: [{ translateY: 6 }] },
  letter: { color: colors.white, fontFamily: fontFamilyByWeight["900"] },
});
