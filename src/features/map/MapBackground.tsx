import { StyleSheet } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

import { artwork, colors } from "@slay/tokens";

/** A few pseudo-random stars — fixed so the layout is stable between renders. */
const STARS = [
  [8, 12], [18, 8], [30, 16], [44, 6], [58, 14], [70, 9], [86, 12], [93, 20],
  [14, 30], [38, 34], [64, 28], [88, 36], [24, 46], [52, 42], [76, 48],
] as const;

const SKYLINE = [
  [-1, 84, 12, 18], [11, 76, 9, 26], [20, 88, 10, 14], [30, 80, 8, 22], [38, 86, 11, 16], [49, 74, 9, 28],
  [58, 83, 10, 19], [68, 78, 8, 24], [76, 87, 11, 15], [87, 79, 9, 23], [96, 85, 6, 17],
] as const;

const WINDOWS = [[13, 80], [16, 84], [51, 78], [54, 83], [70, 82], [89, 83]] as const;

/**
 * Port of upstream's `MapBackground.tsx`: the neon-city backdrop shown for a
 * district with no background art. Purely decorative, stretched to fill so the
 * skyline always hugs the bottom edge. The sky's bottom stop is the app's
 * black, not the web's pure `#000`, so it meets the screen without a seam.
 */
export function MapBackground() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id="mapSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={artwork.map.skyTop} />
          <Stop offset="55%" stopColor={artwork.map.skyMid} />
          <Stop offset="100%" stopColor={colors.black} />
        </LinearGradient>
        <RadialGradient id="mapGlowPink" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.neonPink} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={colors.neonPink} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="mapGlowCyan" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.cyan} stopOpacity={0.3} />
          <Stop offset="100%" stopColor={colors.cyan} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Rect width="100" height="100" fill="url(#mapSky)" />

      <Ellipse cx="22" cy="24" rx="42" ry="34" fill="url(#mapGlowPink)" />
      <Ellipse cx="82" cy="58" rx="40" ry="34" fill="url(#mapGlowCyan)" />

      <G fill={colors.white}>
        {STARS.map(([cx, cy]) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={0.35} opacity={0.7} />
        ))}
      </G>

      <G fill={artwork.map.skyline} stroke={colors.purple} strokeWidth={0.4} strokeOpacity={0.6}>
        {SKYLINE.map(([x, y, width, height]) => (
          <Rect key={x} x={x} y={y} width={width} height={height} />
        ))}
      </G>

      <G fill={colors.limeGreen} fillOpacity={0.55}>
        {WINDOWS.map(([x, y]) => (
          <Rect key={`${x}-${y}`} x={x} y={y} width={1.2} height={1.6} />
        ))}
      </G>
    </Svg>
  );
}
