import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";
import { DEFAULT_MASCOT_IMAGE, resolveMascotImage } from "@slay/core";

export type PurchaseResult =
  | { ok: true; coinsRemaining: number }
  | { ok: false; error: string };

export type EquipResult = { ok: true } | { ok: false; error: string };

/**
 * Buys a wardrobe item for the signed-in user.
 *
 * All privileged work — checking the price/level, deducting coins from
 * user_stats and creating the ownership row — happens inside the
 * `purchase_wardrobe_item` SECURITY DEFINER function. The client has no UPDATE
 * grant on user_stats and no INSERT grant on user_wardrobe_items, so items can
 * never be acquired for free client-side.
 */
export async function purchaseWardrobeItem(
  db: SupabaseClient<Database>,
  itemId: string
): Promise<PurchaseResult> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to buy an item." };
  }

  const { data, error } = await db.rpc("purchase_wardrobe_item", {
    p_item_id: itemId,
  });

  if (error) {
    return { ok: false, error: translatePurchaseError(error.message) };
  }

  const result = data?.[0];
  if (!result) {
    return { ok: false, error: "The item could not be purchased." };
  }

  return { ok: true, coinsRemaining: result.coins_remaining };
}

/** Equips an owned (or default) item, taking off whatever was worn before. */
export async function equipWardrobeItem(
  db: SupabaseClient<Database>,
  itemId: string
): Promise<EquipResult> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to equip an item." };
  }

  const { error } = await db.rpc("equip_wardrobe_item", { p_item_id: itemId });
  if (error) {
    return { ok: false, error: translateEquipError(error.message) };
  }

  return { ok: true };
}

/** Takes the item off, leaving the mascot in its default look. */
export async function unequipWardrobeItem(
  db: SupabaseClient<Database>,
  itemId: string
): Promise<EquipResult> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to change your outfit." };
  }

  const { error } = await db.rpc("unequip_wardrobe_item", { p_item_id: itemId });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Loads the mascot image for a player: the artwork of their most recently
 * equipped wardrobe item, or the default snake when nothing equipped has art.
 * Shared by every surface that shows "your" character (map marker, wardrobe
 * preview, profile avatar) so they never drift apart.
 */
export async function loadMascotImage(
  db: SupabaseClient<Database>,
  profileId: string
): Promise<string> {
  const { data } = await db
    .from("user_wardrobe_items")
    .select("equipped_at, wardrobe_items(preview_url, image_url)")
    .eq("profile_id", profileId)
    .eq("equipped", true);

  return resolveMascotImage(
    (data ?? []).map((row) => {
      // The FK relationship comes back as a single related row (or null).
      const item = row.wardrobe_items as {
        preview_url: string | null;
        image_url: string | null;
      } | null;
      return {
        previewUrl: item?.preview_url ?? null,
        imageUrl: item?.image_url ?? null,
        equippedAt: row.equipped_at,
      };
    })
  );
}

export { DEFAULT_MASCOT_IMAGE };

function translatePurchaseError(message: string): string {
  if (message.includes("Not enough coins")) return "You don't have enough coins for this item.";
  if (message.includes("Level too low")) return "Reach a higher level to unlock this item.";
  if (message.includes("already owned")) return "You already own this item.";
  if (message.includes("Item not found")) return "This item is no longer available.";
  return message;
}

function translateEquipError(message: string): string {
  if (message.includes("not owned")) return "You need to buy this item first.";
  if (message.includes("Item not found")) return "This item is no longer available.";
  return message;
}
