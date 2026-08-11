import { formatLocalDate } from "@/lib/habits";

export type DayMode = "morning" | "day" | "evening" | "night";

function parseMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return ((h % 24) * 60 + (m % 60) + 24 * 60) % (24 * 60);
}

function inRange(t: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (start < end) return t >= start && t <= end;
  return t >= start || t <= end;
}

/** What the app should prioritize right now. */
export function resolveDayMode(
  wakeGoal: string,
  sleepGoal: string,
  now = new Date()
): DayMode {
  const n = now.getHours() * 60 + now.getMinutes();
  const wake = parseMins(wakeGoal || "06:00");
  const sleep = parseMins(sleepGoal || "23:00");

  const mornStart = (wake - 90 + 24 * 60) % (24 * 60);
  const mornEnd = (wake + 180) % (24 * 60);
  if (inRange(n, mornStart, mornEnd)) return "morning";

  const eveStart = (sleep - 120 + 24 * 60) % (24 * 60);
  const eveEnd = (sleep + 30) % (24 * 60);
  if (inRange(n, eveStart, eveEnd)) return "evening";

  if (inRange(n, eveEnd, mornStart)) return "night";
  return "day";
}

export function challengeProgress(
  startDate: string | null | undefined,
  today = formatLocalDate(new Date()),
  total = 14
): {
  active: boolean;
  day: number;
  total: number;
  daysLeft: number;
  ended: boolean;
} {
  if (!startDate) {
    return { active: false, day: 0, total, daysLeft: total, ended: false };
  }
  const start = new Date(startDate + "T12:00:00");
  const now = new Date(today + "T12:00:00");
  const diff = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  if (diff < 1) {
    return { active: true, day: 1, total, daysLeft: total, ended: false };
  }
  if (diff > total) {
    return { active: false, day: total, total, daysLeft: 0, ended: true };
  }
  return {
    active: true,
    day: diff,
    total,
    daysLeft: total - diff + 1,
    ended: false,
  };
}

export function nextCalendarDate(date: string): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return formatLocalDate(d);
}

export function prevCalendarDate(date: string): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

/** Compute new open streak given previous lastOpenDate. */
export function nextOpenStreak(
  lastOpenDate: string | null | undefined,
  openStreak: number,
  today: string
): { lastOpenDate: string; openStreak: number; isNewDay: boolean } {
  if (lastOpenDate === today) {
    return { lastOpenDate: today, openStreak, isNewDay: false };
  }
  const yesterday = prevCalendarDate(today);
  if (lastOpenDate === yesterday) {
    return { lastOpenDate: today, openStreak: openStreak + 1, isNewDay: true };
  }
  return { lastOpenDate: today, openStreak: 1, isNewDay: true };
}
