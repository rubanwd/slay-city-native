/**
 * Corner radii. The web repository's AGENTS.md requires `rounded-2xl` or larger on
 * every card, so `card` is the floor for a card-like surface, not a suggestion.
 */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  card: 24,
  pill: 999,
} as const;
