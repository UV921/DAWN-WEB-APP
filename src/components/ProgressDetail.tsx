"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  completedCount,
  formatLocalDate,
  isHabitDone,
  timeToMinutes,
  type HabitDef,
  type HabitLogLike,
} from "@/lib/habits";
import { ShareCardButton } from "@/components/ShareCardButton";
import { shareProgressCard } from "@/lib/share-progress-card";
import { type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { EvilBarChart } from "@/components/evilcharts/charts/recharts-bar-chart";
import {
  buildProgressReport,
  type ReportRange,
} from "@/lib/progress-brief";
import { HabitCharts } from "@/components/HabitCharts";
import type { StudyStats } from "@/components/StudyStatusPanel";

export type TodoStat = { date: string; total: number; done: number };

export type ReportTodo = {
  text: string;
  done: boolean;
  priority?: string | null;
  parentId?: string | null;
};

type Props = {
  logs: HabitLogLike[];
  habits: HabitDef[];
  todoStats: TodoStat[];
  study?: StudyStats | null;
  todayTodos?: ReportTodo[];
  range: ReportRange;
  onRange: (range: ReportRange) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RANGES: { key: ReportRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const DAWN = ["#f0b45a"];
const LEAF = ["#6fbf8a"];

function prettyWeekdayLong(name: string) {
  const map: Record<string, string> = {
    Sun: "Sundays",
    Mon: "Mondays",
    Tue: "Tuesdays",
    Wed: "Wednesdays",
    Thu: "Thursdays",
    Fri: "Fridays",
    Sat: "Saturdays",
  };
  return map[name] || name;
}

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

function windowSize(range: ReportRange) {
  if (range === "today") return 1;
  if (range === "week") return 7;
  if (range === "month") return 30;
  return 365;
}

function summarize(slice: DayRow[]) {
  const logged = slice.filter((d) => d.logged || d.hasTasks);
  const habitPct = avg(slice.map((d) => d.habitPct));
  const taskDays = slice.filter((d) => d.hasTasks);
  const taskPct = avg(taskDays.map((d) => d.taskPct || 0));
  return {
    habitPct,
    taskPct,
    fullHabitDays: slice.filter((d) => d.allHabits).length,
    allTaskDays: slice.filter((d) => d.allTasks).length,
    loggedDays: logged.length,
    wakeOnTimeDays: slice.filter((d) => d.wakeOnTime).length,
    wakeLoggedDays: slice.filter((d) => d.wake).length,
    nightDays: slice.filter((d) => d.night).length,
  };
}

type DayRow = {
  date: string;
  label: string;
  weekday: string;
  full: string;
  habitPct: number;
  taskPct: number | null;
  hasTasks: boolean;
  effort: number;
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  allTasks: boolean;
  allHabits: boolean;
  wake: string;
  wakeOnTime: boolean;
  night: boolean;
  logged: boolean;
};

export function ProgressDetail({
  logs,
  habits,
  todoStats,
  study,
  todayTodos = [],
  range,
  onRange,
}: Props) {
  const { data: session } = useSession();
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
    return lastNDates(365).map((date) => {
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
        wakeOnTime: l ? isHabitDone(l, "wakeEarly") : false,
        night: Boolean(l?.bedtime),
        logged: Boolean(l),
      } satisfies DayRow;
    });
  }, [logMap, todoMap, habitKeys, habitCount]);

  const size = windowSize(range);
  const windowDays = days.slice(-size);
  const prevDays =
    range === "year" ? [] : days.slice(-size * 2, -size);
  const cur = summarize(windowDays);
  const prev = prevDays.length ? summarize(prevDays) : null;

  const perHabit = habits.map((h) => {
    const sample = windowDays.filter((d) => d.logged);
    const hits = sample.filter((d) => {
      const l = logMap.get(d.date);
      return l ? isHabitDone(l, h.key) : false;
    }).length;
    return {
      key: h.key,
      label: h.label,
      pct: sample.length ? Math.round((hits / sample.length) * 100) : 0,
    };
  });

  const weekday = WEEKDAYS.map((name) => {
    const slice = windowDays.filter((d) => d.weekday === name);
    const habit = avg(slice.map((d) => d.habitPct));
    const taskDays = slice.filter((d) => d.hasTasks);
    const task = avg(taskDays.map((d) => d.taskPct || 0));
    return { name, Habits: habit, Tasks: taskDays.length ? task : 0 };
  });

  const sleepRows = useMemo(() => {
    const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    const rows: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prevLog = sorted[i - 1];
      const curLog = sorted[i];
      if (!windowDays.some((d) => d.date === curLog.date)) continue;
      if (!prevLog.bedtime || !curLog.wakeTime) continue;
      const hours = sleepHours(prevLog.bedtime, curLog.wakeTime);
      if (hours != null) rows.push(hours);
    }
    return rows;
  }, [logs, windowDays]);

  const sleepAvg =
    sleepRows.length > 0
      ? Math.round(
          (sleepRows.reduce((a, n) => a + n, 0) / sleepRows.length) * 10
        ) / 10
      : null;

  const weekdayRank = [...weekday].sort((a, b) => a.Habits - b.Habits);
  const hasWeekdaySignal = weekday.some((w) => w.Habits > 0);
  const weakestWeekday = hasWeekdaySignal ? weekdayRank[0].name : null;
  const strongestWeekday = hasWeekdaySignal
    ? weekdayRank[weekdayRank.length - 1].name
    : null;
  const weakestHabit = [...perHabit].sort((a, b) => a.pct - b.pct)[0];

  const leftoverHigh = todayTodos
    .filter((t) => !t.done && t.priority === "high" && !t.parentId)
    .map((t) => t.text);

  const studyMinutes =
    range === "today"
      ? study?.today.minutes ?? null
      : range === "week"
        ? study?.weekMinutes ?? null
        : study?.monthMinutes ?? study?.weekMinutes ?? null;
  const studyLabel =
    range === "today"
      ? study?.today.label || null
      : range === "week"
        ? study?.weekLabel || null
        : study?.monthLabel || study?.weekLabel || null;

  const report = buildProgressReport({
    range,
    habitPct: cur.habitPct,
    taskPct: cur.taskPct,
    fullHabitDays: cur.fullHabitDays,
    allTaskDays: cur.allTaskDays,
    loggedDays: cur.loggedDays,
    windowDays: size,
    wakeOnTimeDays: cur.wakeOnTimeDays,
    wakeLoggedDays: cur.wakeLoggedDays,
    nightDays: cur.nightDays,
    sleepAvg,
    weakestWeekday,
    strongestWeekday,
    weakestHabit: weakestHabit && weakestHabit.pct < 80 ? weakestHabit.label : null,
    studyMinutes,
    studyLabel,
    prevHabitPct: prev ? prev.habitPct : null,
    prevTaskPct: prev ? prev.taskPct : null,
    leftoverHigh,
  });

  const briefTone =
    report.tone === "good"
      ? {
          border: "border-[var(--color-leaf)]/35",
          bg: "bg-[var(--color-leaf)]/[0.08]",
          kicker: "text-[var(--color-leaf)]",
        }
      : report.tone === "slip"
        ? {
            border: "border-[var(--color-ember)]/40",
            bg: "bg-[var(--color-ember)]/[0.08]",
            kicker: "text-[var(--color-ember)]",
          }
        : {
            border: "border-white/12",
            bg: "bg-white/[0.04]",
            kicker: "text-[var(--color-dawn)]",
          };

  const effortVals = windowDays
    .filter((d) => d.logged || d.hasTasks)
    .map((d) => d.effort);
  const meanEffort = avg(effortVals);
  const moreDays = windowDays.filter(
    (d) => (d.logged || d.hasTasks) && d.effort > meanEffort
  );
  const lessDays = windowDays.filter(
    (d) => (d.logged || d.hasTasks) && d.effort < meanEffort
  );

  const weekdayConfig = {
    Habits: series("Habits", DAWN),
    Tasks: series("Tasks", LEAF),
  } satisfies ChartConfig;

  const weekdayInsight =
    strongestWeekday &&
    weakestWeekday &&
    strongestWeekday !== weakestWeekday
      ? `${prettyWeekdayLong(strongestWeekday)} are your strongest mornings. ${prettyWeekdayLong(weakestWeekday)} leak the most — that’s the day to protect.`
      : "Need a few more logged days before weekday patterns are honest.";

  const todayRow = windowDays[windowDays.length - 1];
  const wakePct =
    cur.wakeLoggedDays > 0
      ? Math.round((cur.wakeOnTimeDays / cur.wakeLoggedDays) * 100)
      : 0;
  const nightPct =
    size > 0 ? Math.round((cur.nightDays / size) * 100) : 0;

  const fourth =
    range === "today" || range === "week"
      ? {
          label: range === "today" ? "Study today" : "Study this week",
          value: studyLabel || "0m",
          hint:
            range === "today"
              ? study?.today.live
                ? "In a study room right now."
                : "Sit in a marked study VC. Dawn counts it here."
              : study?.weekMinutes
                ? `${study.weekDaysWithStudy || 0} day${(study.weekDaysWithStudy || 0) === 1 ? "" : "s"} with time on the clock.`
                : "Study shown for the last 30 days.",
        }
      : {
          label: "Nights closed",
          value: `${cur.nightDays}`,
          hint:
            range === "month" || range === "year"
              ? `Study numbers cover the last 30 days${study?.monthLabel ? ` · ${study.monthLabel}` : ""}.`
              : `${nightPct}% of days in view.`,
        };

  return (
    <section className="space-y-10">
      <div className="flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => onRange(r.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              range === r.key
                ? "bg-[var(--color-dawn)] font-semibold text-[var(--color-night)]"
                : "border border-white/12 text-[var(--color-mist)] hover:text-white"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className={`rounded-2xl border px-5 py-5 ${briefTone.border} ${briefTone.bg}`}>
        <div className="flex items-start justify-between gap-3">
          <p
            className={`text-[0.65rem] font-medium uppercase tracking-[0.18em] ${briefTone.kicker}`}
          >
            {report.kicker}
          </p>
          {range === "week" ? (
            <ShareCardButton
              label="Share week"
              make={() =>
                shareProgressCard({
                  name: session?.user?.name || undefined,
                  date:
                    windowDays[windowDays.length - 1]?.date ||
                    formatLocalDate(new Date()),
                  headline: report.headline,
                  habitPct7: cur.habitPct,
                  taskPct7: cur.taskPct,
                  fullHabitDays7: cur.fullHabitDays,
                  studyWeekLabel: study?.weekLabel,
                  habits: perHabit.map((h) => ({ label: h.label, pct: h.pct })),
                  last7: windowDays.slice(-7).map((d) => ({
                    label: d.weekday.slice(0, 1),
                    habitPct: d.habitPct,
                    logged: d.logged,
                  })),
                })
              }
            />
          ) : null}
        </div>
        <h2 className="font-display mt-2 text-[1.7rem] leading-[1.2] text-white">
          {report.headline}
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm text-[var(--color-cloud)]">
          {report.happened.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {report.leaked.length ? (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-ember)]">
              Where it leaked
            </p>
            {report.leaked.map((leak) => (
              <p key={leak.where} className="text-sm text-[var(--color-cloud)]">
                <span className="font-medium text-white">{leak.where}.</span>{" "}
                {leak.why} {leak.fix}
              </p>
            ))}
          </div>
        ) : null}
        {report.improved ? (
          <p className="mt-3 text-sm text-[var(--color-mist)]">{report.improved}</p>
        ) : null}
        <div className="mt-4 border-l-2 border-[var(--color-dawn)] bg-black/20 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-dawn)]">
            Do this
          </p>
          <p className="mt-1 text-sm font-medium text-white">{report.next}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label={range === "today" ? "Wake" : "Wake on time"}
          value={
            range === "today"
              ? todayRow?.wake || "—"
              : `${wakePct}%`
          }
          hint={
            range === "today"
              ? todayRow?.wakeOnTime
                ? "Inside the window."
                : todayRow?.wake
                  ? "Logged, after the goal."
                  : "No wake yet."
              : `${cur.wakeOnTimeDays} of ${cur.wakeLoggedDays || 0} logged mornings.`
          }
        />
        <Stat
          label="Habits"
          value={
            range === "today"
              ? `${todayRow?.habitsDone || 0}/${todayRow?.habitsTotal || habitCount}`
              : `${cur.habitPct}%`
          }
          hint={
            cur.fullHabitDays
              ? `${cur.fullHabitDays} full morning${cur.fullHabitDays === 1 ? "" : "s"}.`
              : "Finish the open habit after wake."
          }
        />
        <Stat
          label="Tasks"
          value={
            range === "today"
              ? `${todayRow?.tasksDone || 0}/${todayRow?.tasksTotal || 0}`
              : `${cur.taskPct}%`
          }
          hint={
            cur.allTaskDays
              ? `${cur.allTaskDays} day${cur.allTaskDays === 1 ? "" : "s"} you cleared the list.`
              : leftoverHigh[0]
                ? `High still open: ${leftoverHigh[0]}`
                : "Set a short list so the day has a finish line."
          }
        />
        <Stat label={fourth.label} value={fourth.value} hint={fourth.hint} />
      </div>

      {range === "today" && todayRow ? (
        <div>
          <h2 className="font-display text-2xl text-white">Today’s loop</h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            One pass. No extra graphs.
          </p>
          <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <LoopRow
              label="Wake"
              value={todayRow.wake || "—"}
              done={Boolean(todayRow.wake)}
            />
            <LoopRow
              label="Habits"
              value={`${todayRow.habitsDone}/${todayRow.habitsTotal}`}
              done={todayRow.allHabits}
            />
            <LoopRow
              label="Tasks"
              value={
                todayRow.tasksTotal
                  ? `${todayRow.tasksDone}/${todayRow.tasksTotal}`
                  : "no list"
              }
              done={todayRow.allTasks}
            />
            <LoopRow
              label="Night"
              value={todayRow.night ? "closed" : "open"}
              done={todayRow.night}
            />
            <LoopRow
              label="Study"
              value={study?.today.label || "0m"}
              done={Boolean(study?.today.minutes)}
            />
          </ul>
        </div>
      ) : null}

      {range === "week" ? (
        <div>
          <h2 className="font-display text-2xl text-white">Which weekday breaks?</h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">{weekdayInsight}</p>
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
      ) : null}

      {range === "month" || range === "year" ? (
        <HabitCharts
          logs={logs}
          habits={habits}
          showWakeTrend={false}
          forcedRange={range}
        />
      ) : null}

      {range !== "today" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-dawn)]">
              Days that worked
            </p>
            <p className="mt-1 text-sm text-[var(--color-mist)]">
              Above your usual ({meanEffort}% combined). Repeat those nights.
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
              Days that leaked
            </p>
            <p className="mt-1 text-sm text-[var(--color-mist)]">
              Below your usual. Lock bedtime — don’t add goals.
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
      ) : null}
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

function LoopRow({
  label,
  value,
  done,
}: {
  label: string;
  value: string;
  done: boolean;
}) {
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-[var(--color-mist)]">{label}</span>
      <span
        className={`text-sm font-medium tabular-nums ${
          done ? "text-[var(--color-leaf)]" : "text-white"
        }`}
      >
        {value}
      </span>
    </li>
  );
}
