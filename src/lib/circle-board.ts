/** 14h in study voice this week counts as a full study score. */
export const STUDY_WEEK_CAP_MINUTES = 14 * 60;

export type CircleBoardSort =
  | "today"
  | "habits"
  | "study"
  | "consistency"
  | "combined";

export function studyScorePct(minutes: number): number {
  return Math.min(
    100,
    Math.round((Math.max(0, minutes) / STUDY_WEEK_CAP_MINUTES) * 100)
  );
}

/** 50/50 mix of 7-day habit completion and weekly study hours. */
export function combinedScore(
  habitPct: number,
  studyWeekMinutes: number
): number {
  const habits = Math.max(0, Math.min(100, habitPct));
  return Math.round(0.5 * habits + 0.5 * studyScorePct(studyWeekMinutes));
}

export function assignRanks<T>(
  items: T[],
  score: (item: T) => number,
  id: (item: T) => string
): Map<string, number> {
  const sorted = [...items].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return id(a).localeCompare(id(b));
  });
  const ranks = new Map<string, number>();
  sorted.forEach((item, i) => ranks.set(id(item), i + 1));
  return ranks;
}
