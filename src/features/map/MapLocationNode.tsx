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
  /** Missions finished here and in total — an unfinished stop shows "2/5" once started. */
  missionsCompleted?: number;
  totalMissions?: number;
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
export function MapLocationNode({
  name,
  x,
  y,
  mapX,
  mapY,
  state,
  missionsCompleted = 0,
  totalMissions = 0,
  selected,
  onSelect,
}: MapLocationNodeProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const float = useLabelFloat(((mapX + mapY) % 5) * 400);
  const glow = useGlowPulse();
  const completed = state === "completed";
  // A location only earns its ✓ once every mission is done; until then a thin
  // bar along the bottom of the label shows the progress made here.
  const inProgress = !completed && totalMissions > 0 && missionsCompleted > 0;
  const progress = inProgress ? `${missionsCompleted}/${totalMissions}` : null;

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
          accessibilityLabel={`${name}${completed ? " — completed" : progress ? ` — ${progress} missions` : ""}`}
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
          {inProgress ? <ProgressLines done={missionsCompleted} total={totalMissions} /> : null}
        </SlayPressable>
      </Animated.View>
    </View>
  );
}

/** Past this many missions the segments get too short to read: draw one continuous bar. */
const MAX_SEGMENTS = 8;

/**
 * The location's progress as thin lines under its name: one segment per
 * mission (lit once done), or a single filling bar when there are many.
 */
function ProgressLines({ done, total }: { done: number; total: number }) {
  if (total > MAX_SEGMENTS) {
    return (
      <View testID="location-progress" style={styles.progress}>
        <View style={[styles.segment, styles.track]}>
          <View style={[styles.fill, { width: `${(done / total) * 100}%` }]} />
        </View>
      </View>
    );
  }
  return (
    <View testID="location-progress" style={styles.progress}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.segment, i < done ? styles.segmentDone : styles.track]} />
      ))}
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
  progress: {
    flexDirection: "row",
    gap: 2,
    marginTop: 4,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  segmentDone: {
    backgroundColor: colors.limeGreen,
  },
  track: {
    backgroundColor: alpha.white25,
  },
  fill: {
    height: "100%",
    backgroundColor: colors.limeGreen,
  },
  label: {
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
