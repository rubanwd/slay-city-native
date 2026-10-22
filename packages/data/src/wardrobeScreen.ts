import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";
import { resolveMascotImage } from "@slay/core";

/** One catalog item as the wardrobe shows it. */
export interface WardrobeItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  cost: number;
  unlockLevel: number | null;
  isDefault: boolean;
  /** Bought, or a default item everyone has. */
  owned: boolean;
  equipped: boolean;
}

export interface WardrobeData {
  items: WardrobeItem[];
  coins: number;
  level: number;
  /** The mascot as it looks now — the most recently equipped item's art. */
  mascotImageUrl: string;
}

/**
 * The wardrobe — the queries of upstream's server page
 * `src/app/wardrobe/page.tsx`: the published catalog by category and order,
 * what the player owns and wears, their coins and level, and the mascot art
 * that results.
 */
export async function loadWardrobe(db: SupabaseClient<Database>): Promise<WardrobeData> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { items: [], coins: 0, level: 1, mascotImageUrl: resolveMascotImage([]) };

  const [itemsRes, ownedRes, statsRes] = await Promise.all([
    db
      .from("wardrobe_items")
      .select("id, name, description, item_type, cost_coins, unlock_level, is_default, image_url, preview_url")
      .eq("is_published", true)
      .order("item_type")
      .order("order_index"),
    db.from("user_wardrobe_items").select("wardrobe_item_id, equipped, equipped_at").eq("profile_id", user.id),
    db.from("user_stats").select("coins, level").eq("profile_id", user.id).maybeSingle(),
  ]);
  // A failed read must not look like an empty shop or a broke player.
  if (itemsRes.error) throw itemsRes.error;
  if (ownedRes.error) throw ownedRes.error;
  if (statsRes.error) throw statsRes.error;

  const ownedRows = ownedRes.data ?? [];
  const equippedById = new Map(ownedRows.map((row) => [row.wardrobe_item_id, row.equipped]));
  const equippedAtById = new Map(ownedRows.map((row) => [row.wardrobe_item_id, row.equipped_at]));
  const catalog = itemsRes.data ?? [];

  return {
    items: catalog.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.item_type,
      imageUrl: item.image_url,
      cost: item.cost_coins,
      unlockLevel: item.unlock_level,
      isDefault: item.is_default,
      owned: item.is_default || equippedById.has(item.id),
      equipped: equippedById.get(item.id) ?? false,
    })),
    coins: statsRes.data?.coins ?? 0,
    level: statsRes.data?.level ?? 1,
    // The preview reflects the most recently equipped item's artwork.
    mascotImageUrl: resolveMascotImage(
      catalog
        .filter((item) => equippedById.get(item.id) === true)
        .map((item) => ({
          previewUrl: item.preview_url,
          imageUrl: item.image_url,
          equippedAt: equippedAtById.get(item.id) ?? null,
        }))
    ),
  };
}
