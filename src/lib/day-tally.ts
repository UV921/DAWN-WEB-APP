import { formatStudyDuration } from "@/lib/study-time";

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
