import { isBeforeOrAt, timeToMinutes } from "@/lib/habits";
import { addCalendarDays, formatStudyDuration } from "@/lib/study-time";

export { addCalendarDays };

/** Two focused hours is a full study day on Progress. */
export const STUDY_GOAL_MIN = 120;
/** Adult floor — under this, the sleep ratio drops. */
export const SLEEP_FLOOR_H = 7;
/** Two hours late zeros the wake ratio. */
const WAKE_LATE_ZERO_MIN = 120;

export const DAY_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type DayRatioKey = "wake" | "habits" | "tasks" | "study" | "sleep";

export type DayRatioTone = "good" | "slip" | "empty";

export type DayRatio = {
  key: DayRatioKey;
  label: string;
  pct: number;
  scored: boolean;
  value: string;
  hint: string;
  tone: DayRatioTone;
};

export type DayHabitHit = { key: string; label: string; done: boolean };

export type DayProgressInput = {
  wakeTime: string | null;
  wakeGoal: string;
  bedtime: string | null;
  sleepGoal: string;
  sleepHours: number | null;
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  studyMins: number;
  logged: boolean;
};

export type DayStripCell = {
  date: string;
  weekday: string;
  score: number | null;
  logged: boolean;
};

const RATIO_ORDER: DayRatioKey[] = [
  "wake",
  "habits",
  "tasks",
  "study",
  "sleep",
];

export function isDayIso(value: string | null | undefined): value is string {
  return Boolean(value && DAY_ISO.test(value));
}

export function clampDayIso(date: string, today: string, maxBack = 364): string {
  if (!isDayIso(date) || !isDayIso(today)) return today || date;
  const earliest = addCalendarDays(today, -maxBack);
  if (date > today) return today;
  if (date < earliest) return earliest;
  return date;
}

export function sleepHoursFromTimes(
  bedtime: string | null | undefined,
  wakeTime: string | null | undefined
): number | null {
  if (!bedtime || !wakeTime) return null;
  const bed = timeToMinutes(bedtime);
  const wake = timeToMinutes(wakeTime);
  if (!Number.isFinite(bed) || !Number.isFinite(wake)) return null;
  const mins = (wake - bed + 24 * 60) % (24 * 60);
  if (mins < 3 * 60 || mins > 14 * 60) return null;
  return Math.round((mins / 60) * 10) / 10;
}

export function wakeRatioPct(
  wakeTime: string | null,
  wakeGoal: string
): { pct: number; scored: boolean; lateMin: number | null } {
  if (!wakeTime) return { pct: 0, scored: false, lateMin: null };
  const lateMin = timeToMinutes(wakeTime) - timeToMinutes(wakeGoal);
  if (!Number.isFinite(lateMin)) {
    return { pct: 0, scored: false, lateMin: null };
  }
  if (lateMin <= 0) return { pct: 100, scored: true, lateMin };
  const pct = Math.max(
    0,
    Math.round(100 - (lateMin / WAKE_LATE_ZERO_MIN) * 100)
  );
  return { pct, scored: true, lateMin };
}

export function studyRatioPct(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.min(100, Math.round((minutes / STUDY_GOAL_MIN) * 100));
}

export function sleepRatioPct(
  hours: number | null
): { pct: number; scored: boolean } {
  if (hours == null || !Number.isFinite(hours)) {
    return { pct: 0, scored: false };
  }
  return {
    pct: Math.min(100, Math.round((hours / SLEEP_FLOOR_H) * 100)),
    scored: true,
  };
}

function toneFor(pct: number, scored: boolean): DayRatioTone {
  if (!scored) return "empty";
  if (pct >= 70) return "good";
  return "slip";
}

function hoursLabel(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function buildDayRatios(input: DayProgressInput): DayRatio[] {
  const onTime = input.wakeTime
    ? isBeforeOrAt(input.wakeTime, input.wakeGoal)
    : false;
  const wake = wakeRatioPct(input.wakeTime, input.wakeGoal);
  const habitPct =
    input.habitsTotal > 0
      ? Math.round((input.habitsDone / input.habitsTotal) * 100)
      : 0;
  const habitsScored = input.logged && input.habitsTotal > 0;
  const taskPct =
    input.tasksTotal > 0
      ? Math.round((input.tasksDone / input.tasksTotal) * 100)
      : 0;
  const tasksScored = input.tasksTotal > 0;
  const studyPct = studyRatioPct(input.studyMins);
  const studyScored = input.studyMins > 0 || input.logged;
  const sleep = sleepRatioPct(input.sleepHours);

  const wakeHint = !input.wakeTime
    ? `Goal ${input.wakeGoal}`
    : onTime
      ? `On time · goal ${input.wakeGoal}`
      : wake.lateMin != null
        ? `${wake.lateMin} min late · goal ${input.wakeGoal}`
        : `Goal ${input.wakeGoal}`;

  const sleepHint =
    input.sleepHours != null
      ? `${SLEEP_FLOOR_H}h floor`
      : input.bedtime
        ? `In bed ${input.bedtime} · goal ${input.sleepGoal}`
        : `Goal ${input.sleepGoal}`;

  const ratios: Record<DayRatioKey, DayRatio> = {
    wake: {
      key: "wake",
      label: "Wake",
      pct: wake.pct,
      scored: wake.scored,
      value: input.wakeTime || "—",
      hint: wakeHint,
      tone: toneFor(wake.pct, wake.scored),
    },
    habits: {
      key: "habits",
      label: "Habits",
      pct: habitPct,
      scored: habitsScored,
      value: input.habitsTotal
        ? `${input.habitsDone}/${input.habitsTotal}`
        : "—",
      hint: habitsScored
        ? habitPct >= 100
          ? "Every habit closed."
          : `${input.habitsTotal - input.habitsDone} still open.`
        : "No check-in this day.",
      tone: toneFor(habitPct, habitsScored),
    },
    tasks: {
      key: "tasks",
      label: "Tasks",
      pct: taskPct,
      scored: tasksScored,
      value: input.tasksTotal
        ? `${input.tasksDone}/${input.tasksTotal}`
        : "none",
      hint: tasksScored
        ? taskPct >= 100
          ? "List is clear."
          : `${input.tasksTotal - input.tasksDone} still open.`
        : "No list this day.",
      tone: toneFor(taskPct, tasksScored),
    },
    study: {
      key: "study",
      label: "Study",
      pct: studyPct,
      scored: studyScored,
      value:
        input.studyMins > 0 ? formatStudyDuration(input.studyMins) : "0m",
      hint: `${formatStudyDuration(STUDY_GOAL_MIN)} is 100%.`,
      tone: toneFor(studyPct, studyScored && input.studyMins > 0),
    },
    sleep: {
      key: "sleep",
      label: "Sleep",
      pct: sleep.pct,
      scored: sleep.scored,
      value:
        input.sleepHours != null
          ? hoursLabel(input.sleepHours)
          : input.bedtime || "—",
      hint: sleepHint,
      tone: toneFor(sleep.pct, sleep.scored),
    },
  };

  return RATIO_ORDER.map((key) => ratios[key]);
}

/** Mean of scored ratios. Null when the day has nothing to score. */
export function dayScore(ratios: DayRatio[]): number | null {
  const scored = ratios.filter((r) => r.scored);
  if (!scored.length) return null;
  return Math.round(scored.reduce((sum, r) => sum + r.pct, 0) / scored.length);
}

export function averageRatioPcts(days: DayRatio[][]): Record<DayRatioKey, number> {
  const out = {} as Record<DayRatioKey, number>;
  for (const key of RATIO_ORDER) {
    const sample = days
      .map((ratios) => ratios.find((r) => r.key === key))
      .filter((r): r is DayRatio => Boolean(r && r.scored));
    out[key] = sample.length
      ? Math.round(sample.reduce((sum, r) => sum + r.pct, 0) / sample.length)
      : 0;
  }
  return out;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayShort(iso: string): string {
  return WEEKDAYS[new Date(iso + "T12:00:00").getDay()] || "";
}

export function prettyDay(iso: string, today?: string): string {
  if (today && iso === today) return "Today";
  if (today && iso === addCalendarDays(today, -1)) return "Yesterday";
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function prettyDayLong(iso: string, today?: string): string {
  if (today && iso === today) return "Today";
  if (today && iso === addCalendarDays(today, -1)) return "Yesterday";
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function lastNDatesEnding(end: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addCalendarDays(end, -i));
  return out;
}
