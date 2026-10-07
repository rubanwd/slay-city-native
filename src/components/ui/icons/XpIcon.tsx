import { colors } from "@slay/tokens";
import { Path, Svg } from "react-native-svg";

import { type IconProps } from "./types";

/**
 * The XP mark — a progression bolt. XP is *earned* progress (it fills the
 * level bar), deliberately drawn as a lightning bolt so it never reads as a
 * spendable coin ({@link CoinIcon}). Ported 1:1 from
 * `upstream/src/components/ui/XpIcon.tsx`, where colour comes from
 * `currentColor` — here it is the explicit `color` prop instead, since React
 * Native has no CSS colour inheritance.
 */
export function XpIcon({ size = 24, color = colors.cyan, title, ...rest }: IconProps) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      accessible={Boolean(title)}
      accessibilityLabel={title}
      accessibilityRole={title ? "image" : undefined}
      {...rest}
    >
      <Path d="M13.2 2L4 13.4h5.4L8.4 22 20 9.6h-5.9z" fill={color} />
    </Svg>
  );
}
