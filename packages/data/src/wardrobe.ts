import { callRpc, firstRow, type Db } from "./rpc";

export type WardrobePurchaseResult = Awaited<ReturnType<typeof callRpc<"purchase_wardrobe_item">>>[number];

export async function purchaseWardrobeItem(db: Db, itemId: string): Promise<WardrobePurchaseResult> {
  const rows = await callRpc(db, "purchase_wardrobe_item", { p_item_id: itemId });
  return firstRow(rows, "purchase_wardrobe_item");
}

export async function equipWardrobeItem(db: Db, itemId: string): Promise<void> {
  await callRpc(db, "equip_wardrobe_item", { p_item_id: itemId });
}

export async function unequipWardrobeItem(db: Db, itemId: string): Promise<void> {
  await callRpc(db, "unequip_wardrobe_item", { p_item_id: itemId });
}
