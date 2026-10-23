import { Circle, Path, Rect, Svg } from "react-native-svg";

export type NavIconName = "map" | "wardrobe" | "homework" | "profile" | "dashboard";

/**
 * The tab icons from upstream's `BottomNav.tsx` — small single-purpose line
 * drawings, 22pt, stroked in the tab's colour. Decorative: the tab's label
 * names it.
 */
export function NavIcon({ name, color }: { name: NavIconName; color: string }) {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
    >
      {SHAPES[name]}
    </Svg>
  );
}

const SHAPES: Record<NavIconName, React.ReactElement> = {
  map: (
    <>
      <Path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
      <Path d="M9 4v13" />
      <Path d="M15 6.5v13" />
    </>
  ),
  wardrobe: (
    <>
      <Path d="M12 3a2 2 0 0 0-2 2c0 1 .8 1.7 2 2.2" />
      <Path d="M12 7.2 3.5 13.5a1 1 0 0 0 .6 1.8h15.8a1 1 0 0 0 .6-1.8L12 7.2z" />
    </>
  ),
  profile: (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
    </>
  ),
  homework: (
    <>
      <Path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <Path d="M14 2v6h6" />
      <Path d="M8 13h8M8 17h5" />
    </>
  ),
  dashboard: (
    <>
      <Rect x="3" y="3" width="7" height="9" rx="1.5" />
      <Rect x="14" y="3" width="7" height="5" rx="1.5" />
      <Rect x="3" y="16" width="7" height="5" rx="1.5" />
      <Rect x="14" y="12" width="7" height="9" rx="1.5" />
    </>
  ),
};
