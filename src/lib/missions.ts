import { formatLocalDate, isHabitDone, mergeLogChecks } from "@/lib/habits";

export type MissionKind = "run" | "manual";

export type MissionProgress = {
  active: boolean;
  day: number;
  total: number;
  daysLeft: number;
  ended: boolean;
  ongoing: boolean;
};

export type MissionHabitStat = {
  key: string;
  label: string;
  doneToday: boolean;
  daysDone: number;
};

export type MissionPublic = {
  id: string;
  title: string;
  kind: MissionKind;
  note: string;
  startDate: string;
  days: number;
  active: boolean;
  habitKeys: string[];
  taskTemplates: string[];
  progress: MissionProgress;
  habitStats: MissionHabitStat[];
  checkDates: string[];
  daysWorked: number;
  doneToday: boolean;
};

export const MAX_ACTIVE_MISSIONS = 8;
export const MAX_MISSION_DAYS = 365;

export function parseJsonArray(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v)
      ? v.map((x) => String(x).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function isMissionKind(v: unknown): v is MissionKind {
  return v === "run" || v === "manual";
}

/** Clamp length. 0 = ongoing (manual only). Habit runs stay 3–90 days. */
export function clampMissionDays(raw: unknown, kind: MissionKind): number {
  const n = Math.round(Number(raw));
  if (kind === "run") {
    if (!Number.isFinite(n)) return 7;
    return Math.min(90, Math.max(3, n));
  }
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_MISSION_DAYS, Math.max(1, n));
}

export function missionProgress(
  startDate: string | null | undefined,
  today = formatLocalDate(new Date()),
  total = 7
): MissionProgress {
  const ongoing = !total || total <= 0;
  if (!startDate) {
    return {
      active: false,
      day: 0,
      total: ongoing ? 0 : total,
      daysLeft: ongoing ? 0 : total,
      ended: false,
      ongoing,
    };
  }
  const start = new Date(startDate + "T12:00:00");
  const now = new Date(today + "T12:00:00");
  const diff = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  const day = Math.max(1, diff);
  if (ongoing) {
    return {
      active: true,
      day,
      total: 0,
      daysLeft: 0,
      ended: false,
      ongoing: true,
    };
  }
  if (diff < 1) {
    return {
      active: true,
      day: 1,
      total,
      daysLeft: total,
      ended: false,
      ongoing: false,
    };
  }
  if (diff > total) {
    return {
      active: false,
      day: total,
      total,
      daysLeft: 0,
      ended: true,
      ongoing: false,
    };
  }
  return {
    active: true,
    day,
    total,
    daysLeft: total - day + 1,
    ended: false,
    ongoing: false,
  };
}

export function missionEndDate(
  startDate: string,
  days: number
): string | null {
  if (!days || days <= 0) return null;
  const d = new Date(startDate + "T12:00:00");
  d.setDate(d.getDate() + days - 1);
  return formatLocalDate(d);
}

export function formatMissionDay(progress: MissionProgress): string {
  if (progress.ongoing) return `Day ${progress.day} · ongoing`;
  if (progress.ended) return `Finished · ${progress.total} days`;
  return `Day ${progress.day} of ${progress.total}`;
}

type LogLike = {
  date: string;
  checks?: Record<string, boolean> | string;
  sleepEarly?: boolean;
  noPhone?: boolean;
  wakeEarly?: boolean;
  gym?: boolean;
  reading?: boolean;
  quran?: boolean;
};

function mergeChecks(log: LogLike): Record<string, boolean> {
  const raw =
    typeof log.checks === "string"
      ? log.checks
      : JSON.stringify(log.checks || {});
  return mergeLogChecks({ ...log, checks: raw });
}

export function missionHabitStats(opts: {
  keys: string[];
  habits: { key: string; label: string }[];
  logs: LogLike[];
  today: string;
}): MissionHabitStat[] {
  const { keys, habits, logs, today } = opts;
  const todayLog = logs.find((l) => l.date === today);
  return keys.map((key) => {
    const label = habits.find((h) => h.key === key)?.label || key;
    const doneToday = todayLog
      ? isHabitDone({ ...todayLog, checks: mergeChecks(todayLog) }, key)
      : false;
    const daysDone = logs.filter((l) =>
      isHabitDone({ ...l, checks: mergeChecks(l) }, key)
    ).length;
    return { key, label, doneToday, daysDone };
  });
}
