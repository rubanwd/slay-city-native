import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated from "react-native-reanimated";

import type { LocationState } from "@slay/core";
import { alpha, colors, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";
import { useGlowPulse, useLabelFloat } from "~/animations";

export interface MapLocationNodeProps {
  name: string;
  /** Centre of the label, in points from the map frame's top-left corner. */
  x: number;
  y: number;
  /** Database `map_x`/`map_y` (percent) — only used to stagger the float. */
  mapX: number;
  mapY: number;
  state: LocationState;
  /** The mascot stands here; Start plays this stop. */
  selected: boolean;
  onSelect: () => void;
}

/**
 * Port of upstream's `MapLocationNode.tsx`: a location drawn as just its name
 * — the district art already paints the building. The label floats (staggered
 * per location, as the web does) and lights up pink with a pulsing glow when
 * selected.
 */
export function MapLocationNode({ name, x, y, mapX, mapY, state, selected, onSelect }: MapLocationNodeProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const float = useLabelFloat(((mapX + mapY) % 5) * 400);
  const glow = useGlowPulse();
  const completed = state === "completed";

  return (
    <View
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={[
        styles.anchor,
        {
          left: x,
          top: y,
          // Centred on its point once measured; hidden for the one frame before.
          opacity: size ? 1 : 0,
          transform: [{ translateX: -(size?.width ?? 0) / 2 }, { translateY: -(size?.height ?? 0) / 2 }],
        },
      ]}
    >
      <Animated.View style={float}>
        {selected ? <Animated.View pointerEvents="none" style={[styles.glow, glow]} /> : null}
        <SlayPressable
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={`${name}${completed ? " — completed" : ""}`}
          hitSlop={8}
          onPress={onSelect}
          style={({ pressed }) => [
            styles.pill,
            { maxWidth: windowWidth * 0.38 },
            selected ? styles.selected : completed ? styles.completed : styles.open,
            pressed && styles.pressed,
          ]}
        >
          <SlayText
            variant="small"
            weight="800"
            color={completed && !selected ? colors.limeGreen : colors.white}
            style={styles.label}
          >
            {completed ? `✓ ${name}` : name}
          </SlayText>
        </SlayPressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    zIndex: 10,
  },
  glow: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
    boxShadow: `0 0 24px 4px ${withAlpha(colors.neonPink, 0.9)}`,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  open: {
    backgroundColor: withAlpha(colors.black, 0.55),
    borderColor: alpha.white25,
    boxShadow: `0 0 14px ${withAlpha(colors.limeGreen, 0.35)}`,
  },
  completed: {
    backgroundColor: withAlpha(colors.black, 0.55),
    borderColor: withAlpha(colors.limeGreen, 0.5),
  },
  selected: {
    backgroundColor: withAlpha(colors.black, 0.7),
    borderColor: colors.neonPink,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
  label: {
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
