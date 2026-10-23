import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { shuffle, type CategorySortContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { haptic } from "~/lib/haptics";

import type { TaskProps } from "../taskContract";
import { Chip, Tray } from "./ArrangeParts";

/** How long a wrong bucket stays pink — upstream's 450ms. */
const WRONG_FLASH_MS = 450;

/**
 * Port of upstream's `CategorySortTask`: tap a word in the tray, then the
 * category it belongs to. A wrong category flashes pink and the word goes
 * back to the tray.
 */
export function CategorySortTask({ content, onComplete, actionLabel }: TaskProps<CategorySortContent>) {
  const { prompt, categories, items } = content;
  const allItems = useMemo(
    () => shuffle(items.map((it, id) => ({ id, text: it.text, categoryIndex: it.categoryIndex }))),
    [items],
  );
  const [placed, setPlaced] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [wrongCategory, setWrongCategory] = useState<number | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const pool = allItems.filter((it) => placed[it.id] === undefined);
  const won = pool.length === 0;

  const drop = (categoryIndex: number) => {
    if (selected === null) return;
    const item = allItems.find((it) => it.id === selected);
    if (!item) return;
    setSelected(null);
    if (item.categoryIndex === categoryIndex) {
      haptic("correct");
      setPlaced((prev) => ({ ...prev, [item.id]: categoryIndex }));
      return;
    }
    haptic("wrong");
    setWrongCategory(categoryIndex);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setWrongCategory(null), WRONG_FLASH_MS);
  };

  return (
    <View style={styles.wrap}>
      <SlayText variant="h3" weight="600" style={styles.center}>
        {prompt}
      </SlayText>

      <Tray>
        {won ? (
          <SlayText variant="bodyStrong" weight="700" color={colors.limeGreen}>
            All sorted! 🎉
          </SlayText>
        ) : (
          pool.map((item) => (
            <Chip
              key={item.id}
              label={item.text}
              state={selected === item.id ? "selected" : "pool"}
              onPress={() => setSelected((prev) => (prev === item.id ? null : item.id))}
            />
          ))
        )}
      </Tray>

      <View style={styles.buckets}>
        {categories.map((category, index) => {
          const contents = allItems.filter((it) => placed[it.id] === index);
          return (
            <SlayPressable
              // Category names are plain strings and may repeat; position is identity.
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`Put in ${category}`}
              accessibilityState={{ disabled: won || selected === null }}
              disabled={won || selected === null}
              onPress={() => drop(index)}
              style={[
                styles.bucket,
                wrongCategory === index ? styles.bucketWrong : selected !== null ? styles.bucketReady : styles.bucketIdle,
              ]}
            >
              <SlayText variant="label" color={alpha.white50}>
                {category}
              </SlayText>
              <View style={styles.sorted}>
                {contents.length === 0 ? (
                  <SlayText variant="small" color={alpha.white25}>
                    Drop words here…
                  </SlayText>
                ) : (
                  contents.map((it) => (
                    <View key={it.id} style={styles.sortedWord}>
                      <SlayText variant="small" weight="700" color={colors.limeGreen}>
                        {it.text}
                      </SlayText>
                    </View>
                  ))
                )}
              </View>
            </SlayPressable>
          );
        })}
      </View>

      <SlayButton variant="green" size="lg" disabled={!won} onPress={() => onComplete()}>
        {actionLabel}
      </SlayButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  center: { textAlign: "center" },
  buckets: { gap: 12 },
  bucket: { gap: 8, borderRadius: radii.lg, borderWidth: 2, padding: 12 },
  bucketIdle: { borderColor: alpha.white15, backgroundColor: alpha.white5 },
  bucketReady: { borderColor: withAlpha(colors.cyan, 0.6), backgroundColor: withAlpha(colors.cyan, 0.05) },
  bucketWrong: { borderColor: colors.neonPink, backgroundColor: withAlpha(colors.neonPink, 0.1) },
  sorted: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sortedWord: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: withAlpha(colors.limeGreen, 0.5),
    backgroundColor: withAlpha(colors.limeGreen, 0.1),
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
