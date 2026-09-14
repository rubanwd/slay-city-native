import { describe, expect, it } from "vitest";

import {
  buildLocationProgress,
  buildMapViewModel,
  defaultPreviewDistrictIndex,
  defaultSelectedLocation,
  isLevelCompleted,
  selectActiveDistrict,
  selectVisibleLocations,
  sumLocationRewards,
} from "./mapState";

const districts = [
  { id: "d1", name: "Central Plaza", order_index: 0, background_image_url: null },
];

const locations = [
  {
    id: "l1",
    district_id: "d1",
    name: "Market Square",
    description: null,
    order_index: 0,
    map_x: 25,
    map_y: 40,
    icon_url: null,
  },
  {
    id: "l2",
    district_id: "d1",
    name: "Library Corner",
    description: null,
    order_index: 1,
    map_x: 60,
    map_y: 55,
    icon_url: null,
  },
];

describe("buildMapViewModel", () => {
  it("leaves every location unlocked — the player picks freely which one to play", () => {
    const missions = new Map([
      ["l1", "m1"],
      ["l2", "m3"],
    ]);
    const [district] = buildMapViewModel(districts, locations, new Set(), missions);

    expect(district.locations.map((l) => l.state)).toEqual(["unlocked", "unlocked"]);
  });

  it("marks a location completed once all of its missions are done", () => {
    const [district] = buildMapViewModel(districts, locations, new Set(["l1"]), new Map());

    expect(district.locations.map((l) => [l.id, l.state])).toEqual([
      ["l1", "completed"],
      ["l2", "unlocked"],
    ]);
  });

  it("attaches the next mission id for a location when one exists, otherwise null", () => {
    const missions = new Map([["l1", "m1"]]);
    const [district] = buildMapViewModel(districts, locations, new Set(), missions);

    expect(district.locations[0].missionId).toBe("m1");
    expect(district.locations[1].missionId).toBeNull();
  });

  it("returns districts sorted by order_index", () => {
    const shuffled = [
      { id: "d2", name: "Second", order_index: 1, background_image_url: null },
      { id: "d1", name: "First", order_index: 0, background_image_url: null },
    ];
    const result = buildMapViewModel(shuffled, [], new Set(), new Map());

    expect(result.map((d) => d.id)).toEqual(["d1", "d2"]);
  });
});

describe("selectActiveDistrict", () => {
  const twoDistricts = [
    { id: "d1", name: "Central Plaza", order_index: 0, background_image_url: null },
    { id: "d2", name: "Second District", order_index: 1, background_image_url: null },
  ];
  const twoDistrictLocations = [
    ...locations,
    {
      id: "l3",
      district_id: "d2",
      name: "Other District First Stop",
      description: null,
      order_index: 0,
      map_x: 10,
      map_y: 10,
      icon_url: null,
    },
  ];

  it("picks the first district (by order) that still has a playable mission", () => {
    const missions = new Map([
      ["l1", "m1"],
      ["l3", "m9"],
    ]);
    const vm = buildMapViewModel(twoDistricts, twoDistrictLocations, new Set(), missions);

    expect(selectActiveDistrict(vm)?.id).toBe("d1");
  });

  it("advances to the next district once every location in the previous one is done", () => {
    const missions = new Map([["l3", "m9"]]);
    const vm = buildMapViewModel(
      twoDistricts,
      twoDistrictLocations,
      new Set(["l1", "l2"]),
      missions
    );

    expect(selectActiveDistrict(vm)?.id).toBe("d2");
  });

  it("falls back to the last district when the whole city is completed", () => {
    const vm = buildMapViewModel(
      twoDistricts,
      twoDistrictLocations,
      new Set(["l1", "l2", "l3"]),
      new Map()
    );

    expect(selectActiveDistrict(vm)?.id).toBe("d2");
  });

  it("returns null when there are no districts", () => {
    expect(selectActiveDistrict([])).toBeNull();
  });
});

describe("isLevelCompleted", () => {
  const twoDistricts = [
    { id: "d1", name: "Central Plaza", order_index: 0, background_image_url: null },
    { id: "d2", name: "Second District", order_index: 1, background_image_url: null },
  ];
  const twoDistrictLocations = [
    ...locations,
    {
      id: "l3",
      district_id: "d2",
      name: "Other District First Stop",
      description: null,
      order_index: 0,
      map_x: 10,
      map_y: 10,
      icon_url: null,
    },
  ];

  it("is true only once every district in the level is cleared", () => {
    const vm = buildMapViewModel(
      twoDistricts,
      twoDistrictLocations,
      new Set(["l1", "l2", "l3"]),
      new Map()
    );

    expect(isLevelCompleted(vm)).toBe(true);
  });

  it("is false while any district still has a playable stop", () => {
    const vm = buildMapViewModel(
      twoDistricts,
      twoDistrictLocations,
      new Set(["l1", "l2"]),
      new Map([["l3", "m9"]])
    );

    expect(isLevelCompleted(vm)).toBe(false);
  });

  it("is false for a level with no districts", () => {
    expect(isLevelCompleted([])).toBe(false);
  });

  it("is false for a level whose districts have no locations at all", () => {
    const vm = buildMapViewModel(twoDistricts, [], new Set(), new Map());

    expect(isLevelCompleted(vm)).toBe(false);
  });

  it("ignores empty districts when the ones with stops are all cleared", () => {
    // A district with no locations yet must not hold the level open — there is
    // nothing in it to play.
    const vm = buildMapViewModel(twoDistricts, locations, new Set(["l1", "l2"]), new Map());

    expect(isLevelCompleted(vm)).toBe(true);
  });
});

describe("defaultSelectedLocation", () => {
  it("picks the earliest stop that still has a mission to play", () => {
    const missions = new Map([["l2", "m3"]]);
    const [district] = buildMapViewModel(districts, locations, new Set(["l1"]), missions);

    expect(defaultSelectedLocation(district.locations)?.id).toBe("l2");
  });

  it("falls back to the first location when everything is completed", () => {
    const [district] = buildMapViewModel(districts, locations, new Set(["l1", "l2"]), new Map());

    expect(defaultSelectedLocation(district.locations)?.id).toBe("l1");
  });

  it("returns null for an empty district", () => {
    expect(defaultSelectedLocation([])).toBeNull();
  });
});

describe("selectVisibleLocations", () => {
  const manyLocations = Array.from({ length: 10 }, (_, i) => ({
    id: `l${i}`,
    district_id: "d1",
    name: `Stop ${i}`,
    description: null,
    order_index: i,
    map_x: 50,
    map_y: 50,
    icon_url: null,
  }));

  it("windows around the frontier stop so the next thing to play stays visible", () => {
    const completed = new Set(manyLocations.slice(0, 7).map((l) => l.id));
    const missions = new Map([["l7", "m7"]]);
    const [district] = buildMapViewModel(districts, manyLocations, completed, missions);

    const visible = selectVisibleLocations(district.locations, 6);

    expect(visible).toHaveLength(6);
    expect(visible.map((l) => l.id)).toContain("l7");
  });

  it("returns everything when under the cap", () => {
    const [district] = buildMapViewModel(districts, locations, new Set(), new Map());

    expect(selectVisibleLocations(district.locations, 6)).toHaveLength(2);
  });
});

describe("buildLocationProgress", () => {
  const missions = [
    { id: "m1", location_id: "l1", order_index: 0 },
    { id: "m2", location_id: "l1", order_index: 1 },
    { id: "m3", location_id: "l2", order_index: 0 },
  ];

  it("picks the first mission (by order_index) as next when none are completed", () => {
    const { completedLocationIds, nextMissionIdByLocation } = buildLocationProgress(missions, new Set());

    expect(nextMissionIdByLocation.get("l1")).toBe("m1");
    expect(nextMissionIdByLocation.get("l2")).toBe("m3");
    expect(completedLocationIds.size).toBe(0);
  });

  it("advances to the next mission at a location once the current one is completed", () => {
    const { completedLocationIds, nextMissionIdByLocation } = buildLocationProgress(
      missions,
      new Set(["m1"])
    );

    expect(nextMissionIdByLocation.get("l1")).toBe("m2");
    expect(completedLocationIds.has("l1")).toBe(false);
  });

  it("marks a location completed once every one of its missions is completed", () => {
    const { completedLocationIds, nextMissionIdByLocation } = buildLocationProgress(
      missions,
      new Set(["m1", "m2"])
    );

    expect(completedLocationIds.has("l1")).toBe(true);
    expect(nextMissionIdByLocation.has("l1")).toBe(false);
    // l2's mission is untouched — it should be unaffected by l1's completion.
    expect(nextMissionIdByLocation.get("l2")).toBe("m3");
  });
});

describe("sumLocationRewards", () => {
  it("sums xp and coins per location across all of its missions", () => {
    const missions = [
      { location_id: "l1", xp_reward: 10, coin_reward: 5 },
      { location_id: "l1", xp_reward: 20, coin_reward: 15 },
      { location_id: "l2", xp_reward: 7, coin_reward: 3 },
    ];

    const totals = sumLocationRewards(missions);

    expect(totals.get("l1")).toEqual({ xp: 30, coins: 20 });
    expect(totals.get("l2")).toEqual({ xp: 7, coins: 3 });
  });

  it("returns an empty map for no missions", () => {
    expect(sumLocationRewards([]).size).toBe(0);
  });
});

describe("buildMapViewModel reward totals", () => {
  it("attaches each location's summed rewards, defaulting to zero when absent", () => {
    const rewards = new Map([["l1", { xp: 30, coins: 20 }]]);
    const [district] = buildMapViewModel(districts, locations, new Set(), new Map(), rewards);

    expect(district.locations.map((l) => [l.id, l.totalXp, l.totalCoins])).toEqual([
      ["l1", 30, 20],
      ["l2", 0, 0],
    ]);
  });
});

describe("defaultPreviewDistrictIndex", () => {
  const twoDistricts = [
    { id: "d1", name: "Central Plaza", order_index: 0, background_image_url: null },
    { id: "d2", name: "Second District", order_index: 1, background_image_url: null },
  ];
  const twoDistrictLocations = [
    ...locations,
    {
      id: "l3",
      district_id: "d2",
      name: "Other District First Stop",
      description: null,
      order_index: 0,
      map_x: 10,
      map_y: 10,
      icon_url: null,
    },
  ];

  it("opens on the first district the followed players have not finished", () => {
    const vm = buildMapViewModel(twoDistricts, twoDistrictLocations, new Set(["l1", "l2"]), new Map());

    expect(defaultPreviewDistrictIndex(vm)).toBe(1);
  });

  it("opens on the first district when nothing is completed", () => {
    const vm = buildMapViewModel(twoDistricts, twoDistrictLocations, new Set(), new Map());

    expect(defaultPreviewDistrictIndex(vm)).toBe(0);
  });

  it("falls back to the first district once everything is completed", () => {
    const vm = buildMapViewModel(
      twoDistricts,
      twoDistrictLocations,
      new Set(["l1", "l2", "l3"]),
      new Map()
    );

    expect(defaultPreviewDistrictIndex(vm)).toBe(0);
  });

  it("skips districts that have no locations yet", () => {
    const vm = buildMapViewModel(
      [twoDistricts[1], twoDistricts[0]].map((d, i) => ({ ...d, order_index: i })),
      locations.map((loc) => ({ ...loc, district_id: "d1" })),
      new Set(),
      new Map()
    );

    // d2 sorts first here and is empty, so the first district with something
    // to show wins.
    expect(defaultPreviewDistrictIndex(vm)).toBe(1);
  });

  it("returns 0 for an empty city", () => {
    expect(defaultPreviewDistrictIndex([])).toBe(0);
  });
});
