/**
 * SLAY CITY brand palette — the single source of truth for this repository.
 *
 * These six values are locked by the web repository's AGENTS.md under "What Not to
 * Change Without Permission". They mirror `src/styles/theme.css` upstream, where
 * they are declared as space-separated RGB channels for Tailwind's alpha modifier.
 * React Native has no CSS variables at runtime, so here they are plain hex.
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
} as const;

/** Semantic aliases, matching the upstream `--color-*` semantic layer. */
export const semantic = {
  background: colors.black,
  foreground: colors.white,
  accent: colors.neonPink,
  highlight: colors.limeGreen,
} as const;

export type ColorName = keyof typeof colors;
