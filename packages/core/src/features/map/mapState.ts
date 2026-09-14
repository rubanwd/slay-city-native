import type { District, Location, Mission } from "@/types";

export type LocationState = "unlocked" | "completed";

export interface LocationMissionCount {
  completed: number;
  total: number;
}

export interface LocationProgress {
  /** Locations where every published mission has been completed. */
  completedLocationIds: Set<string>;
  /** The next not-yet-completed mission at each location, in `order_index` order. */
  nextMissionIdByLocation: Map<string, string>;
  /** How many of each location's published missions are done vs. how many exist. */
  missionCountsByLocation: Map<string, LocationMissionCount>;
}

/**
 * A location can have several missions played in sequence. Given every
 * published mission and the set of mission ids the player has already
 * completed, this picks — per location — the next uncompleted mission (by
 * `order_index`), flags a location "completed" once none remain, and counts
 * completed vs. total missions so the UI can show progress like "2/4".
 */
export function buildLocationProgress(
  missions: Pick<Mission, "id" | "location_id" | "order_index">[],
  completedMissionIds: ReadonlySet<string>
): LocationProgress {
  const missionsByLocation = new Map<string, Pick<Mission, "id" | "location_id" | "order_index">[]>();
  for (const mission of missions) {
    const list = missionsByLocation.get(mission.location_id) ?? [];
    list.push(mission);
    missionsByLocation.set(mission.location_id, list);
  }

  const completedLocationIds = new Set<string>();
  const nextMissionIdByLocation = new Map<string, string>();
  const missionCountsByLocation = new Map<string, LocationMissionCount>();

  for (const [locationId, locationMissions] of missionsByLocation) {
    const sorted = [...locationMissions].sort((a, b) => a.order_index - b.order_index);
    const next = sorted.find((mission) => !completedMissionIds.has(mission.id));
    const completedCount = sorted.filter((mission) => completedMissionIds.has(mission.id)).length;

    missionCountsByLocation.set(locationId, { completed: completedCount, total: sorted.length });

    if (next) {
      nextMissionIdByLocation.set(locationId, next.id);
    } else {
      completedLocationIds.add(locationId);
    }
  }

  return { completedLocationIds, nextMissionIdByLocation, missionCountsByLocation };
}

export interface LocationRewardTotals {
  xp: number;
  coins: number;
}

/**
 * Sums the XP/coins every published mission at each location is worth,
 * regardless of completion — used to show what a location paid out once
 * every one of its missions is done.
 */
export function sumLocationRewards(
  missions: Pick<Mission, "location_id" | "xp_reward" | "coin_reward">[]
): Map<string, LocationRewardTotals> {
  const totals = new Map<string, LocationRewardTotals>();
  for (const mission of missions) {
    const current = totals.get(mission.location_id) ?? { xp: 0, coins: 0 };
    totals.set(mission.location_id, {
      xp: current.xp + mission.xp_reward,
      coins: current.coins + mission.coin_reward,
    });
  }
  return totals;
}

export interface MapLocationViewModel {
  id: string;
  name: string;
  description: string | null;
  mapX: number;
  mapY: number;
  state: LocationState;
  missionId: string | null;
  /** The location's own map icon, if uploaded. */
  iconUrl: string | null;
  /** Total XP every mission at this location grants, once completed. */
  totalXp: number;
  /** Total coins every mission at this location grants, once completed. */
  totalCoins: number;
  /** How many of this location's published missions the player has finished. */
  missionsCompleted: number;
  /** How many published missions exist at this location in total. */
  totalMissions: number;
}

export interface MapDistrictViewModel {
  id: string;
  name: string;
  backgroundUrl: string | null;
  locations: MapLocationViewModel[];
}

/**
 * Builds the map view for every district, in `order_index` order.
 *
 * Locations are not gated against each other: every stop in a district is
 * freely playable ("unlocked") and the player picks which one to enter on the
 * map. A location is "completed" once all of its missions are done. Which
 * single district the player is in right now is decided by
 * {@link selectActiveDistrict}.
 */
export function buildMapViewModel(
  districts: Pick<District, "id" | "name" | "order_index" | "background_image_url">[],
  locations: Pick<Location, "id" | "district_id" | "name" | "description" | "order_index" | "map_x" | "map_y" | "icon_url">[],
  completedLocationIds: ReadonlySet<string>,
  missionIdByLocation: ReadonlyMap<string, string>,
  rewardsByLocation: ReadonlyMap<string, LocationRewardTotals> = new Map(),
  missionCountsByLocation: ReadonlyMap<string, LocationMissionCount> = new Map()
): MapDistrictViewModel[] {
  const sortedDistricts = [...districts].sort((a, b) => a.order_index - b.order_index);

  return sortedDistricts.map((district) => {
    const viewLocations: MapLocationViewModel[] = locations
      .filter((loc) => loc.district_id === district.id)
      .sort((a, b) => a.order_index - b.order_index)
      .map((loc) => ({
        id: loc.id,
        name: loc.name,
        description: loc.description,
        mapX: Number(loc.map_x ?? 50),
        mapY: Number(loc.map_y ?? 50),
        state: completedLocationIds.has(loc.id) ? "completed" : "unlocked",
        missionId: missionIdByLocation.get(loc.id) ?? null,
        iconUrl: loc.icon_url ?? null,
        totalXp: rewardsByLocation.get(loc.id)?.xp ?? 0,
        totalCoins: rewardsByLocation.get(loc.id)?.coins ?? 0,
        missionsCompleted: missionCountsByLocation.get(loc.id)?.completed ?? 0,
        totalMissions: missionCountsByLocation.get(loc.id)?.total ?? 0,
      }));

    return {
      id: district.id,
      name: district.name,
      backgroundUrl: district.background_image_url ?? null,
      locations: viewLocations,
    };
  });
}

/**
 * Districts are played in sequence: the active one is the first (by
 * `order_index` — `buildMapViewModel` returns them sorted) that still has a
 * playable mission at any of its locations. Once every location in a district
 * is done the next district takes over. When the whole city is finished the
 * last district stays on screen so the map never goes blank.
 */
export function selectActiveDistrict(
  districts: MapDistrictViewModel[]
): MapDistrictViewModel | null {
  return (
    districts.find((district) => district.locations.some((loc) => loc.missionId !== null)) ??
    districts[districts.length - 1] ??
    null
  );
}

/**
 * True once every location in a district has all of its missions done — the
 * signal used to celebrate a district clear and to know the map is about to
 * hand the player off to the next district.
 */
export function isDistrictCompleted(district: Pick<MapDistrictViewModel, "locations">): boolean {
  return (
    district.locations.length > 0 && district.locations.every((loc) => loc.state === "completed")
  );
}

/**
 * True once every district of the level is cleared — the whole level is done.
 *
 * A level with no districts (or with districts that have no locations yet) is
 * never "completed": there was nothing to finish. Reaching this state on the
 * map means there was no next level with content to move on to, since
 * `advance_my_level_if_cleared` promotes the player the moment there is.
 */
export function isLevelCompleted(districts: MapDistrictViewModel[]): boolean {
  const playable = districts.filter((district) => district.locations.length > 0);
  return playable.length > 0 && playable.every(isDistrictCompleted);
}

/**
 * Which district the read-only preview map opens on: the first one the followed
 * players have not finished — where their play is actually happening. Falls
 * back to the first district when everything is done (or when no progress is
 * being tracked at all, since then nothing is completed).
 */
export function defaultPreviewDistrictIndex(districts: MapDistrictViewModel[]): number {
  const index = districts.findIndex(
    (district) =>
      district.locations.length > 0 &&
      district.locations.some((location) => location.state !== "completed")
  );
  return index === -1 ? 0 : index;
}

/**
 * Where the mascot stands when the map opens: the earliest stop that still has
 * a mission to play. Falls back to the first location when everything in the
 * district is completed.
 */
export function defaultSelectedLocation(
  locations: MapLocationViewModel[]
): MapLocationViewModel | null {
  return locations.find((loc) => loc.missionId !== null) ?? locations[0] ?? null;
}

/**
 * Hard cap on stops the map shows at once. The layout is hand-tuned for up
 * to this many and is intentionally scroll-free, so it can never grow past
 * it regardless of how many locations exist in the database.
 */
export const MAX_VISIBLE_LOCATIONS = 6;

/**
 * When there are more locations than the map can show at once, picks a
 * window of `max` consecutive stops centered on the player's frontier (the
 * default-selected location) — so the next thing to play is always visible —
 * instead of always showing the earliest (or latest) stops.
 */
export function selectVisibleLocations(
  locations: MapLocationViewModel[],
  max: number = MAX_VISIBLE_LOCATIONS
): MapLocationViewModel[] {
  if (locations.length <= max) return locations;

  const frontier = defaultSelectedLocation(locations);
  const anchorIndex = frontier ? locations.findIndex((loc) => loc.id === frontier.id) : -1;
  const anchor = anchorIndex === -1 ? locations.length - 1 : anchorIndex;
  const start = Math.min(Math.max(0, anchor - Math.floor(max / 2)), locations.length - max);

  return locations.slice(start, start + max);
}
