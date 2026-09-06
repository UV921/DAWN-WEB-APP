import { completedCount, isHabitDone, type HabitLogLike } from "@/lib/habits";
import { lastNDates } from "@/lib/study-time";

export type ConsistencyDay = {
  date: string;
  level: number;
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  studyMinutes: number;
  wakeTime: string | null;
  wakeEarly: boolean;
  logged: boolean;
};

export type ConsistencyInput = Omit<ConsistencyDay, "level" | "date">;

/** 0 empty, 1–4 how fully the day was shown up for. Same scale as Stats. */
export function consistencyLevel(cell: ConsistencyInput): number {
  const any = cell.logged || cell.tasksTotal > 0 || cell.studyMinutes > 0;
  if (!any) return 0;
  let hits = 0;
  if (cell.wakeEarly) hits += 1;
  if (cell.habitsTotal > 0 && cell.habitsDone / cell.habitsTotal >= 0.5) {
    hits += 1;
  }
  if (cell.habitsTotal > 0 && cell.habitsDone >= cell.habitsTotal) hits += 1;
  if (cell.tasksTotal > 0 && cell.tasksDone / cell.tasksTotal >= 0.5) hits += 1;
  if (cell.studyMinutes >= 25) hits += 1;
  return Math.max(1, Math.min(4, hits));
}

export function buildConsistencyDay(
  date: string,
  log: HabitLogLike | null | undefined,
  todo: { total: number; done: number } | null | undefined,
  studyMinutes: number,
  habitKeys: string[]
): ConsistencyDay {
  const habitTotal = habitKeys.length || 6;
  const detail: ConsistencyInput = {
    habitsDone: log ? completedCount(log, habitKeys) : 0,
    habitsTotal: habitTotal,
    tasksDone: todo?.done || 0,
    tasksTotal: todo?.total || 0,
    studyMinutes: studyMinutes || 0,
    wakeTime: log?.wakeTime || null,
    wakeEarly: log ? isHabitDone(log, "wakeEarly") : false,
    logged: Boolean(log),
  };
  return { date, level: consistencyLevel(detail), ...detail };
}

export function buildWeekConsistency(opts: {
  today: string;
  logs: HabitLogLike[];
  habitKeys: string[];
  todos?: { date: string; total: number; done: number }[];
  studyDays?: { date: string; minutes: number }[];
}): ConsistencyDay[] {
  const byDate = new Map(opts.logs.map((l) => [l.date, l]));
  const todoByDate = new Map((opts.todos || []).map((t) => [t.date, t]));
  const studyByDate = new Map(
    (opts.studyDays || []).map((s) => [s.date, s.minutes])
  );
  return lastNDates(opts.today, 7).map((date) =>
    buildConsistencyDay(
      date,
      byDate.get(date),
      todoByDate.get(date),
      studyByDate.get(date) || 0,
      opts.habitKeys
    )
  );
}

export function tallyTodos(
  rows: { date: string; done: boolean }[]
): { date: string; total: number; done: number }[] {
  const byDate = new Map<string, { total: number; done: number }>();
  for (const t of rows) {
    const cur = byDate.get(t.date) || { total: 0, done: 0 };
    cur.total += 1;
    if (t.done) cur.done += 1;
    byDate.set(t.date, cur);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}
