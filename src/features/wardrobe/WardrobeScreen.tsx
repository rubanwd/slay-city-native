import { useMemo } from "react";
import { FlatList, Image, RefreshControl, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { WARDROBE_CATEGORIES, wardrobeCategoryEmoji, wardrobeCategoryLabel } from "@slay/core";
import type { WardrobeItem } from "@slay/data";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { useLookFloat } from "~/animations";
import { AppContainer } from "~/components/layout";
import { CoinAmount, CoinIcon, SlayPressable, SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

export type WardrobeAction = "buy" | "equip" | "unequip";

export interface WardrobeScreenProps {
  items: WardrobeItem[];
  coins: number;
  level: number;
  mascotImageUrl: string;
  /** The item whose action is running — only its card shows busy. */
  busyId?: string | null;
  /** Any action is running; every button waits, as on the web. */
  pending?: boolean;
  error?: string | null;
  onAction: (item: WardrobeItem, action: WardrobeAction) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const PER_ROW = 3;

type Row = { key: string; kind: "header"; category: string } | { key: string; kind: "items"; items: WardrobeItem[] };

/**
 * The grid as virtualised rows — a category header, then its items three to
 * a row — so a catalog of hundreds scrolls as smoothly as one of ten
 * (WP-4.2 AC). Only the known categories, in slot order; a retired one still
 * lingering in the catalog stays hidden, as on the web.
 */
function toRows(items: WardrobeItem[]): Row[] {
  const rows: Row[] = [];
  for (const category of WARDROBE_CATEGORIES) {
    const inCategory = items.filter((item) => item.category === category);
    if (inCategory.length === 0) continue;
    rows.push({ key: `h-${category}`, kind: "header", category });
    for (let i = 0; i < inCategory.length; i += PER_ROW) {
      rows.push({ key: `r-${category}-${i}`, kind: "items", items: inCategory.slice(i, i + PER_ROW) });
    }
  }
  return rows;
}

function ItemCard({
  item,
  coins,
  level,
  busy,
  disabled,
  onAction,
}: {
  item: WardrobeItem;
  coins: number;
  level: number;
  busy: boolean;
  disabled: boolean;
  onAction: (action: WardrobeAction) => void;
}) {
  const levelLocked = !item.owned && item.unlockLevel !== null && level < item.unlockLevel;
  const unaffordable = !item.owned && !levelLocked && coins < item.cost;
  const picture = imageSource(item.imageUrl);

  return (
    <View
      style={[styles.card, item.equipped ? styles.cardEquipped : null, !item.owned && (levelLocked || unaffordable) && styles.dimmed]}
    >
      <View style={styles.art}>
        {picture ? (
          <Image source={picture} style={styles.artImage} resizeMode="contain" accessible={false} />
        ) : (
          <SlayText variant="h1" accessible={false}>
            {wardrobeCategoryEmoji(item.category)}
          </SlayText>
        )}
      </View>
      <SlayText variant="label" weight="500" color={alpha.white80} numberOfLines={2} style={styles.name}>
        {item.name}
      </SlayText>
      {item.equipped ? (
        <View style={styles.on}>
          <SlayText variant="label" weight="700" color={colors.black} style={styles.onText}>
            ON
          </SlayText>
        </View>
      ) : null}

      {item.owned ? (
        item.equipped ? (
          <SlayPressable
            accessibilityRole="button"
            accessibilityLabel={`Take off ${item.name}`}
            accessibilityState={{ disabled, busy }}
            disabled={disabled}
            // A small button: the hit area reaches the 44pt minimum.
            hitSlop={8}
            onPress={() => onAction("unequip")}
            style={[styles.action, styles.unequip, disabled && styles.waiting]}
          >
            <SlayText variant="label" weight="600" color={alpha.white70} style={styles.actionText}>
              {busy ? "…" : "Unequip"}
            </SlayText>
          </SlayPressable>
        ) : (
          <SlayPressable
            accessibilityRole="button"
            accessibilityLabel={`Wear ${item.name}`}
            accessibilityState={{ disabled, busy }}
            disabled={disabled}
            haptic
            hitSlop={8}
            onPress={() => onAction("equip")}
            style={[styles.action, styles.equip, disabled && styles.waiting]}
          >
            <SlayText variant="label" weight="700" color={colors.black} style={styles.actionText}>
              {busy ? "…" : "Equip"}
            </SlayText>
          </SlayPressable>
        )
      ) : levelLocked ? (
        <View style={[styles.action, styles.locked]} accessible accessibilityLabel={`${item.name}: unlocks at level ${item.unlockLevel}`}>
          <SlayText variant="label" weight="600" color={alpha.white50} style={styles.actionText}>
            🔒 Lvl {item.unlockLevel}
          </SlayText>
        </View>
      ) : (
        <SlayPressable
          accessibilityRole="button"
          accessibilityLabel={`Buy ${item.name} for ${item.cost} coins`}
          accessibilityState={{ disabled: disabled || unaffordable, busy }}
          disabled={disabled || unaffordable}
          haptic
          hitSlop={8}
          onPress={() => onAction("buy")}
          style={[styles.action, styles.buy, (disabled || unaffordable) && styles.waiting]}
        >
          {busy ? (
            <SlayText variant="label" weight="700" color={colors.black} style={styles.actionText}>
              …
            </SlayText>
          ) : (
            <View style={styles.price}>
              <CoinIcon size={12} />
              <SlayText variant="label" weight="700" color={colors.black} style={styles.actionText}>
                {item.cost}
              </SlayText>
            </View>
          )}
        </SlayPressable>
      )}
    </View>
  );
}

/**
 * Port of upstream's `WardrobeGrid.tsx`: the coin balance, the mascot in its
 * current look, and the catalog by category — buy with coins, equip, take
 * off. Every write is a `SECURITY DEFINER` RPC (`purchase_wardrobe_item`,
 * `equip_wardrobe_item`, `unequip_wardrobe_item`); the database keeps exactly
 * one item worn.
 */
export function WardrobeScreen({
  items,
  coins,
  level,
  mascotImageUrl,
  busyId = null,
  pending = false,
  error = null,
  onAction,
  refreshing = false,
  onRefresh,
}: WardrobeScreenProps) {
  const rows = useMemo(() => toRows(items), [items]);
  const float = useLookFloat();
  const mascot = imageSource(mascotImageUrl);

  return (
    <AppContainer edges={["top"]} flush>
      <View style={styles.topBar}>
        <SlayText variant="h3" weight="700" accessibilityRole="header">
          Wardrobe
        </SlayText>
        <CoinAmount value={coins} label={`${coins} coins`} />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.list}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.limeGreen} /> : undefined
        }
        ListHeaderComponent={
          <View style={styles.preview}>
            <View style={styles.mascotRing}>
              <Animated.View style={[styles.mascotFloat, float]}>
                {mascot ? <Image source={mascot} style={styles.mascot} resizeMode="contain" accessibilityLabel="Your mascot" /> : null}
              </Animated.View>
            </View>
            <SlayText variant="label" weight="600" color={alpha.white50}>
              Your look
            </SlayText>
            {error ? (
              <View style={styles.error}>
                <SlayText variant="small" color={colors.neonPink} accessibilityRole="alert">
                  {error}
                </SlayText>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <SlayText variant="small" color={alpha.white50} style={styles.empty}>
            No items in the shop yet. Check back soon!
          </SlayText>
        }
        renderItem={({ item: row }) =>
          row.kind === "header" ? (
            <SlayText variant="small" weight="700" color={alpha.white50} style={styles.category} accessibilityRole="header">
              {wardrobeCategoryLabel(row.category)}
            </SlayText>
          ) : (
            <View style={styles.row}>
              {row.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  coins={coins}
                  level={level}
                  busy={pending && busyId === item.id}
                  disabled={pending}
                  onAction={(action) => onAction(item, action)}
                />
              ))}
              {/* Keep a short last row's cards a third wide. */}
              {Array.from({ length: PER_ROW - row.items.length }, (_, i) => (
                <View key={`gap-${i}`} style={styles.slot} />
              ))}
            </View>
          )
        }
      />
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: alpha.white10,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  preview: { alignItems: "center", gap: 4, paddingTop: 24, paddingBottom: 8 },
  mascotRing: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: alpha.white5,
    padding: 12,
  },
  mascotFloat: { width: "100%", height: "100%" },
  mascot: { width: "100%", height: "100%" },
  error: {
    alignSelf: "stretch",
    marginTop: 16,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: withAlpha(colors.neonPink, 0.4),
    backgroundColor: withAlpha(colors.neonPink, 0.1),
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  empty: { marginTop: 64, textAlign: "center" },
  category: { marginTop: 24, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  slot: { flex: 1 },
  card: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white15,
    backgroundColor: alpha.white5,
    padding: 8,
  },
  cardEquipped: { borderColor: colors.limeGreen },
  dimmed: { opacity: 0.6 },
  art: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: alpha.white5,
  },
  artImage: { width: "90%", height: "90%" },
  name: { textAlign: "center", textTransform: "none", letterSpacing: 0 },
  on: {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 999,
    backgroundColor: colors.limeGreen,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  onText: { fontSize: 10, letterSpacing: 0 },
  action: {
    alignSelf: "stretch",
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: { textTransform: "none", letterSpacing: 0 },
  unequip: { borderWidth: 1, borderColor: alpha.white20 },
  equip: { backgroundColor: colors.limeGreen },
  buy: { backgroundColor: colors.neonPink },
  locked: { borderWidth: 1, borderColor: alpha.white15 },
  waiting: { opacity: 0.5 },
  price: { flexDirection: "row", alignItems: "center", gap: 4 },
});
