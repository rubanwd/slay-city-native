/**
 * SLAY CITY brand palette — the single source of truth for this repository.
 *
 * `neonPink`, `limeGreen`, `cyan`, `purple`, `black` and `white` are the six colours
 * locked by the web repository's AGENTS.md under "What Not to Change Without
 * Permission". They mirror `src/styles/theme.css` upstream, where they are declared
 * as space-separated RGB channels for Tailwind's alpha modifier. React Native has no
 * CSS variables at runtime, so here they are plain hex.
 *
 * `neonOrange` is declared in the same upstream `theme.css` and used for admin-only
 * accents, but it is not part of the locked six — it can change without the
 * cross-repo sign-off the other six require.
 *
 * `surface` is not a brand colour at all — it is the neutral card background the web
 * app writes as a raw `bg-[#1a1a1a]`. Naming it here keeps that hex out of every
 * component that needs it.
 *
 * Never write a raw hex value anywhere else in this repository.
 */
export const colors = {
  neonPink: "#FF2D8E",
  limeGreen: "#9DFF00",
  cyan: "#00F0FF",
  purple: "#6A00FF",
  neonOrange: "#FF8A00",
  black: "#111111",
  white: "#FFFFFF",
  surface: "#1A1A1A",
} as const;

/**
 * The exact six locked brand colours, in the order AGENTS.md lists them — distinct
 * from `colors`, which also carries `neonOrange` (admin-only, unlocked) and `surface`
 * (not a brand colour). Exists so tests and any future "is this hex allowed" check
 * can assert against the locked set without `neonOrange` or `surface` drifting in.
 */
export const lockedBrandColors = {
  neonPink: colors.neonPink,
  limeGreen: colors.limeGreen,
  cyan: colors.cyan,
  purple: colors.purple,
  black: colors.black,
  white: colors.white,
} as const;

/**
 * Colours that belong to a drawing, not to the brand — the gold of the coin, the
 * fallback map sky. They are deliberately a separate namespace from `colors`: a
 * reviewer asking "is this hex allowed?" gets "only if it is painting artwork".
 *
 * `coin.rim`, `coin.face` and `coin.starShadow` are `CoinIcon`'s own palette. The
 * web writes them inline in the SVG; naming them here is what keeps raw hex out of
 * the ported component.
 *
 * `coin.text` is the colour of a coin *number* — the web passes Tailwind's
 * `text-yellow-300` at every call site (HUD pill, reward card, wardrobe header, map
 * panel, parent card) and `coin.rain` is `yellow-400`, the gold dots in the reward
 * rain. Neither is a brand colour, so neither may be used for anything else.
 *
 * `map.*` are the fallback sky and skyline of `MapBackground`, shown only for a
 * district with no art.
 */
export const artwork = {
  coin: {
    rim: "#E0A11B",
    face: "#FFCE45",
    starShadow: "#7BB800",
    text: "#FDE047",
    rain: "#FACC15",
  },
  map: {
    skyTop: "#241246",
    skyMid: "#0A0616",
    skyline: "#160A2B",
  },
} as const;

/** Semantic aliases, matching the upstream `--color-*` semantic layer. */
export const semantic = {
  background: colors.black,
  foreground: colors.white,
  accent: colors.neonPink,
  highlight: colors.limeGreen,
  surface: colors.surface,
  /** There is no red in the palette — errors and focus both use neon-pink. */
  error: colors.neonPink,
  success: colors.limeGreen,
} as const;

/**
 * Every grey in the product is white at an opacity over the ground, never a grey
 * hex. These are the opacities the web app actually uses (borders, disabled fills,
 * placeholder text, dividers).
 */
export const alpha = {
  white5: "rgba(255, 255, 255, 0.05)",
  white10: "rgba(255, 255, 255, 0.10)",
  white15: "rgba(255, 255, 255, 0.15)",
  white20: "rgba(255, 255, 255, 0.20)",
  white25: "rgba(255, 255, 255, 0.25)",
  white40: "rgba(255, 255, 255, 0.40)",
  white50: "rgba(255, 255, 255, 0.50)",
  white60: "rgba(255, 255, 255, 0.60)",
  white70: "rgba(255, 255, 255, 0.70)",
  white80: "rgba(255, 255, 255, 0.80)",
  /** The 10% black overlay `active:brightness-90` approximates on pink/green buttons. */
  black10: "rgba(0, 0, 0, 0.10)",
} as const;

/** Converts a `colors` hex value to an rgba string at the given alpha (0–1). */
export function withAlpha(hex: string, opacity: number): string {
  const int = Number.parseInt(hex.replace("#", ""), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export type ColorName = keyof typeof colors;
