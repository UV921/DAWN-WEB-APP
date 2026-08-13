"use client";

import { useMemo } from "react";
import {
  completedCount,
  formatLocalDate,
  isHabitDone,
  timeToMinutes,
  type HabitDef,
  type HabitLogLike,
} from "@/lib/habits";
import { type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { EvilComposedChart } from "@/components/evilcharts/charts/recharts-composed-chart";
import { EvilBarChart } from "@/components/evilcharts/charts/recharts-bar-chart";
import { EvilPieChart } from "@/components/evilcharts/charts/recharts-pie-chart";
import { EvilAreaChart } from "@/components/evilcharts/charts/recharts-area-chart";

export type TodoStat = { date: string; total: number; done: number };

type Props = {
  logs: HabitLogLike[];
  habits: HabitDef[];
  todoStats: TodoStat[];
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAWN = ["#f0b45a"];
const LEAF = ["#6fbf8a"];
const EMBER = ["#e07a3a"];
const MIST = ["#8ba3b8"];

function pretty(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

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

function sleepHours(bedtime: string, wakeTime: string) {
  const bed = timeToMinutes(bedtime);
  const wake = timeToMinutes(wakeTime);
  const mins = (wake - bed + 24 * 60) % (24 * 60);
  if (mins < 3 * 60 || mins > 14 * 60) return null;
  return Math.round((mins / 60) * 10) / 10;
}

function series(label: string, colors: string[]) {
  return { label, colors: { light: colors, dark: colors } };
}

export function ProgressDetail({ logs, habits, todoStats }: Props) {
  const habitKeys = useMemo(() => habits.map((h) => h.key), [habits]);
  const habitCount = Math.max(habitKeys.length, 1);
  const todoMap = useMemo(
    () => new Map(todoStats.map((t) => [t.date, t])),
    [todoStats]
  );
  const logMap = useMemo(
    () => new Map(logs.map((l) => [l.date, l])),
    [logs]
  );

  const days = useMemo(() => {
    return lastNDates(30).map((date) => {
      const l = logMap.get(date);
      const done = l ? completedCount(l, habitKeys) : 0;
      const habitPct = Math.round((done / habitCount) * 100);
      const t = todoMap.get(date);
      const taskPct =
        t && t.total ? Math.round((t.done / t.total) * 100) : null;
      const effort =
        taskPct == null ? habitPct : Math.round((habitPct + taskPct) / 2);
      return {
        date,
        label: date.slice(5),
        weekday: WEEKDAYS[new Date(date + "T12:00:00").getDay()],
        full: pretty(date),
        habitPct,
        taskPct,
        hasTasks: Boolean(t?.total),
        effort,
        habitsDone: done,
        habitsTotal: habitCount,
        tasksDone: t?.done || 0,
        tasksTotal: t?.total || 0,
        allTasks: Boolean(t?.total && t.done === t.total),
        allHabits: done >= habitCount && habitCount > 0 && Boolean(l),
        wake: l?.wakeTime || "",
        logged: Boolean(l),
      };
    });
  }, [logMap, todoMap, habitKeys, habitCount]);

  const last7 = days.slice(-7);
  const effortVals = days.filter((d) => d.logged || d.hasTasks).map((d) => d.effort);
  const meanEffort = avg(effortVals);
  const moreDays = days.filter(
    (d) => (d.logged || d.hasTasks) && d.effort > meanEffort
  );
  const lessDays = days.filter(
    (d) => (d.logged || d.hasTasks) && d.effort < meanEffort
  );
  const allTaskDays = days.filter((d) => d.allTasks).length;
  const allHabitDays = days.filter((d) => d.allHabits).length;
  const best = [...days].sort((a, b) => b.effort - a.effort)[0];
  const worst = [...days]
    .filter((d) => d.logged || d.hasTasks)
    .sort((a, b) => a.effort - b.effort)[0];

  const perHabit = habits.map((h) => {
    const window = days.filter((d) => d.logged);
    const hits = window.filter((d) => {
      const l = logMap.get(d.date);
      return l ? isHabitDone(l, h.key) : false;
    }).length;
    return {
      key: h.key,
      label: h.label,
      pct: window.length ? Math.round((hits / window.length) * 100) : 0,
      hits,
      days: window.length,
    };
  });

  const weekday = WEEKDAYS.map((name) => {
    const slice = days.filter((d) => d.weekday === name);
    const habit = avg(slice.map((d) => d.habitPct));
    const taskDays = slice.filter((d) => d.hasTasks);
    const task = avg(taskDays.map((d) => d.taskPct || 0));
    return { name, Habits: habit, Tasks: taskDays.length ? task : 0 };
  });

  const mix = [
    {
      name: "fullLoop",
      value: days.filter((d) => d.allHabits && d.allTasks).length,
    },
    {
      name: "allHabits",
      value: days.filter((d) => d.allHabits && !d.allTasks).length,
    },
    {
      name: "allTasks",
      value: days.filter((d) => d.allTasks && !d.allHabits).length,
    },
    {
      name: "lightDays",
      value: days.filter(
        (d) => (d.logged || d.hasTasks) && !d.allHabits && !d.allTasks
      ).length,
    },
  ].filter((d) => d.value > 0);

  const sleepData = useMemo(() => {
    const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    const rows: {
      date: string;
      label: string;
      full: string;
      hours: number;
    }[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (!prev.bedtime || !cur.wakeTime) continue;
      const hours = sleepHours(prev.bedtime, cur.wakeTime);
      if (hours == null) continue;
      rows.push({
        date: cur.date,
        label: cur.date.slice(5),
        full: pretty(cur.date),
        hours,
      });
    }
    return rows.slice(-30);
  }, [logs]);

  const completionConfig = {
    habitPct: series("Habits", DAWN),
    taskPct: series("Tasks", LEAF),
  } satisfies ChartConfig;

  const weekdayConfig = {
    Habits: series("Habits", DAWN),
    Tasks: series("Tasks", LEAF),
  } satisfies ChartConfig;

  const mixConfig = {
    fullLoop: series("Full loop", DAWN),
    allHabits: series("All habits", EMBER),
    allTasks: series("All tasks", LEAF),
    lightDays: series("Light days", MIST),
  } satisfies ChartConfig;

  const sleepConfig = {
    hours: series("Sleep", EMBER),
  } satisfies ChartConfig;

  const habitConfig = {
    pct: series("Hit rate", DAWN),
  } satisfies ChartConfig;

  return (
    <section className="space-y-12">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Habits 7d"
          value={`${avg(last7.map((d) => d.habitPct))}%`}
          hint={`${last7.filter((d) => d.allHabits).length} full mornings`}
        />
        <Stat
          label="Tasks 7d"
          value={`${avg(last7.filter((d) => d.hasTasks).map((d) => d.taskPct || 0)) || 0}%`}
          hint={`${last7.filter((d) => d.allTasks).length} days all done`}
        />
        <Stat
          label="All-task days"
          value={`${allTaskDays}`}
          hint="last 30 days"
        />
        <Stat
          label="Full-habit days"
          value={`${allHabitDays}`}
          hint="last 30 days"
        />
      </div>

      <div>
        <h2 className="font-display text-2xl text-white">
          Completion · habits vs tasks
        </h2>
        <p className="mt-1 text-sm text-[var(--color-mist)]">
          Gold bars = habits. Green line = tasks (only on days you set a list).
        </p>
        <div className="mt-5 h-[300px] w-full">
          <EvilComposedChart
            data={days}
            config={completionConfig}
            className="h-full w-full aspect-auto p-1"
            xDataKey="label"
          >
            <EvilComposedChart.Grid />
            <EvilComposedChart.XAxis dataKey="label" />
            <EvilComposedChart.YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <EvilComposedChart.Legend isClickable />
            <EvilComposedChart.Tooltip />
            <EvilComposedChart.Bar dataKey="habitPct" variant="gradient" />
            <EvilComposedChart.Line dataKey="taskPct" glow connectNulls={false}>
              <EvilComposedChart.Dot variant="border" />
              <EvilComposedChart.ActiveDot variant="colored-border" />
            </EvilComposedChart.Line>
          </EvilComposedChart>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl text-white">By weekday</h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            Which days you show up more vs less — 30-day average.
          </p>
          <div className="mt-5 h-[260px] w-full">
            <EvilBarChart
              data={weekday}
              config={weekdayConfig}
              className="h-full w-full aspect-auto p-1"
              xDataKey="name"
            >
              <EvilBarChart.Grid />
              <EvilBarChart.XAxis dataKey="name" />
              <EvilBarChart.YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <EvilBarChart.Legend isClickable />
              <EvilBarChart.Tooltip />
              <EvilBarChart.Bar dataKey="Habits" variant="gradient" />
              <EvilBarChart.Bar dataKey="Tasks" variant="gradient" />
            </EvilBarChart>
          </div>
        </div>

        <div>
          <h2 className="font-display text-2xl text-white">Day mix · 30d</h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            Full loop vs habits-only vs tasks-only vs light days.
          </p>
          {mix.length === 0 ? (
            <p className="mt-8 text-sm text-[var(--color-mist)]">No logged days yet.</p>
          ) : (
            <div className="mt-5 h-[260px] w-full">
              <EvilPieChart
                data={mix}
                config={mixConfig}
                dataKey="value"
                nameKey="name"
                className="h-full w-full aspect-auto p-1"
              >
                <EvilPieChart.Pie
                  variant="gradient"
                  innerRadius={58}
                  paddingAngle={3}
                  glowingSectors={["fullLoop"]}
                />
                <EvilPieChart.Legend isClickable />
                <EvilPieChart.Tooltip />
              </EvilPieChart>
            </div>
          )}
        </div>
      </div>

      {sleepData.length > 1 ? (
        <div>
          <h2 className="font-display text-2xl text-white">Sleep length</h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            Hours from last night’s bedtime to this morning’s wake.
          </p>
          <div className="mt-5 h-[260px] w-full">
            <EvilAreaChart
              data={sleepData}
              config={sleepConfig}
              className="h-full w-full aspect-auto p-1"
              xDataKey="label"
            >
              <EvilAreaChart.Grid />
              <EvilAreaChart.XAxis dataKey="label" />
              <EvilAreaChart.YAxis tickFormatter={(v: number) => `${v}h`} />
              <EvilAreaChart.Tooltip />
              <EvilAreaChart.Area dataKey="hours" variant="gradient">
                <EvilAreaChart.Dot variant="border" />
                <EvilAreaChart.ActiveDot variant="colored-border" />
              </EvilAreaChart.Area>
            </EvilAreaChart>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-dawn)]">
            More days
          </p>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            Above your 30-day average ({meanEffort}% effort)
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {moreDays.slice(-5).reverse().map((d) => (
              <li key={d.date} className="flex justify-between text-white">
                <span>{d.full}</span>
                <span className="text-[var(--color-leaf)]">{d.effort}%</span>
              </li>
            ))}
            {moreDays.length === 0 ? (
              <li className="text-[var(--color-mist)]">Not enough contrast yet.</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-ember)]">
            Less days
          </p>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            Below average — protect these nights
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {lessDays.slice(-5).reverse().map((d) => (
              <li key={d.date} className="flex justify-between text-white">
                <span>{d.full}</span>
                <span className="text-[var(--color-ember)]">{d.effort}%</span>
              </li>
            ))}
            {lessDays.length === 0 ? (
              <li className="text-[var(--color-mist)]">No weak days in view.</li>
            ) : null}
          </ul>
        </div>
      </div>

      {(best || worst) && (
        <p className="text-sm text-[var(--color-cloud)]">
          {best ? `Strongest: ${best.full} (${best.effort}%). ` : ""}
          {worst && worst.date !== best?.date
            ? `Lightest: ${worst.full} (${worst.effort}%).`
            : ""}
        </p>
      )}

      <div>
        <h2 className="font-display text-2xl text-white">Each habit · logged days</h2>
        <p className="mt-1 text-sm text-[var(--color-mist)]">
          Hit rate on days you actually checked in — last 30 days.
        </p>
        <div
          className="mt-5 w-full"
          style={{ height: Math.max(220, habits.length * 48) }}
        >
          <EvilBarChart
            data={perHabit}
            config={habitConfig}
            layout="horizontal"
            className="h-full w-full aspect-auto p-1"
            xDataKey="label"
          >
            <EvilBarChart.Grid />
            <EvilBarChart.XAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <EvilBarChart.YAxis dataKey="label" />
            <EvilBarChart.Tooltip />
            <EvilBarChart.Bar dataKey="pct" variant="gradient" />
          </EvilBarChart>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="ui-card ui-card-compact !text-left">
      <p className="ui-card-label">{label}</p>
      <p className="font-display mt-1 text-2xl text-white">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-mist)]">{hint}</p>
    </div>
  );
}
