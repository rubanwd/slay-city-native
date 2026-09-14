import { describe, expect, it } from "vitest";

import {
  advanceDemoProgress,
  EMPTY_DEMO_PROGRESS,
  parseDemoProgress,
  selectDemoDistrict,
  serializeDemoProgress,
  type DemoProgress,
} from "./demoProgress";

describe("parseDemoProgress", () => {
  it("reads a serialized run back", () => {
    const progress: DemoProgress = { completedMissionIds: ["m1", "m2"], gated: true };
    expect(parseDemoProgress(serializeDemoProgress(progress))).toEqual(progress);
  });

  it("treats a missing cookie as nothing played", () => {
    expect(parseDemoProgress(undefined)).toEqual(EMPTY_DEMO_PROGRESS);
    expect(parseDemoProgress("")).toEqual(EMPTY_DEMO_PROGRESS);
  });

  it("treats an unparseable or wrongly shaped cookie as nothing played", () => {
    expect(parseDemoProgress("not json")).toEqual(EMPTY_DEMO_PROGRESS);
    expect(parseDemoProgress("[1,2,3]")).toEqual(EMPTY_DEMO_PROGRESS);
    expect(parseDemoProgress("null")).toEqual(EMPTY_DEMO_PROGRESS);
  });

  it("drops entries that are not mission ids", () => {
    expect(parseDemoProgress('{"completedMissionIds":["m1",7,null],"gated":false}')).toEqual({
      completedMissionIds: ["m1"],
      gated: false,
    });
  });

  it("only opens the gate for a literal true", () => {
    expect(parseDemoProgress('{"completedMissionIds":[],"gated":"yes"}').gated).toBe(false);
    expect(parseDemoProgress('{"completedMissionIds":[],"gated":true}').gated).toBe(true);
  });
});

describe("advanceDemoProgress", () => {
  it("records a finished mission without closing a location that has more", () => {
    const next = advanceDemoProgress(EMPTY_DEMO_PROGRESS, "m1", ["m1", "m2"]);
    expect(next).toEqual({ completedMissionIds: ["m1"], gated: false });
  });

  it("closes the demo once every mission of the location is done", () => {
    const first = advanceDemoProgress(EMPTY_DEMO_PROGRESS, "m1", ["m1", "m2"]);
    expect(advanceDemoProgress(first, "m2", ["m1", "m2"])).toEqual({
      completedMissionIds: ["m1", "m2"],
      gated: true,
    });
  });

  it("closes the demo on a single-mission location", () => {
    expect(advanceDemoProgress(EMPTY_DEMO_PROGRESS, "m1", ["m1"]).gated).toBe(true);
  });

  it("does not record the same mission twice when it is replayed", () => {
    const first = advanceDemoProgress(EMPTY_DEMO_PROGRESS, "m1", ["m1", "m2"]);
    expect(advanceDemoProgress(first, "m1", ["m1", "m2"]).completedMissionIds).toEqual(["m1"]);
  });

  it("keeps the gate open once it has been reached", () => {
    const gated: DemoProgress = { completedMissionIds: ["m1"], gated: true };
    expect(advanceDemoProgress(gated, "m2", ["m2", "m3"]).gated).toBe(true);
  });

  it("never closes the demo for a location with no published missions", () => {
    expect(advanceDemoProgress(EMPTY_DEMO_PROGRESS, "m1", []).gated).toBe(false);
  });
});

describe("selectDemoDistrict", () => {
  const DISTRICTS = [
    { id: "empty", locations: [] },
    { id: "first", locations: ["a"] },
    { id: "second", locations: ["b"] },
    { id: "third", locations: ["c"] },
  ];

  it("picks a random district out of those that have somewhere to play", () => {
    expect(selectDemoDistrict(DISTRICTS, { random: () => 0 })?.id).toBe("first");
    expect(selectDemoDistrict(DISTRICTS, { random: () => 0.5 })?.id).toBe("second");
    expect(selectDemoDistrict(DISTRICTS, { random: () => 0.99 })?.id).toBe("third");
  });

  it("never indexes past the end when random returns its upper bound", () => {
    expect(selectDemoDistrict(DISTRICTS, { random: () => 1 })?.id).toBe("third");
  });

  it("stays in the district the run is already being played in", () => {
    expect(selectDemoDistrict(DISTRICTS, { pinnedId: "third", random: () => 0 })?.id).toBe("third");
  });

  it("rolls again when the pinned district is gone (unpublished mid-run)", () => {
    expect(selectDemoDistrict(DISTRICTS, { pinnedId: "removed", random: () => 0 })?.id).toBe(
      "first"
    );
  });

  it("never pins to a district with nothing to play", () => {
    expect(selectDemoDistrict(DISTRICTS, { pinnedId: "empty", random: () => 0 })?.id).toBe("first");
  });

  it("returns null when no district has a location", () => {
    expect(selectDemoDistrict([{ id: "empty", locations: [] }])).toBeNull();
    expect(selectDemoDistrict([])).toBeNull();
  });
});
