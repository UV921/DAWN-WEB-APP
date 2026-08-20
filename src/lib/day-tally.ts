import { formatStudyDuration } from "@/lib/study-time";
import { isHabitComplete, type HabitCompleteOpts } from "@/lib/habits";

export type DayTally = {
  wakeTime: string | null;
  wakeGoal: string;
  bedtime: string | null;
  sleepGoal: string;
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  studyMinutes: number;
  streak: number;
};

export type TallyHit = {
  xpGained: number;
  labels: string[];
  level: number;
  progress: number;
  streak: number;
  title: string;
  subtitle?: string;
};

export type DayTallyRow = {
  key: string;
  label: string;
  value: string;
  done: boolean;
  hint?: string;
};

export function emptyDayTally(
  wakeGoal: string,
  sleepGoal: string
): DayTally {
  return {
    wakeTime: null,
    wakeGoal,
    bedtime: null,
    sleepGoal,
    habitsDone: 0,
    habitsTotal: 0,
    tasksDone: 0,
    tasksTotal: 0,
    studyMinutes: 0,
    streak: 0,
  };
}

export function buildDayTally(opts: {
  wakeTime?: string | null;
  wakeGoal: string;
  bedtime?: string | null;
  sleepGoal: string;
  habits?: { key: string }[];
  checks?: Record<string, boolean>;
  todos?: { done?: boolean; parentId?: string | null }[];
  studyMinutes?: number;
  streak?: number;
  now?: number;
  sleepWindow?: { start: string; end: string };
}): DayTally {
  const habits = opts.habits || [];
  const checks = opts.checks || {};
  const todos = (opts.todos || []).filter((t) => !t.parentId);
  const completeOpts: HabitCompleteOpts | undefined =
    opts.sleepWindow && typeof opts.now === "number"
      ? { now: opts.now, sleepWindow: opts.sleepWindow }
      : undefined;
  return {
    wakeTime: opts.wakeTime || null,
    wakeGoal: opts.wakeGoal,
    bedtime: opts.bedtime || null,
    sleepGoal: opts.sleepGoal,
    habitsDone: habits.filter((h) =>
      isHabitComplete(
        { checks, wakeTime: opts.wakeTime, bedtime: opts.bedtime },
        h.key,
        completeOpts
      )
    ).length,
    habitsTotal: habits.length,
    tasksDone: todos.filter((t) => t.done).length,
    tasksTotal: todos.length,
    studyMinutes: opts.studyMinutes || 0,
    streak: opts.streak || 0,
  };
}

export function formatStudyMinutes(minutes: number): string {
  if (minutes <= 0) return "—";
  return formatStudyDuration(minutes);
}

export function tallyRows(t: DayTally): DayTallyRow[] {
  return [
    {
      key: "wake",
      label: "Wake",
      value: t.wakeTime || "—",
      done: Boolean(t.wakeTime),
      hint: `goal ${t.wakeGoal}`,
    },
    {
      key: "habits",
      label: "Habits",
      value: `${t.habitsDone}/${t.habitsTotal || 0}`,
      done: t.habitsTotal > 0 && t.habitsDone >= t.habitsTotal,
    },
    {
      key: "tasks",
      label: "Tasks",
      value: t.tasksTotal ? `${t.tasksDone}/${t.tasksTotal}` : "none",
      done: t.tasksTotal > 0 && t.tasksDone >= t.tasksTotal,
    },
    {
      key: "study",
      label: "Study",
      value: formatStudyMinutes(t.studyMinutes),
      done: t.studyMinutes > 0,
    },
    {
      key: "sleep",
      label: "Sleep",
      value: t.bedtime || "—",
      done: Boolean(t.bedtime),
      hint: `goal ${t.sleepGoal}`,
    },
  ];
}

export function tallyClosedCount(t: DayTally): {
  done: number;
  total: number;
} {
  const rows = tallyRows(t);
  return { done: rows.filter((r) => r.done).length, total: rows.length };
}
