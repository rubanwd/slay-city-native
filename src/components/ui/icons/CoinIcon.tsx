import { artwork, colors } from "@slay/tokens";
import { Circle, Path, Svg } from "react-native-svg";

import { type IconProps } from "./types";

/**
 * The Slay City coin — the canonical currency mark used everywhere a coin
 * balance, price, or coin reward appears (map HUD, wardrobe, shop prices,
 * reward screens). Ported 1:1 from `upstream/src/components/ui/CoinIcon.tsx`.
 *
 * The gold tones are fixed illustration colours, not part of the six locked
 * brand colours — they live in `artwork.coin` in `@slay/tokens` so no raw hex
 * reaches this file. `color` is accepted (for a uniform `<Icon />` API) but
 * intentionally unused — the two-tone gold disc with the lime-green star stays
 * the same regardless, so it never blurs with the cyan {@link XpIcon}.
 */
export function CoinIcon({ size = 24, title, ...rest }: IconProps) {
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
      <Circle cx="12" cy="12" r="11" fill={artwork.coin.rim} />
      <Circle cx="12" cy="12" r="9.2" fill={artwork.coin.face} />

      <Circle cx="12" cy="12" r="8.2" fill="none" stroke={artwork.coin.rim} strokeWidth={0.9} opacity={0.7} />

      <Path
        d="M12 6.7l1.35 3.44 3.69.22-2.85 2.35.94 3.58L12 14.3l-3.12 1.99.94-3.58-2.85-2.35 3.69-.22z"
        fill={artwork.coin.starShadow}
        opacity={0.35}
        transform="translate(0, 0.5)"
      />
      <Path
        d="M12 6.7l1.35 3.44 3.69.22-2.85 2.35.94 3.58L12 14.3l-3.12 1.99.94-3.58-2.85-2.35 3.69-.22z"
        fill={colors.limeGreen}
      />

      <Path
        d="M6.4 8.2a7.2 7.2 0 0 1 4.1-3.4"
        fill="none"
        stroke={colors.white}
        strokeOpacity={0.55}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </Svg>
  );
}
