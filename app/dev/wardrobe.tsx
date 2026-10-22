import { Redirect } from "expo-router";
import { useState } from "react";

import type { WardrobeItem } from "@slay/data";

import { WardrobeScreen } from "~/features/wardrobe";

const item = (id: string, name: string, category: string, cost: number, extra: Partial<WardrobeItem> = {}): WardrobeItem => ({
  id,
  name,
  description: null,
  category,
  imageUrl: `/wardrobe/${id}`,
  cost,
  unlockLevel: null,
  isDefault: false,
  owned: false,
  equipped: false,
  ...extra,
});

const CATALOG: WardrobeItem[] = [
  item("hat-red-cap.webp", "Red Cap", "hat", 0, { isDefault: true, owned: true }),
  item("hat-crown.webp", "Crown", "hat", 120, { owned: true, equipped: true }),
  item("hat-pirate.webp", "Pirate", "hat", 40),
  item("hat-santa.webp", "Santa", "hat", 60, { unlockLevel: 5 }),
  item("hat-dino.webp", "Dino", "hat", 300),
  item("glasses-pink.webp", "Pink Shades", "glasses", 25, { owned: true }),
  item("star-glasses.png", "Star Glasses", "glasses", 35),
  item("accessory-bag.webp", "Bag", "accessory", 50),
  item("accessory-umbrella.webp", "Umbrella", "accessory", 80, { unlockLevel: 8 }),
];

/**
 * The wardrobe with a made-up catalog and no backend; buying and equipping
 * flip local state. Artwork resolves against `EXPO_PUBLIC_WEB_ORIGIN`. Dev-only.
 */
export default function WardrobePreviewScreen() {
  const [items, setItems] = useState(CATALOG);
  const [coins, setCoins] = useState(150);
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <WardrobeScreen
      items={items}
      coins={coins}
      level={3}
      mascotImageUrl="/wardrobe/slay-base.webp"
      onAction={(target, action) => {
        if (action === "buy") setCoins((c) => c - target.cost);
        setItems((all) =>
          all.map((it) =>
            it.id === target.id
              ? { ...it, owned: true, equipped: action === "equip" ? true : action === "unequip" ? false : it.equipped }
              : action === "equip"
                ? { ...it, equipped: false }
                : it,
          ),
        );
      }}
    />
  );
}
