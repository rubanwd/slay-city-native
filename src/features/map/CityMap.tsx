import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View, type LayoutRectangle } from "react-native";

import {
  defaultSelectedLocation,
  isDistrictCompleted,
  MAP_ASPECT,
  MAX_VISIBLE_LOCATIONS,
  selectVisibleLocations,
} from "@slay/core";
import type { MapScreenData } from "@slay/data";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { CoinAmount, SlayButton, SlayPressable, SlayText, XpAmount } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";
import { playSfx } from "~/lib/sfx";

import { MapBackground } from "./MapBackground";
import { MapLocationNode } from "./MapLocationNode";
import { MascotMarker } from "./MascotMarker";

/** Why the map was opened — set by the reward screen (WP-3.7) on its way back here. */
export interface MapArrival {
  /** Walk the mascot straight to this location. */
  focus?: string;
  milestone?: "location" | "district" | "level";
  /** The location just finished, or the level just reached. */
  name?: string;
}

export interface CityMapProps extends MapScreenData {
  arrival?: MapArrival;
  onStartMission: (missionId: string) => void;
  /** Asks for confirmation itself; resolves once the reset has been requested. */
  onRestartLocation: (locationId: string, name: string) => void;
  onReplayLevel: (levelName: string) => void;
  restarting?: boolean;
}

function milestoneText(arrival: MapArrival | undefined, districtName: string | undefined): string | null {
  switch (arrival?.milestone) {
    case "level":
      return arrival.name ? `🏆 Level cleared! Welcome to ${arrival.name}.` : "🏆 Level cleared! Amazing work.";
    case "district":
      return `🏙️ District cleared! Welcome to ${districtName ?? "the next district"}.`;
    case "location":
      return `✓ ${arrival.name ?? "Location"} complete!`;
    default:
      return null;
  }
}

/**
 * Port of upstream's `CityMap.tsx` — the student's home. A fixed 5:7 frame
 * (`MAP_ASPECT`, the same frame the admin position picker uses) so a location
 * placed in the admin lands on the same spot here; up to six locations; the
 * mascot over the selected one; and a panel below with its progress and Start.
 *
 * Deliberately no pan or zoom: the web map has none, and the coordinates are
 * authored for this frame.
 *
 * Not here yet: the travel and start sounds (WP-6.2) and the Homework tab's
 * visibility, which the tab layout will read from `showHomework` (WP-4.1).
 */
export function CityMap({
  district,
  hud,
  mascotImageUrl,
  levelStatus,
  arrival,
  onStartMission,
  onRestartLocation,
  onReplayLevel,
  restarting = false,
}: CityMapProps) {
  const locations = selectVisibleLocations(district?.locations ?? [], MAX_VISIBLE_LOCATIONS);

  // The mascot starts on the earliest stop that still has a mission, or on
  // the one the reward screen sent us back to.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => arrival?.focus ?? defaultSelectedLocation(locations)?.id ?? null,
  );
  // Falls back to the frontier when the picked stop leaves the window, e.g.
  // after a refetch.
  const selected = locations.find((l) => l.id === selectedId) ?? defaultSelectedLocation(locations);
  // "Nothing left to play here": a stop that still has a mission shows Start.
  const isCompleted = Boolean(selected && !selected.missionId && selected.state === "completed");

  const [banner, setBanner] = useState(() => milestoneText(arrival, district?.name));
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 4500);
    return () => clearTimeout(timer);
  }, [banner]);

  const [area, setArea] = useState<LayoutRectangle | null>(null);
  // The largest MAP_ASPECT frame that fits the area, pinned to its top.
  const frame = area
    ? (() => {
        const width = Math.min(area.width, area.height * MAP_ASPECT);
        return { width, height: width / MAP_ASPECT };
      })()
    : null;

  const background = imageSource(district?.backgroundUrl);
  const mascot = imageSource(mascotImageUrl);
  const [loadedBackground, setLoadedBackground] = useState<string | null>(null);
  const backgroundLoaded = !background || loadedBackground === district?.backgroundUrl;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <SlayText variant="h3" weight="900" color={colors.limeGreen} style={styles.uppercase}>
          Slay City
        </SlayText>
        <View style={styles.hud}>
          <View style={styles.hudPill}>
            <SlayText variant="small" weight="700">
              Lvl {hud.level} · {hud.xp} XP
            </SlayText>
          </View>
          <CoinAmount value={hud.coins} variant="small" label={`${hud.coins} coins`} style={styles.hudPill} />
        </View>
      </View>

      {district ? (
        <View style={styles.districtBar}>
          <SlayText variant="bodyStrong" weight="900" numberOfLines={1} style={[styles.uppercase, styles.center]}>
            {district.name}
            {isDistrictCompleted(district) ? (
              <SlayText variant="bodyStrong" weight="900" color={colors.limeGreen}>
                {"  ✓ cleared"}
              </SlayText>
            ) : null}
          </SlayText>
        </View>
      ) : null}

      <View style={styles.area} onLayout={(event) => setArea(event.nativeEvent.layout)}>
        {background ? (
          <Image source={background} blurRadius={24} style={styles.backdrop} resizeMode="cover" accessible={false} />
        ) : null}

        {frame ? (
          <View style={[styles.frame, frame]}>
            {background ? (
              <Image
                source={background}
                style={[StyleSheet.absoluteFill, { opacity: backgroundLoaded ? 1 : 0 }]}
                resizeMode="cover"
                accessible={false}
                onLoad={() => setLoadedBackground(district?.backgroundUrl ?? null)}
              />
            ) : (
              <MapBackground />
            )}

            {locations.map((loc) => (
              <MapLocationNode
                key={loc.id}
                name={loc.name}
                x={(loc.mapX / 100) * frame.width}
                y={(loc.mapY / 100) * frame.height}
                mapX={loc.mapX}
                mapY={loc.mapY}
                state={loc.state}
                selected={loc.id === selected?.id}
                onSelect={() => {
                  // Only worth a sound when the mascot actually walks somewhere new.
                  if (loc.id !== selected?.id) playSfx("mapTravel");
                  setSelectedId(loc.id);
                }}
              />
            ))}

            {selected && mascot ? (
              <MascotMarker
                x={(selected.mapX / 100) * frame.width}
                y={(selected.mapY / 100) * frame.height}
                source={mascot}
              />
            ) : null}
          </View>
        ) : null}

        {!backgroundLoaded ? (
          <View style={styles.loader} accessibilityLabel="Loading map…">
            <ActivityIndicator size="large" color={colors.limeGreen} />
          </View>
        ) : null}

        {banner ? (
          <View style={styles.bannerRow} pointerEvents="none">
            <View style={styles.banner}>
              <SlayText
                variant="small"
                weight="800"
                color={colors.limeGreen}
                accessibilityLiveRegion="polite"
                style={styles.center}
              >
                {banner}
              </SlayText>
            </View>
          </View>
        ) : null}
      </View>

      {levelStatus.completed ? (
        <View style={styles.panel}>
          <View style={styles.levelCard}>
            <SlayText variant="bodyStrong" weight="900" color={colors.limeGreen} style={styles.uppercase}>
              🏆 {levelStatus.levelName} cleared!
            </SlayText>
            <SlayText variant="small" color={alpha.white70}>
              {levelStatus.nextLevelName
                ? `You finished every district here. ${levelStatus.nextLevelName} is coming soon — it opens automatically as soon as it has content.`
                : "You finished every district in the city. That's the whole ladder!"}
            </SlayText>
            <SlayButton
              variant="ghost"
              loading={restarting}
              onPress={() => onReplayLevel(levelStatus.levelName)}
              style={styles.replay}
            >
              ↻ Play this level again
            </SlayButton>
          </View>
        </View>
      ) : null}

      {selected ? (
        <View style={styles.panel}>
          <View style={styles.selectedRow}>
            <SlayText variant="bodyStrong" weight="900" numberOfLines={1} style={styles.shrink}>
              {selected.name}
            </SlayText>
            {selected.totalMissions > 0 ? (
              <View style={[styles.countPill, isCompleted && styles.countPillDone]}>
                <SlayText variant="small" weight="700" color={isCompleted ? colors.limeGreen : alpha.white70}>
                  {selected.missionsCompleted}/{selected.totalMissions} missions
                </SlayText>
              </View>
            ) : null}
          </View>

          {isCompleted ? (
            <View style={styles.earned}>
              <CoinAmount value={`+${selected.totalCoins}`} variant="small" />
              <SlayText variant="small" weight="700" color={alpha.white60}>
                ·
              </SlayText>
              <XpAmount value={`+${selected.totalXp}`} variant="small" />
              <SlayText variant="small" weight="700" color={alpha.white60}>
                earned
              </SlayText>
            </View>
          ) : null}

          <View style={styles.actions}>
            {selected.missionId ? (
              <SlayButton
                variant="green"
                style={styles.grow}
                onPress={() => {
                  if (!selected.missionId) return;
                  playSfx("missionStart");
                  onStartMission(selected.missionId);
                }}
              >
                ▶ Start
              </SlayButton>
            ) : (
              <View style={[styles.grow, styles.doneBox]} accessibilityState={{ disabled: true }}>
                <SlayText variant="bodyStrong" weight="800" color={withAlpha(colors.limeGreen, 0.7)} style={styles.uppercase}>
                  {isCompleted ? "✓ Completed" : "Coming soon"}
                </SlayText>
              </View>
            )}

            {isCompleted ? (
              <SlayPressable
                accessibilityRole="button"
                accessibilityLabel="Restart location"
                disabled={restarting}
                onPress={() => onRestartLocation(selected.id, selected.name)}
                style={({ pressed }) => [styles.restart, pressed && styles.restartPressed, restarting && styles.disabled]}
              >
                <SlayText variant="h3" color={alpha.white70}>
                  ↻
                </SlayText>
              </SlayPressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: alpha.white10,
  },
  hud: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hudPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: alpha.white10,
  },
  districtBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: alpha.white10,
  },
  area: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    opacity: 0.4,
    transform: [{ scale: 1.1 }],
  },
  frame: {
    overflow: "hidden",
  },
  loader: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
  },
  bannerRow: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 30,
    alignItems: "center",
  },
  banner: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.limeGreen,
    backgroundColor: withAlpha(colors.black, 0.85),
    paddingHorizontal: 16,
    paddingVertical: 8,
    boxShadow: `0 0 16px ${withAlpha(colors.limeGreen, 0.45)}`,
  },
  panel: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: alpha.white10,
    gap: 8,
  },
  levelCard: {
    gap: 4,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.limeGreen,
    backgroundColor: withAlpha(colors.limeGreen, 0.1),
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  replay: {
    marginTop: 8,
    borderColor: colors.limeGreen,
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  countPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: alpha.white10,
  },
  countPillDone: {
    backgroundColor: withAlpha(colors.limeGreen, 0.15),
  },
  earned: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  grow: {
    flex: 1,
  },
  doneBox: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: withAlpha(colors.limeGreen, 0.4),
  },
  restart: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: alpha.white20,
  },
  restartPressed: {
    backgroundColor: alpha.white5,
  },
  disabled: {
    opacity: 0.5,
  },
  uppercase: {
    textTransform: "uppercase",
  },
  center: {
    textAlign: "center",
  },
  shrink: {
    flexShrink: 1,
  },
});
