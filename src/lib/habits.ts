export const DEFAULT_HABITS = [
  {
    key: "sleepEarly",
    label: "Sleep early",
    description: "In bed by your sleep goal",
    sortOrder: 0,
  },
  {
    key: "wakeEarly",
    label: "Wake early",
    description: "Up by your wake goal",
    sortOrder: 1,
  },
  {
    key: "noPhone",
    label: "No phone",
    description: "Phone away after bedtime / morning focus",
    sortOrder: 2,
  },
  {
    key: "gym",
    label: "Gym",
    description: "Morning training done",
    sortOrder: 3,
  },
  {
    key: "reading",
    label: "Reading",
    description: "Morning reading session",
    sortOrder: 4,
  },
  {
    key: "quran",
    label: "Quran",
    description: "Morning Quran reading",
    sortOrder: 5,
  },
] as const;

/** @deprecated use DEFAULT_HABITS / user habits — kept for legacy imports */
export const HABITS = DEFAULT_HABITS;

export type HabitKey = (typeof DEFAULT_HABITS)[number]["key"] | string;

export type HabitDef = {
  id?: string;
  key: string;
  label: string;
  description?: string;
  sortOrder?: number;
  active?: boolean;
  isDefault?: boolean;
};

export type HabitLogLike = {
  date: string;
  wakeTime: string | null;
  bedtime: string | null;
  checks?: Record<string, boolean>;
  sleepEarly?: boolean;
  noPhone?: boolean;
  wakeEarly?: boolean;
  gym?: boolean;
  reading?: boolean;
  quran?: boolean;
  notes?: string | null;
};

const LEGACY_KEYS = [
  "sleepEarly",
  "noPhone",
  "wakeEarly",
  "gym",
  "reading",
  "quran",
] as const;

export function parseChecks(raw: string | null | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function mergeLogChecks(log: {
  checks?: string | null;
  sleepEarly?: boolean;
  noPhone?: boolean;
  wakeEarly?: boolean;
  gym?: boolean;
  reading?: boolean;
  quran?: boolean;
}): Record<string, boolean> {
  const fromJson = parseChecks(log.checks ?? undefined);
  const merged = { ...fromJson };
  for (const k of LEGACY_KEYS) {
    if (merged[k] === undefined && typeof log[k] === "boolean") {
      merged[k] = Boolean(log[k]);
    }
  }
  return merged;
}

export function serializeChecks(checks: Record<string, boolean>): string {
  return JSON.stringify(checks);
}

export function legacyFieldsFromChecks(checks: Record<string, boolean>) {
  return {
    sleepEarly: Boolean(checks.sleepEarly),
    noPhone: Boolean(checks.noPhone),
    wakeEarly: Boolean(checks.wakeEarly),
    gym: Boolean(checks.gym),
    reading: Boolean(checks.reading),
    quran: Boolean(checks.quran),
  };
}

export function completedCount(
  log: HabitLogLike,
  habitKeys?: string[]
): number {
  const checks = log.checks ?? {};
  const keys =
    habitKeys && habitKeys.length > 0
      ? habitKeys
      : Object.keys(checks).length > 0
        ? Object.keys(checks)
        : [...LEGACY_KEYS];
  return keys.filter((k) => {
    if (checks[k] !== undefined) return checks[k];
    return Boolean((log as Record<string, unknown>)[k]);
  }).length;
}

export function isHabitDone(
  log: Pick<HabitLogLike, "checks"> & Record<string, unknown>,
  key: string
): boolean {
  if (log.checks && key in log.checks) return Boolean(log.checks[key]);
  return Boolean(log[key]);
}

export function isPerfectDay(log: HabitLogLike, habitKeys: string[]): boolean {
  if (habitKeys.length === 0) return false;
  return habitKeys.every((k) => isHabitDone(log, k));
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function isBeforeOrAt(actual: string, goal: string): boolean {
  return timeToMinutes(actual) <= timeToMinutes(goal);
}

export function isSleepEarly(bedtime: string, sleepGoal: string): boolean {
  const bed = timeToMinutes(bedtime);
  const goal = timeToMinutes(sleepGoal);
  if (goal >= 12 * 60) {
    return bed <= goal && bed >= 12 * 60;
  }
  return bed <= goal;
}

export function computeStreak(
  logs: HabitLogLike[],
  predicate: (log: HabitLogLike) => boolean
): { current: number; longest: number } {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const dates = [...byDate.keys()].sort();

  let longest = 0;
  let run = 0;
  let prev: string | null = null;

  for (const date of dates) {
    const log = byDate.get(date)!;
    if (!predicate(log)) {
      run = 0;
      prev = date;
      continue;
    }
    if (prev) {
      const prevDate = new Date(prev + "T12:00:00");
      const curDate = new Date(date + "T12:00:00");
      const diff =
        (curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = date;
  }

  const today = formatLocalDate(new Date());
  const yesterday = formatLocalDate(addDays(new Date(), -1));

  let current = 0;
  let cursor =
    byDate.has(today) && predicate(byDate.get(today)!)
      ? today
      : yesterday;

  while (byDate.has(cursor) && predicate(byDate.get(cursor)!)) {
    current += 1;
    cursor = formatLocalDate(addDays(new Date(cursor + "T12:00:00"), -1));
  }

  return { current, longest: Math.max(longest, current) };
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function randomInviteCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function slugifyHabitKey(label: string): string {
  const parts = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return `habit${Date.now().toString(36)}`;
  const camel =
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("");
  return camel.slice(0, 40);
}
