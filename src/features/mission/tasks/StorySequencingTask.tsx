import { useMemo, useState } from "react";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { shuffle, type StorySequencingContent } from "@slay/core";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

import type { TaskProps } from "../taskContract";
import { Verdict } from "./ArrangeParts";

/**
 * Port of upstream's `StorySequencingTask`: move the steps up and down into
 * the order they happen, then check. Once the order is right the action
 * button appears; until then it is *Check Order*, as on the web.
 */
export function StorySequencingTask({ content, onComplete, actionLabel }: TaskProps<StorySequencingContent>) {
  const { prompt, steps } = content;
  const correctOrder = useMemo(() => steps.map((s) => s.id), [steps]);
  const initial = useMemo(() => {
    let order = shuffle(steps);
    for (let i = 0; i < 8 && order.map((s) => s.id).join() === correctOrder.join(); i++) {
      order = shuffle(steps);
    }
    return order;
  }, [steps, correctOrder]);
  const [order, setOrder] = useState(initial);
  const [checked, setChecked] = useState(false);
  const isCorrect = order.map((s) => s.id).join() === correctOrder.join();

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    setOrder((prev) => {
      const next = prev.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setChecked(false);
  };

  return (
    <View style={styles.wrap}>
      <SlayText variant="h3" weight="600" style={styles.center}>
        {prompt}
      </SlayText>

      <View style={styles.list}>
        {order.map((step, index) => {
          const wrongSpot = checked && !isCorrect && step.id !== correctOrder[index];
          const image = imageSource(step.imageUrl);
          return (
            <View
              key={step.id}
              style={[styles.step, checked && isCorrect ? styles.stepRight : wrongSpot ? styles.stepWrong : styles.stepIdle]}
            >
              <View style={styles.number}>
                <SlayText variant="small" weight="900" color={alpha.white70}>
                  {index + 1}
                </SlayText>
              </View>
              {image ? (
                <View style={styles.thumb}>
                  <Image source={image} style={styles.image} contentFit="cover" accessible={false} />
                </View>
              ) : null}
              <SlayText variant="small" style={styles.text}>
                {step.text}
              </SlayText>
              <View style={styles.arrows}>
                <SlayPressable
                  accessibilityRole="button"
                  accessibilityLabel="Move up"
                  hitSlop={4}
                  disabled={index === 0}
                  onPress={() => move(index, -1)}
                  style={[styles.arrow, index === 0 && styles.arrowOff]}
                >
                  <SlayText variant="small" color={alpha.white70}>
                    ▲
                  </SlayText>
                </SlayPressable>
                <SlayPressable
                  accessibilityRole="button"
                  accessibilityLabel="Move down"
                  hitSlop={4}
                  disabled={index === order.length - 1}
                  onPress={() => move(index, 1)}
                  style={[styles.arrow, index === order.length - 1 && styles.arrowOff]}
                >
                  <SlayText variant="small" color={alpha.white70}>
                    ▼
                  </SlayText>
                </SlayPressable>
              </View>
            </View>
          );
        })}
      </View>

      {checked ? <Verdict ok={isCorrect}>{isCorrect ? "Perfect order! 🎉" : "Not yet — keep rearranging."}</Verdict> : null}

      {isCorrect ? (
        <SlayButton variant="green" size="lg" onPress={() => onComplete()}>
          {actionLabel}
        </SlayButton>
      ) : (
        <SlayButton variant="pink" size="lg" onPress={() => setChecked(true)}>
          Check Order
        </SlayButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  center: { textAlign: "center" },
  list: { gap: 10 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radii.lg, borderWidth: 1, padding: 12 },
  stepIdle: { borderColor: alpha.white15, backgroundColor: alpha.white5 },
  stepRight: { borderColor: colors.limeGreen, backgroundColor: withAlpha(colors.limeGreen, 0.1) },
  stepWrong: { borderColor: withAlpha(colors.neonPink, 0.5), backgroundColor: withAlpha(colors.neonPink, 0.05) },
  number: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: alpha.white10,
  },
  thumb: { width: 48, height: 48, borderRadius: radii.sm, overflow: "hidden", backgroundColor: alpha.white5 },
  image: { width: "100%", height: "100%" },
  text: { flex: 1 },
  arrows: { gap: 4 },
  // 36pt plus a 4pt hit slop each side keeps the arrows at a 44pt target.
  arrow: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: alpha.white20,
  },
  arrowOff: { opacity: 0.25 },
});
