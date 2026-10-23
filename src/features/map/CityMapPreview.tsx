import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Image } from "expo-image";
import { StyleSheet, View, type LayoutRectangle } from "react-native";

import {
  DEFAULT_LOCALE,
  defaultPreviewDistrictIndex,
  getMessages,
  isDistrictCompleted,
  MAP_ASPECT,
  MAX_VISIBLE_LOCATIONS,
  selectVisibleLocations,
  type Locale,
  type MapDistrictViewModel,
} from "@slay/core";
import { alpha, colors, withAlpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { CoinAmount, FullScreenLoader, SlayButton, SlayPressable, SlayText, XpAmount } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

import { MapBackground } from "./MapBackground";
import { MapLocationNode } from "./MapLocationNode";

export interface CityMapPreviewProps {
  /** Published districts of the chosen level, in play order. */
  districts: MapDistrictViewModel[];
  /** e.g. "Elementary". */
  levelName: string;
  /** One line under the title, e.g. whose city this is. */
  subtitle: string;
  /** Whose progress the ✓ marks reflect; null when none is shown, and the map is content only. */
  progressLabel?: string | null;
  /** Turns the selected stop into a way in — the teacher's list of its missions. */
  locationHref?: (locationId: string) => Href;
  /** Language for the screen's own words; names on the map are authored and stay as written. */
  locale?: Locale;
}

/** ‹ / › district stepper — the adults' stand-in for playing through the city. */
function StepButton({ direction, label, onPress, disabled }: { direction: "previous" | "next"; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <SlayPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={[styles.step, disabled && styles.dim]}
    >
      <SlayText variant="h3" weight="900" color={alpha.white70}>
        {direction === "previous" ? "‹" : "›"}
      </SlayText>
    </SlayPressable>
  );
}

/**
 * Port of upstream's `map/CityMapPreview.tsx`: the city map for the adult
 * consoles — the same frame, artwork and labels a student sees, but never a
 * game. No mascot, no HUD, no progress of the viewer's own; adults step through
 * the districts by hand, and it opens on the first one the followed players
 * haven't finished.
 *
 * Not ported: upstream's Move button for repositioning a label, a teacher-only
 * content fix that belongs with the admin's position picker.
 */
export function CityMapPreview({ districts, levelName, subtitle, progressLabel = null, locationHref, locale = DEFAULT_LOCALE }: CityMapPreviewProps) {
  const router = useRouter();
  const strings = getMessages(locale).map;
  const [districtIndex, setDistrictIndex] = useState(() => defaultPreviewDistrictIndex(districts));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const district = districts[districtIndex] ?? null;
  const locations = selectVisibleLocations(district?.locations ?? [], MAX_VISIBLE_LOCATIONS);
  // The district's first stop stands in until one is tapped: the panel never opens empty.
  const selected = locations.find((l) => l.id === selectedId) ?? locations[0] ?? null;

  const [area, setArea] = useState<LayoutRectangle | null>(null);
  const frame = area
    ? (() => {
        const width = Math.min(area.width, area.height * MAP_ASPECT);
        return { width, height: width / MAP_ASPECT };
      })()
    : null;
  const background = imageSource(district?.backgroundUrl);
  const [loadedBackground, setLoadedBackground] = useState<string | null>(null);
  const backgroundLoaded = !background || loadedBackground === district?.backgroundUrl;

  const showDistrict = (index: number) => {
    setDistrictIndex(index);
    setSelectedId(null);
  };

  return (
    <AppContainer edges={["top"]} flush>
      <View style={styles.header}>
        <View style={styles.shrink}>
          <SlayText variant="h3" weight="900" color={colors.limeGreen} style={styles.uppercase} accessibilityRole="header">
            {strings.title}
          </SlayText>
          <SlayText variant="small" color={alpha.white50} numberOfLines={1}>
            {subtitle}
          </SlayText>
        </View>
        <View style={styles.levelPill}>
          <SlayText variant="small" weight="700">
            {levelName}
          </SlayText>
        </View>
      </View>

      {districts.length === 0 ? (
        <View style={styles.nothing}>
          <SlayText variant="h3" weight="700">
            {strings.nothingTitle}
          </SlayText>
          <SlayText variant="small" color={alpha.white60} style={styles.center}>
            {strings.nothingBody(levelName)}
          </SlayText>
        </View>
      ) : (
        <>
          <View style={styles.stepper}>
            <StepButton direction="previous" label={strings.previousDistrict} onPress={() => showDistrict(Math.max(0, districtIndex - 1))} disabled={districtIndex === 0} />
            <View style={styles.districtText}>
              <SlayText variant="bodyStrong" weight="900" numberOfLines={1} style={[styles.uppercase, styles.center]}>
                {district && isDistrictCompleted(district) ? (
                  <SlayText variant="bodyStrong" weight="900" color={colors.limeGreen}>
                    {"✓ "}
                  </SlayText>
                ) : null}
                {district?.name}
              </SlayText>
              <SlayText variant="label" color={alpha.white50}>
                {strings.districtOf(districtIndex + 1, districts.length)}
              </SlayText>
            </View>
            <StepButton
              direction="next"
              label={strings.nextDistrict}
              onPress={() => showDistrict(Math.min(districts.length - 1, districtIndex + 1))}
              disabled={districtIndex === districts.length - 1}
            />
          </View>

          {progressLabel ? (
            <View style={styles.progressBar}>
              <SlayText variant="label" color={withAlpha(colors.limeGreen, 0.8)} style={styles.center}>
                {strings.completedBy(progressLabel)}
              </SlayText>
            </View>
          ) : null}

          <View style={styles.area} onLayout={(event) => setArea(event.nativeEvent.layout)}>
            {background ? <Image source={background} blurRadius={24} style={styles.backdrop} contentFit="cover" accessible={false} /> : null}
            {frame ? (
              <View style={[styles.frame, frame]}>
                {background ? (
                  <Image
                    source={background}
                    style={[StyleSheet.absoluteFill, { opacity: backgroundLoaded ? 1 : 0 }]}
                    contentFit="cover"
                    accessible={false}
                    // The district art is large and revisited every time the map opens: keep it in memory too.
                    cachePolicy="memory-disk"
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
                    onSelect={() => setSelectedId(loc.id)}
                  />
                ))}
              </View>
            ) : null}
            {!backgroundLoaded ? (
              <FullScreenLoader fullScreen={false} label={strings.loadingMap} />
            ) : null}
          </View>

          <View style={styles.panel} accessibilityLabel={strings.selectedLocation}>
            {selected ? (
              <>
                <View style={styles.selectedRow}>
                  <SlayText variant="bodyStrong" weight="900" numberOfLines={1} style={styles.shrink}>
                    {selected.name}
                  </SlayText>
                  {selected.totalMissions > 0 ? (
                    <View style={[styles.countPill, selected.state === "completed" && styles.countPillDone]}>
                      <SlayText variant="small" weight="700" color={selected.state === "completed" ? colors.limeGreen : alpha.white70}>
                        {/* Without followed players every count would read "0 of n". */}
                        {progressLabel ? strings.missionsProgress(selected.missionsCompleted, selected.totalMissions) : strings.missionsCount(selected.totalMissions)}
                      </SlayText>
                    </View>
                  ) : null}
                </View>
                {selected.description ? (
                  <SlayText variant="small" color={alpha.white50} numberOfLines={2}>
                    {selected.description}
                  </SlayText>
                ) : null}
                {selected.totalMissions > 0 ? (
                  <View style={styles.rewards}>
                    <CoinAmount value={`+${selected.totalCoins}`} variant="small" />
                    <SlayText variant="small" weight="700" color={alpha.white60}>
                      ·
                    </SlayText>
                    <XpAmount value={`+${selected.totalXp}`} variant="small" />
                    <SlayText variant="small" weight="700" color={alpha.white60}>
                      {selected.state === "completed" ? strings.earnedHere : strings.toEarnHere}
                    </SlayText>
                  </View>
                ) : null}
                {locationHref ? (
                  <SlayButton variant="green" size="lg" onPress={() => router.push(locationHref(selected.id))} style={styles.open}>
                    {selected.totalMissions > 0 ? strings.openMissions : strings.openLocation}
                  </SlayButton>
                ) : null}
              </>
            ) : (
              <SlayText variant="small" color={alpha.white50}>
                {locations.length === 0 ? strings.noLocations : strings.tapLocation}
              </SlayText>
            )}
          </View>
        </>
      )}
    </AppContainer>
  );
}

const styles = StyleSheet.create({
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
  shrink: { flexShrink: 1, minWidth: 0 },
  uppercase: { textTransform: "uppercase" },
  center: { textAlign: "center" },
  levelPill: { borderRadius: 999, backgroundColor: alpha.white10, paddingHorizontal: 12, paddingVertical: 6 },
  nothing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: alpha.white10,
  },
  step: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: alpha.white20 },
  dim: { opacity: 0.25 },
  districtText: { flexShrink: 1, minWidth: 0, alignItems: "center" },
  progressBar: { paddingHorizontal: 20, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: alpha.white10 },
  area: { flex: 1, minHeight: 0, overflow: "hidden", alignItems: "center" },
  backdrop: { ...StyleSheet.absoluteFill, opacity: 0.4, transform: [{ scale: 1.1 }] },
  frame: { overflow: "hidden" },
  panel: { gap: 4, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: alpha.white10 },
  selectedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  countPill: { borderRadius: 999, backgroundColor: alpha.white10, paddingHorizontal: 10, paddingVertical: 4 },
  countPillDone: { backgroundColor: withAlpha(colors.limeGreen, 0.15) },
  rewards: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 },
  open: { marginTop: 12 },
});
