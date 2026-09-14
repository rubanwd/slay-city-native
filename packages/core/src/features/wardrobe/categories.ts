/**
 * Wardrobe item categories — the single source of truth shared by the
 * player-facing grid and the admin catalog editor.
 *
 * "color" was removed in the customization redesign; the "hoody" costumes were
 * later folded into "hat", so items are now split across hat / glasses /
 * accessory, each carrying its own uploaded mascot art.
 */

export const WARDROBE_CATEGORIES = ["hat", "glasses", "accessory"] as const;

export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number];

export const WARDROBE_CATEGORY_META: Record<WardrobeCategory, { label: string; emoji: string }> = {
  hat: { label: "Hats", emoji: "🧢" },
  glasses: { label: "Glasses", emoji: "🕶️" },
  accessory: { label: "Accessories", emoji: "👜" },
};

/** Type guard for validating a free-text category from a form/DB against the set. */
export function isWardrobeCategory(value: string): value is WardrobeCategory {
  return (WARDROBE_CATEGORIES as readonly string[]).includes(value);
}

export function wardrobeCategoryLabel(category: string): string {
  return isWardrobeCategory(category) ? WARDROBE_CATEGORY_META[category].label : category;
}

export function wardrobeCategoryEmoji(category: string): string {
  return isWardrobeCategory(category) ? WARDROBE_CATEGORY_META[category].emoji : "✨";
}
