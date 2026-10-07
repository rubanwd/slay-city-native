import { type SvgProps } from "react-native-svg";

/**
 * Shared prop contract for every icon in this folder, so `<Icon name="..." />`
 * can spread the same props into whichever component it resolves — including
 * icons like `CoinIcon` that ignore `color` because their palette is fixed.
 */
export interface IconProps extends Omit<SvgProps, "width" | "height" | "color"> {
  /** Width and height in points. @default 24 */
  size?: number;
  /** Fill/stroke colour, for icons whose artwork honours it. */
  color?: string;
  /** Accessible label; when omitted the icon is treated as decorative. */
  title?: string;
}
