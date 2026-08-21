"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  completedCount,
  formatLocalDate,
  isHabitComplete,
  isHabitDone,
  timeToMinutes,
  type HabitDef,
  type HabitLogLike,
} from "@/lib/habits";
import { ShareCardButton } from "@/components/ShareCardButton";
import { TodayFinishedReport } from "@/components/TodayFinishedReport";
import { shareProgressCard } from "@/lib/share-progress-card";
import { shareDayReportCard } from "@/lib/share-day-report-card";
import { type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { EvilBarChart } from "@/components/evilcharts/charts/recharts-bar-chart";
import {
  buildProgressReport,
  type ReportRange,
} from "@/lib/progress-brief";
import { HabitCharts } from "@/components/HabitCharts";
import type { StudyStats } from "@/components/StudyStatusPanel";
import { MissionStats } from "@/components/MissionStats";
import { StudyCycleChart } from "@/components/StudyCycleChart";
import { missionDoing, type MissionPublic } from "@/lib/missions";
import { emptyHours, sumHourlyRows } from "@/lib/study-cycle";
import {
  closedTaskNames,
  splitTodayTasks,
  type ReportTodo,
} from "@/lib/today-task-report";

export type TodoStat = { date: string; total: number; done: number };

export type { ReportTodo };

type Props = {
  logs: HabitLogLike[];
  habits: HabitDef[];
  todoStats: TodoStat[];
  study?: StudyStats | null;
  todayTodos?: ReportTodo[];
  range: ReportRange;
  onRange: (range: ReportRange) => void;
  missions?: MissionPublic[];
  missionHistory?: MissionPublic[];
  missionToday?: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RANGES: { key: ReportRange; label: string; hint: string }[] = [
  { key: "today", label: "Today", hint: "Just today" },
  { key: "week", label: "7 days", hint: "Last 7 days" },
  { key: "month", label: "30 days", hint: "Last 30 days" },
  { key: "year", label: "Year", hint: "Last 365 days" },
];

const DAWN = ["#f0b45a"];
const LEAF = ["#6fbf8a"];
const STUDY = ["#6ea8d8"];
const STUDY_GOAL_MIN = 120;

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
  studyMins: number;
};

export function ProgressDetail({
  logs,
  habits,
  todoStats,
  study,
  todayTodos = [],
  range,
  onRange,
  missions = [],
  missionHistory = [],
  missionToday,
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
  const studyMap = useMemo(() => {
    const m = new Map<string, number>();
    const rows = study?.days || study?.month || study?.week || [];
    for (const row of rows) m.set(row.date, row.minutes);
    return m;
  }, [study]);

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
        studyMins: studyMap.get(date) || 0,
      } satisfies DayRow;
    });
  }, [logMap, todoMap, studyMap, habitKeys, habitCount]);

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
      hits,
      sample: sample.length,
      pct: sample.length ? Math.round((hits / sample.length) * 100) : 0,
    };
  });

  const weekday = WEEKDAYS.map((name) => {
    const slice = windowDays.filter((d) => d.weekday === name);
    const habit = avg(slice.map((d) => d.habitPct));
    const taskDays = slice.filter((d) => d.hasTasks);
    const task = avg(taskDays.map((d) => d.taskPct || 0));
    const studyMins = avg(slice.map((d) => d.studyMins));
    return {
      name,
      Habits: habit,
      Tasks: taskDays.length ? task : 0,
      Study: Math.min(100, Math.round((studyMins / STUDY_GOAL_MIN) * 100)),
    };
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
  const todaySplit = splitTodayTasks(todayTodos);
  const closedNames = closedTaskNames(todaySplit.done);

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
    closedTasks: range === "today" ? closedNames : [],
    todayTaskTotal: range === "today" ? todaySplit.total : 0,
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
    Study: series("Study", STUDY),
  } satisfies ChartConfig;

  const weekdayInsight =
    strongestWeekday &&
    weakestWeekday &&
    strongestWeekday !== weakestWeekday
      ? `${prettyWeekdayLong(strongestWeekday)} are your strongest. ${prettyWeekdayLong(weakestWeekday)} are the weakest — that’s the day to lock in.`
      : "Log a few more mornings and this chart will show which weekday usually breaks.";

  const cycleHours = useMemo(() => {
    const dates = new Set(windowDays.map((d) => d.date));
    if (!study?.hourly?.length) return emptyHours();
    return sumHourlyRows(study.hourly, dates);
  }, [study?.hourly, windowDays]);
  const nowHour = range === "today" ? new Date().getHours() : null;

  const todayRow = windowDays[windowDays.length - 1];
  const wakePct =
    cur.wakeLoggedDays > 0
      ? Math.round((cur.wakeOnTimeDays / cur.wakeLoggedDays) * 100)
      : 0;
  const nightPct =
    size > 0 ? Math.round((cur.nightDays / size) * 100) : 0;

  const rangeHint = RANGES.find((r) => r.key === range)?.hint || "";
  const compareHint =
    range === "today"
      ? "Compared with yesterday when there’s enough to compare."
      : range === "year"
        ? "Year view uses the last 365 days."
        : `Compared with ${range === "week" ? "the 7 days before" : "the 30 days before"}.`;

  const fourth =
    range === "today" || range === "week"
      ? {
          label: range === "today" ? "Study today" : "Study (7 days)",
          value: studyLabel || "0m",
          hint:
            range === "today"
              ? study?.today.live
                ? study?.today.activity
                  ? `You’re ${study.today.activity} in a study session right now.`
                  : "You’re in a study session right now."
                : "Time in a marked Discord study room today — or a session you started in Dawn."
              : study?.weekMinutes
                ? `Studied on ${study.weekDaysWithStudy || 0} day${(study.weekDaysWithStudy || 0) === 1 ? "" : "s"} this week.`
                : "Join a marked Discord study room — Dawn counts the minutes.",
        }
      : {
          label: "Nights closed",
          value: `${cur.nightDays} / ${size}`,
          hint:
            range === "month" || range === "year"
              ? `You logged bedtime on ${cur.nightDays} of ${size} days.${study?.monthLabel ? ` Study (30 days): ${study.monthLabel}.` : ""}`
              : `Bedtime logged on ${nightPct}% of days in this window.`,
        };

  const todayIso =
    missionToday || todayRow?.date || formatLocalDate(new Date());
  const liveMissions = missions.filter((m) => m.active);
  const missionScores = liveMissions.map((m) => missionDoing(m, todayIso));
  const missionPct = missionScores.length
    ? Math.round(
        missionScores.reduce((a, s) => a + s.pct, 0) / missionScores.length
      )
    : null;

  const shareDate = todayIso;
  const makeDayShare = () =>
    shareDayReportCard({
      name: session?.user?.name || undefined,
      date: shareDate,
      kicker: range === "today" ? report.kicker : "Today",
      headline:
        range === "today"
          ? report.headline
          : todaySplit.total
            ? `Closed ${todaySplit.doneCount} of ${todaySplit.total} tasks.`
            : "Today’s report",
      next:
        range === "today"
          ? report.next
          : leftoverHigh[0]
            ? `Finish “${leftoverHigh[0]}” before you add another task.`
            : undefined,
      wakeValue: todayRow?.wake || "—",
      habitValue: `${todayRow?.habitsDone || 0}/${todayRow?.habitsTotal || habitCount}`,
      taskValue: todayRow?.tasksTotal
        ? `${todayRow?.tasksDone || 0}/${todayRow.tasksTotal}`
        : "none",
      studyValue: study?.today.label || "0m",
      habits: habits.map((h) => {
        const l = todayRow ? logMap.get(todayRow.date) : undefined;
        return {
          label: h.label,
          done: l ? isHabitComplete(l, h.key) : false,
        };
      }),
      tasks: todayTodos,
    });

  return (
    <section className="space-y-10">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => onRange(r.key)}
                className={`ui-chip ${range === r.key ? "is-on" : ""}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <ShareCardButton
            label="Share report"
            make={() =>
              range === "today"
                ? makeDayShare()
                : shareProgressCard({
                    name: session?.user?.name || undefined,
                    date:
                      windowDays[windowDays.length - 1]?.date ||
                      formatLocalDate(new Date()),
                    range,
                    kicker: report.kicker,
                    headline: report.headline,
                    next: report.next,
                    wakeValue: `${cur.wakeOnTimeDays}/${cur.wakeLoggedDays || 0}`,
                    habitValue: `${cur.habitPct}%`,
                    taskValue: `${cur.taskPct}%`,
                    studyValue:
                      studyLabel ||
                      study?.monthLabel ||
                      study?.weekLabel ||
                      "0m",
                    habits: perHabit.map((h) => ({
                      label: h.label,
                      pct: h.pct,
                      hits: h.hits,
                      sample: h.sample,
                    })),
                    days: windowDays.slice(-14).map((d) => ({
                      label: d.weekday.slice(0, 1),
                      habitPct: d.habitPct,
                      logged: d.logged || d.studyMins > 0 || d.hasTasks,
                    })),
                  })
            }
          />
        </div>
        <p className="mt-2 text-sm text-[var(--color-mist)]">
          Showing {rangeHint.toLowerCase()}. {compareHint}{" "}
          {range === "today"
            ? "Share today’s full report as a PNG — tasks you closed, plus wake, habits, and study."
            : "Share the full report as a PNG."}
        </p>
      </div>

      <div className={`rounded-2xl border px-5 py-5 ${briefTone.border} ${briefTone.bg}`}>
        <div className="flex items-start justify-between gap-3">
          <p
            className={`text-[0.65rem] font-medium uppercase tracking-[0.18em] ${briefTone.kicker}`}
          >
            {report.kicker}
          </p>
        </div>
        <h2 className="font-display mt-2 text-[1.7rem] leading-[1.2] text-white">
          {report.headline}
        </h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-mist)]">
              What you did
            </p>
            <ul className="mt-2 space-y-2 text-sm text-[var(--color-cloud)]">
              {report.happened.map((line) => (
                <li key={line} className="leading-snug">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-ember)]">
              What slipped
            </p>
            {report.leaked.length ? (
              <ul className="mt-2 space-y-3">
                {report.leaked.map((leak) => (
                  <li key={leak.where} className="text-sm leading-snug text-[var(--color-cloud)]">
                    <span className="font-medium text-white">{leak.where}.</span>{" "}
                    {leak.why}{" "}
                    <span className="text-[var(--color-mist)]">{leak.fix}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--color-mist)]">
                Nothing obvious in this window. Keep the same routine.
              </p>
            )}
          </div>
        </div>

        {report.improved ? (
          <p className="mt-4 text-sm text-[var(--color-mist)]">{report.improved}</p>
        ) : null}
        <div className="mt-4 border-l-2 border-[var(--color-dawn)] bg-black/20 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-dawn)]">
            Do this next
          </p>
          <p className="mt-1 text-sm font-medium text-white">{report.next}</p>
        </div>
      </div>

      <TodayFinishedReport
        todos={todayTodos}
        onShare={makeDayShare}
        loops={[
          {
            label: "Wake",
            value: todayRow?.wake || "—",
            done: Boolean(todayRow?.wake),
          },
          {
            label: "Habits",
            value: `${todayRow?.habitsDone || 0}/${todayRow?.habitsTotal || habitCount}`,
            done: Boolean(todayRow?.allHabits),
          },
          {
            label: "Tasks",
            value: todayRow?.tasksTotal
              ? `${todayRow.tasksDone}/${todayRow.tasksTotal}`
              : "none",
            done: Boolean(todayRow?.allTasks),
          },
          {
            label: "Study",
            value: study?.today.label || "0m",
            done: Boolean(study?.today.minutes),
          },
          {
            label: "Night",
            value: todayRow?.night ? "closed" : "open",
            done: Boolean(todayRow?.night),
          },
        ]}
      />

      <div>
        <h2 className="font-display text-2xl text-white">The numbers</h2>
        <p className="mt-1 text-sm text-[var(--color-mist)]">
          Four scores for {rangeHint.toLowerCase()}
          {missionPct != null ? " — plus your missions" : ""}. Percentages are
          how much you finished, not a grade.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label={range === "today" ? "Wake today" : "Wake on time"}
            value={
              range === "today"
                ? todayRow?.wake || "—"
                : `${cur.wakeOnTimeDays}/${cur.wakeLoggedDays || 0}`
            }
            hint={
              range === "today"
                ? todayRow?.wakeOnTime
                  ? "Inside your wake window."
                  : todayRow?.wake
                    ? "Logged, but after the goal."
                    : "No wake logged yet."
                : wakePct
                  ? `${wakePct}% of logged mornings were on time.`
                  : "No wake times logged in this window."
            }
          />
          <Stat
            label="Habits done"
            value={
              range === "today"
                ? `${todayRow?.habitsDone || 0}/${todayRow?.habitsTotal || habitCount}`
                : `${cur.habitPct}%`
            }
            hint={
              range === "today"
                ? todayRow?.allHabits
                  ? "Every habit is closed."
                  : "Finish the open ones after you wake."
                : cur.fullHabitDays
                  ? `${cur.fullHabitDays} of ${size} days you closed every habit.`
                  : "No full morning yet — close every habit on one day."
            }
          />
          <Stat
            label="Tasks done"
            value={
              range === "today"
                ? `${todayRow?.tasksDone || 0}/${todayRow?.tasksTotal || 0}`
                : `${cur.taskPct}%`
            }
            hint={
              range === "today"
                ? leftoverHigh[0]
                  ? `Still open: ${leftoverHigh[0]}`
                  : todayRow?.allTasks
                    ? "Today’s list is clear."
                    : todayRow?.tasksTotal
                      ? "Finish the list or cut it down."
                      : "No tasks on today’s list."
                : cur.allTaskDays
                  ? `Cleared the whole list on ${cur.allTaskDays} day${cur.allTaskDays === 1 ? "" : "s"}.`
                  : leftoverHigh[0]
                    ? `High still open: ${leftoverHigh[0]}`
                    : "Keep the list short enough to finish."
            }
          />
          <Stat label={fourth.label} value={fourth.value} hint={fourth.hint} />
          {missionPct != null ? (
            <Stat
              label={
                liveMissions.length === 1
                  ? liveMissions[0].title
                  : "Missions"
              }
              value={`${missionPct}%`}
              hint={
                liveMissions.length === 1
                  ? missionScores[0].detail
                  : `${liveMissions.length} live · steps and days you showed up.`
              }
            />
          ) : null}
        </div>
      </div>

      <MissionStats
        missions={missions}
        history={missionHistory}
        range={range}
        today={todayIso}
      />

      {perHabit.length ? (
        <div>
          <h2 className="font-display text-2xl text-white">Each habit</h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            {range === "today"
              ? "Done or not done today."
              : `How often you closed each habit on days you checked in (${rangeHint.toLowerCase()}).`}
          </p>
          <ul className="mt-4 space-y-3">
            {perHabit.map((h) => (
              <li key={h.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-white">{h.label}</span>
                  <span className="shrink-0 tabular-nums text-[var(--color-mist)]">
                    {range === "today"
                      ? h.hits
                        ? "Done"
                        : "Not yet"
                      : `${h.hits} of ${h.sample} days · ${h.pct}%`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[var(--color-dawn)]"
                    style={{
                      width: `${range === "today" ? (h.hits ? 100 : 0) : h.pct}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {range === "week" ? (
        <div>
          <h2 className="font-display text-2xl text-white">Which weekday is weakest?</h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            Gold is habits. Green is tasks. Blue is study (100% = 2 hours that
            weekday). Short bars are the day that usually slips. {weekdayInsight}
          </p>
          <div className="mt-5 h-[280px] w-full">
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
              <EvilBarChart.Bar dataKey="Study" variant="gradient" />
            </EvilBarChart>
          </div>
        </div>
      ) : null}

      <StudyCycleChart hours={cycleHours} range={range} nowHour={nowHour} />

      {range !== "today" ? (
        <HabitCharts
          logs={logs}
          habits={habits}
          todos={todoStats}
          studyDays={study?.days || study?.month || study?.week || []}
          showWakeTrend={false}
          defaultRange={range === "year" ? "year" : range === "month" ? "month" : "week"}
        />
      ) : null}

      {range !== "today" ? (
        <div>
          <h2 className="font-display text-2xl text-white">Strong vs weak days</h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            Combined habit + task score vs your average of {meanEffort}% in this
            window. Repeat the strong nights. Don’t add goals on the weak ones —
            just go to bed on time.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-dawn)]">
                Stronger than average
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {moreDays.slice(-5).reverse().map((d) => (
                  <li key={d.date} className="flex justify-between text-white">
                    <span>{d.full}</span>
                    <span className="text-[var(--color-leaf)]">{d.effort}%</span>
                  </li>
                ))}
                {moreDays.length === 0 ? (
                  <li className="text-[var(--color-mist)]">
                    No day clearly above your average yet.
                  </li>
                ) : null}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-ember)]">
                Weaker than average
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {lessDays.slice(-5).reverse().map((d) => (
                  <li key={d.date} className="flex justify-between text-white">
                    <span>{d.full}</span>
                    <span className="text-[var(--color-ember)]">{d.effort}%</span>
                  </li>
                ))}
                {lessDays.length === 0 ? (
                  <li className="text-[var(--color-mist)]">
                    No day clearly below your average.
                  </li>
                ) : null}
              </ul>
            </div>
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
