import { describe, expect, it } from "vitest";

import { summarizeStudyTime, utcDayKey } from "./studyTime";

describe("utcDayKey", () => {
  it("formats the UTC date", () => {
    expect(utcDayKey(new Date("2026-07-25T23:30:00.000Z"))).toBe("2026-07-25");
  });
});

describe("summarizeStudyTime", () => {
  const today = "2026-07-25";

  it("returns seven empty days when nothing was recorded", () => {
    const summary = summarizeStudyTime([], today);

    expect(summary.week).toHaveLength(7);
    expect(summary.week[0].day).toBe("2026-07-19");
    expect(summary.week[6].day).toBe(today);
    expect(summary.totalSeconds).toBe(0);
    expect(summary.weekSeconds).toBe(0);
    expect(summary.todaySeconds).toBe(0);
  });

  it("fills gaps and keeps the window in chronological order", () => {
    const summary = summarizeStudyTime(
      [
        { day: "2026-07-25", seconds: 600 },
        { day: "2026-07-21", seconds: 300 },
      ],
      today
    );

    expect(summary.week.map((entry) => entry.seconds)).toEqual([0, 0, 300, 0, 0, 0, 600]);
    expect(summary.todaySeconds).toBe(600);
    expect(summary.weekSeconds).toBe(900);
  });

  it("counts older days towards the total but not the week", () => {
    const summary = summarizeStudyTime(
      [
        { day: "2026-06-01", seconds: 1200 },
        { day: today, seconds: 60 },
      ],
      today
    );

    expect(summary.totalSeconds).toBe(1260);
    expect(summary.weekSeconds).toBe(60);
  });

  it("ignores a day ahead of today in the week window", () => {
    const summary = summarizeStudyTime(
      [
        { day: "2026-07-26", seconds: 900 },
        { day: today, seconds: 120 },
      ],
      today
    );

    expect(summary.weekSeconds).toBe(120);
    expect(summary.totalSeconds).toBe(1020);
  });

  it("crosses a month boundary correctly", () => {
    const summary = summarizeStudyTime([{ day: "2026-06-29", seconds: 60 }], "2026-07-02");

    expect(summary.week[0].day).toBe("2026-06-26");
    expect(summary.weekSeconds).toBe(60);
  });
});
