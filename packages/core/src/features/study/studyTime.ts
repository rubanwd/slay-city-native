/** One UTC day's worth of recorded study time. */
export interface StudyTimeDay {
  /** ISO date, `YYYY-MM-DD`. */
  day: string;
  seconds: number;
}

export interface StudyTimeSummary {
  todaySeconds: number;
  /** Today plus the six days before it. */
  weekSeconds: number;
  totalSeconds: number;
  /**
   * Exactly seven entries, oldest first, ending on `today` — days with no
   * recorded time are present with `seconds: 0` so the bar chart keeps its
   * shape instead of collapsing gaps.
   */
  week: StudyTimeDay[];
}

/** The UTC date of `at`, formatted as `YYYY-MM-DD` — the table's day key. */
export function utcDayKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** `days` days before `dayKey`, as another day key. */
function shiftDay(dayKey: string, days: number): string {
  const shifted = new Date(`${dayKey}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return utcDayKey(shifted);
}

/**
 * Folds raw per-day rows into the numbers the dashboard shows.
 *
 * Rows may arrive in any order, may skip days entirely, and may contain days
 * ahead of `today` (a student in a timezone east of UTC finishing their evening
 * after midnight UTC) — future rows still count towards the all-time total but
 * never towards the seven-day window, which would otherwise show a bar the
 * parent's own calendar says has not happened yet.
 */
export function summarizeStudyTime(
  rows: readonly StudyTimeDay[],
  today: string
): StudyTimeSummary {
  const secondsByDay = new Map<string, number>();
  let totalSeconds = 0;

  for (const row of rows) {
    const seconds = Math.max(0, row.seconds);
    secondsByDay.set(row.day, (secondsByDay.get(row.day) ?? 0) + seconds);
    totalSeconds += seconds;
  }

  const week: StudyTimeDay[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = shiftDay(today, -offset);
    week.push({ day, seconds: secondsByDay.get(day) ?? 0 });
  }

  return {
    todaySeconds: secondsByDay.get(today) ?? 0,
    weekSeconds: week.reduce((sum, entry) => sum + entry.seconds, 0),
    totalSeconds,
    week,
  };
}
