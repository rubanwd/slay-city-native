import { colors } from "@slay/tokens";
import { Path, Svg } from "react-native-svg";

import { type IconProps } from "./types";

/**
 * The iOS "Share" glyph — an upward arrow escaping an open-top box. Ported
 * 1:1 from `upstream/src/components/ui/ShareIcon.tsx`, where it points at
 * Safari's share-sheet button while walking a user through the manual "Add
 * to Home Screen" flow. Kept for parity with the web icon set; the native app
 * has a real install, so nothing here calls it yet.
 */
export function ShareIcon({ size = 24, color = colors.white, title, ...rest }: IconProps) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={Boolean(title)}
      accessibilityLabel={title}
      accessibilityRole={title ? "image" : undefined}
      {...rest}
    >
      <Path d="M12 3v12" />
      <Path d="M7.5 7.5L12 3l4.5 4.5" />
      <Path d="M5 11v7.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V11" />
    </Svg>
  );
}
