import { prisma } from "@/lib/prisma";
import {
  completedCount,
  formatLocalDate,
  mergeLogChecks,
} from "@/lib/habits";

export type LandingPoint = {
  date: string;
  label: string;
  habitPct: number;
  taskPct: number | null;
};

export type LandingSnapshot = {
  people: number;
  mornings: number;
  tasksDone: number;
  tasksTotal: number;
  wakesToday: number;
  series: LandingPoint[];
};

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(formatLocalDate(d));
  }
  return out;
}

let landingCache: { at: number; data: LandingSnapshot } | null = null;

export async function getLandingSnapshot(): Promise<LandingSnapshot> {
  const empty: LandingSnapshot = {
    people: 0,
    mornings: 0,
    tasksDone: 0,
    tasksTotal: 0,
    wakesToday: 0,
    series: [],
  };

  const cached = landingCache;
  if (cached && Date.now() - cached.at < 60_000) return cached.data;

  try {
    const dates = lastNDates(14);
    const since = dates[0];
    const today = dates[dates.length - 1];

    const [people, logs, todos] = await Promise.all([
      prisma.user.count({ where: { onboardingDone: true } }),
      prisma.habitLog.findMany({
        where: { date: { gte: since } },
        select: {
          date: true,
          wakeTime: true,
          checks: true,
          sleepEarly: true,
          noPhone: true,
          wakeEarly: true,
          gym: true,
          reading: true,
          quran: true,
        },
      }),
      prisma.todo.findMany({
        where: { date: { gte: since } },
        select: { date: true, done: true },
      }),
    ]);

    const todoByDate = new Map<string, { total: number; done: number }>();
    for (const t of todos) {
      const cur = todoByDate.get(t.date) || { total: 0, done: 0 };
      cur.total += 1;
      if (t.done) cur.done += 1;
      todoByDate.set(t.date, cur);
    }

    const logsByDate = new Map<string, typeof logs>();
    for (const l of logs) {
      const arr = logsByDate.get(l.date) || [];
      arr.push(l);
      logsByDate.set(l.date, arr);
    }

    const series: LandingPoint[] = dates.map((date) => {
      const dayLogs = logsByDate.get(date) || [];
      const habitPcts = dayLogs.map((l) => {
        const checks = mergeLogChecks(l);
        const keys = Object.keys(checks);
        const n = completedCount(
          { date, wakeTime: l.wakeTime, bedtime: null, checks },
          keys
        );
        return keys.length ? Math.round((n / keys.length) * 100) : 0;
      });
      const t = todoByDate.get(date);
      return {
        date,
        label: date.slice(5),
        habitPct: habitPcts.length
          ? Math.round(habitPcts.reduce((a, b) => a + b, 0) / habitPcts.length)
          : 0,
        taskPct: t && t.total ? Math.round((t.done / t.total) * 100) : null,
      };
    });

    const data: LandingSnapshot = {
      people,
      mornings: logs.filter((l) => Boolean(l.wakeTime) || Boolean(l.wakeEarly)).length,
      tasksDone: todos.filter((t) => t.done).length,
      tasksTotal: todos.length,
      wakesToday: (logsByDate.get(today) || []).filter((l) => Boolean(l.wakeTime)).length,
      series,
    };
    landingCache = { at: Date.now(), data };
    return data;
  } catch {
    return empty;
  }
}
