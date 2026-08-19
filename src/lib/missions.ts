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

export type MissionStepPublic = {
  id: string;
  text: string;
  done: boolean;
  sortOrder: number;
};

export type MissionPublic = {
  id: string;
  title: string;
  kind: MissionKind;
  note: string;
  startDate: string;
  endDate: string | null;
  days: number;
  active: boolean;
  habitKeys: string[];
  taskTemplates: string[];
  progress: MissionProgress;
  habitStats: MissionHabitStat[];
  checkDates: string[];
  daysWorked: number;
  doneToday: boolean;
  steps: MissionStepPublic[];
};

export const MAX_ACTIVE_MISSIONS = 8;
export const MAX_MISSION_DAYS = 365;
export const MAX_MISSION_STEPS = 8;

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

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(v: unknown): v is string {
  if (typeof v !== "string" || !YMD.test(v.trim())) return false;
  const s = v.trim();
  const d = new Date(s + "T12:00:00");
  return !Number.isNaN(d.getTime()) && formatLocalDate(d) === s;
}

export function daysFromRange(start: string, end: string): number {
  const a = new Date(start + "T12:00:00");
  const b = new Date(end + "T12:00:00");
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return Math.max(1, Math.min(MAX_MISSION_DAYS, diff));
}

export function prettyMissionDate(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatMissionSpan(start: string, end: string | null): string {
  if (!end) return `From ${prettyMissionDate(start)}`;
  return `${prettyMissionDate(start)} – ${prettyMissionDate(end)}`;
}

export function resolveMissionSpan(opts: {
  kind: MissionKind;
  startDate?: unknown;
  endDate?: unknown;
  days?: unknown;
  fallbackStart: string;
}): { startDate: string; days: number; endDate: string | null } {
  const start = isYmd(opts.startDate) ? opts.startDate : opts.fallbackStart;
  if (isYmd(opts.endDate)) {
    const end = opts.endDate < start ? start : opts.endDate;
    return {
      startDate: start,
      days: daysFromRange(start, end),
      endDate: end,
    };
  }
  const noEnd =
    opts.endDate === "" ||
    opts.endDate === null ||
    opts.endDate === "ongoing";
  if (noEnd && opts.kind === "manual") {
    const rawDays = opts.days;
    if (
      rawDays === undefined ||
      rawDays === "" ||
      rawDays === 0 ||
      rawDays === "0"
    ) {
      return { startDate: start, days: 0, endDate: null };
    }
  }
  const days = clampMissionDays(opts.days, opts.kind);
  return {
    startDate: start,
    days,
    endDate: missionEndDate(start, days),
  };
}

export function formatMissionDay(progress: MissionProgress): string {
  if (progress.ongoing) return `Day ${progress.day} · ongoing`;
  if (progress.ended) return `Finished · ${progress.total} days`;
  return `Day ${progress.day} of ${progress.total}`;
}

/** Day count plus how many days remain to finish. */
export function formatMissionRemaining(progress: MissionProgress): string {
  if (progress.ongoing) return `Day ${progress.day} · ongoing`;
  if (progress.ended) return `Finished · ${progress.total} days`;
  if (progress.daysLeft <= 0) return formatMissionDay(progress);
  if (progress.daysLeft === 1) {
    return `Day ${progress.day} of ${progress.total} · last day`;
  }
  return `Day ${progress.day} of ${progress.total} · ${progress.daysLeft} days left`;
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
