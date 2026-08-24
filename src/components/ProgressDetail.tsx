"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  completedCount,
  formatLocalDate,
  isHabitComplete,
  isHabitDone,
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
import { DayProgressPanel } from "@/components/DayProgressPanel";
import {
  ProgressTrendChart,
  type CompareRow,
  type TrendPoint,
} from "@/components/ProgressTrendChart";
import { missionDoing, type MissionPublic } from "@/lib/missions";
import { emptyHours, sumHourlyRows } from "@/lib/study-cycle";
import { formatStudyDuration } from "@/lib/study-time";
import {
  addCalendarDays,
  averageRatioPcts,
  buildDayRatios,
  clampDayIso,
  dayScore,
  lastNDatesEnding,
  prettyDay,
  sleepHoursFromTimes,
  STUDY_GOAL_MIN,
  weekdayShort,
  type DayHabitHit,
  type DayRatio,
  type DayStripCell,
} from "@/lib/day-progress";
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
  dayTodos?: ReportTodo[];
  dayNotes?: string | null;
  dayGoal?: string | null;
  range: ReportRange;
  onRange: (range: ReportRange) => void;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  todayIso?: string;
  wakeGoal?: string;
  sleepGoal?: string;
  missions?: MissionPublic[];
  missionHistory?: MissionPublic[];
  missionToday?: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RANGES: { key: ReportRange; label: string; hint: string }[] = [
  { key: "today", label: "Day", hint: "The day you pick" },
  { key: "week", label: "7 days", hint: "Last 7 days" },
  { key: "month", label: "30 days", hint: "Last 30 days" },
  { key: "year", label: "Year", hint: "Last 365 days" },
];

const DAWN = ["#f0b45a"];
const LEAF = ["#6fbf8a"];
const STUDY = ["#6ea8d8"];

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
  dayTodos,
  dayNotes,
  dayGoal,
  range,
  onRange,
  selectedDate,
  onSelectDate,
  todayIso,
  wakeGoal = "06:00",
  sleepGoal = "23:00",
  missions = [],
  missionHistory = [],
  missionToday,
}: Props) {
  const { data: session } = useSession();
  const today = todayIso || missionToday || formatLocalDate(new Date());
  const selected = clampDayIso(selectedDate || today, today);
  const isToday = selected === today;
  const reportTodos =
    range === "today" && !isToday ? dayTodos || [] : todayTodos;
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
    return lastNDatesEnding(today, 365).map((date) => {
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
  }, [logMap, todoMap, studyMap, habitKeys, habitCount, today]);

  const size = windowSize(range);
  const windowDays =
    range === "today"
      ? days.filter((d) => d.date === selected)
      : days.slice(-size);
  const prevDays =
    range === "today"
      ? days.filter((d) => d.date === addCalendarDays(selected, -1))
      : range === "year"
        ? []
        : days.slice(-size * 2, -size);
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
      const hours = sleepHoursFromTimes(prevLog.bedtime, curLog.wakeTime);
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

  const leftoverHigh = reportTodos
    .filter((t) => !t.done && t.priority === "high" && !t.parentId)
    .map((t) => t.text);
  const todaySplit = splitTodayTasks(reportTodos);
  const closedNames = closedTaskNames(todaySplit.done);

  const pickedRow =
    days.find((d) => d.date === selected) || windowDays[windowDays.length - 1];
  const selectedStudyMins = pickedRow?.studyMins || 0;
  const studyMinutes =
    range === "today"
      ? selectedStudyMins
      : range === "week"
        ? study?.weekMinutes ?? null
        : study?.monthMinutes ?? study?.weekMinutes ?? null;
  const studyLabel =
    range === "today"
      ? selectedStudyMins
        ? formatStudyDuration(selectedStudyMins)
        : "0m"
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
    weakestWeekday: range === "today" ? null : weakestWeekday,
    strongestWeekday: range === "today" ? null : strongestWeekday,
    weakestHabit: weakestHabit && weakestHabit.pct < 80 ? weakestHabit.label : null,
    studyMinutes,
    studyLabel,
    prevHabitPct: prev ? prev.habitPct : null,
    prevTaskPct: prev ? prev.taskPct : null,
    leftoverHigh,
    closedTasks: range === "today" ? closedNames : [],
    todayTaskTotal: range === "today" ? todaySplit.total : 0,
    isToday,
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
  const nowHour = range === "today" && isToday ? new Date().getHours() : null;

  const todayRow = pickedRow;
  const wakePct =
    cur.wakeLoggedDays > 0
      ? Math.round((cur.wakeOnTimeDays / cur.wakeLoggedDays) * 100)
      : 0;
  const nightPct =
    size > 0 ? Math.round((cur.nightDays / size) * 100) : 0;

  const rangeHint = RANGES.find((r) => r.key === range)?.hint || "";
  const compareHint =
    range === "today"
      ? isToday
        ? "Compared with yesterday when there’s enough to compare."
        : `Compared with the day before ${prettyDay(selected, today)}.`
      : range === "year"
        ? "Year view uses the last 365 days."
        : `Compared with ${range === "week" ? "the 7 days before" : "the 30 days before"}.`;

  const fourth =
    range === "today" || range === "week"
      ? {
          label: range === "today" ? (isToday ? "Study today" : "Study this day") : "Study (7 days)",
          value: studyLabel || "0m",
          hint:
            range === "today"
              ? isToday && study?.today.live
                ? study?.today.activity
                  ? `You’re ${study.today.activity} in a study session right now.`
                  : "You’re in a study session right now."
                : "Time in a marked Discord study room — or a session you started in Dawn."
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

  const missionDay = range === "today" ? selected : today;
  const liveMissions = missions.filter((m) => m.active);
  const missionScores = liveMissions.map((m) => missionDoing(m, missionDay));
  const missionPct = missionScores.length
    ? Math.round(
        missionScores.reduce((a, s) => a + s.pct, 0) / missionScores.length
      )
    : null;

  const dayLog = logMap.get(selected);
  const prevNight = logMap.get(addCalendarDays(selected, -1));
  const pickedSleepHours = sleepHoursFromTimes(
    prevNight?.bedtime,
    dayLog?.wakeTime
  );
  const pickedTaskSplit = splitTodayTasks(reportTodos);
  const dayRatios = buildDayRatios({
    wakeTime: dayLog?.wakeTime || null,
    wakeGoal,
    bedtime: dayLog?.bedtime || null,
    sleepGoal,
    sleepHours: pickedSleepHours,
    habitsDone: pickedRow?.habitsDone || 0,
    habitsTotal: pickedRow?.habitsTotal || habitCount,
    tasksDone:
      range === "today" ? pickedTaskSplit.doneCount : pickedRow?.tasksDone || 0,
    tasksTotal:
      range === "today" ? pickedTaskSplit.total : pickedRow?.tasksTotal || 0,
    studyMins: selectedStudyMins,
    logged: Boolean(pickedRow?.logged),
  });
  const pickedScore = dayScore(dayRatios);
  const priorDates = lastNDatesEnding(addCalendarDays(selected, -1), 7);
  const priorRatios = priorDates.map((date) => {
    const row = days.find((d) => d.date === date);
    const log = logMap.get(date);
    const prev = logMap.get(addCalendarDays(date, -1));
    return buildDayRatios({
      wakeTime: log?.wakeTime || null,
      wakeGoal,
      bedtime: log?.bedtime || null,
      sleepGoal,
      sleepHours: sleepHoursFromTimes(prev?.bedtime, log?.wakeTime),
      habitsDone: row?.habitsDone || 0,
      habitsTotal: row?.habitsTotal || habitCount,
      tasksDone: row?.tasksDone || 0,
      tasksTotal: row?.tasksTotal || 0,
      studyMins: row?.studyMins || 0,
      logged: Boolean(row?.logged),
    });
  });
  const priorAvg = averageRatioPcts(priorRatios);
  const compareRows: CompareRow[] = dayRatios.map((r) => ({
    name: r.label,
    Day: r.scored ? r.pct : 0,
    Average: priorAvg[r.key] || 0,
  }));
  const dayHabits: DayHabitHit[] = habits.map((h) => ({
    key: h.key,
    label: h.label,
    done: dayLog ? isHabitComplete(dayLog, h.key) : false,
  }));
  const strip: DayStripCell[] = lastNDatesEnding(selected, 7).map((date) => {
    const row = days.find((d) => d.date === date);
    const log = logMap.get(date);
    const prev = logMap.get(addCalendarDays(date, -1));
    const ratios: DayRatio[] = buildDayRatios({
      wakeTime: log?.wakeTime || null,
      wakeGoal,
      bedtime: log?.bedtime || null,
      sleepGoal,
      sleepHours: sleepHoursFromTimes(prev?.bedtime, log?.wakeTime),
      habitsDone: row?.habitsDone || 0,
      habitsTotal: row?.habitsTotal || habitCount,
      tasksDone: row?.tasksDone || 0,
      tasksTotal: row?.tasksTotal || 0,
      studyMins: row?.studyMins || 0,
      logged: Boolean(row?.logged),
    });
    return {
      date,
      weekday: weekdayShort(date),
      score: dayScore(ratios),
      logged: Boolean(row?.logged),
    };
  });
  const trendData: TrendPoint[] = (
    range === "today"
      ? lastNDatesEnding(selected, 7)
      : range === "year"
        ? windowDays.slice(-42).map((d) => d.date)
        : windowDays.map((d) => d.date)
  )
    .map((date) => days.find((d) => d.date === date))
    .filter((d): d is DayRow => Boolean(d))
    .map((d) => ({
      date: d.date,
      label: range === "year" ? d.date.slice(5) : d.weekday.slice(0, 2) + " " + d.date.slice(8),
      Habits: d.habitPct,
      Tasks: d.taskPct || 0,
      Study: Math.min(100, Math.round((d.studyMins / STUDY_GOAL_MIN) * 100)),
    }));

  const shareDate = range === "today" ? selected : today;
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
      studyValue:
        range === "today"
          ? studyLabel || "0m"
          : study?.today.label || "0m",
      habits: habits.map((h) => {
        const l = todayRow ? logMap.get(todayRow.date) : undefined;
        return {
          label: h.label,
          done: l ? isHabitComplete(l, h.key) : false,
        };
      }),
      tasks: reportTodos,
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
            ? "Share this day’s full report as a PNG — tasks you closed, plus wake, habits, and study."
            : "Share the full report as a PNG. Tap a heatmap square to open that day."}
        </p>
      </div>

      {range === "today" && onSelectDate ? (
        <DayProgressPanel
          date={selected}
          today={today}
          onDate={onSelectDate}
          score={pickedScore}
          ratios={dayRatios}
          habits={dayHabits}
          compare={compareRows}
          strip={strip}
          notes={dayNotes || dayLog?.notes || null}
          goalText={dayGoal}
        />
      ) : null}

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
        title={
          range === "today" && !isToday
            ? `Finished ${prettyDay(selected, today)}`
            : "Finished today"
        }
        emptyHint={
          range === "today" && !isToday
            ? "No tasks were listed this day."
            : undefined
        }
        todos={reportTodos}
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
            value: studyLabel || study?.today.label || "0m",
            done: Boolean(selectedStudyMins || study?.today.minutes),
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
            label={
              range === "today"
                ? isToday
                  ? "Wake today"
                  : "Wake this day"
                : "Wake on time"
            }
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
        today={missionDay}
      />

      {range !== "today" && perHabit.length ? (
        <div>
          <h2 className="font-display text-2xl text-white">Each habit</h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            How often you closed each habit on days you checked in (
            {rangeHint.toLowerCase()}).
          </p>
          <ul className="mt-4 space-y-3">
            {perHabit.map((h) => (
              <li key={h.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-white">{h.label}</span>
                  <span className="shrink-0 tabular-nums text-[var(--color-mist)]">
                    {`${h.hits} of ${h.sample} days · ${h.pct}%`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[var(--color-dawn)]"
                    style={{ width: `${h.pct}%` }}
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

      {trendData.length > 1 ? (
        <div>
          <h2 className="font-display text-2xl text-white">
            {range === "today" ? "The week around this day" : "Habits, tasks, study"}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            Gold is habits. Green is tasks. The blue line is study (100% = 2
            hours). {range === "today" ? "The last bar is the day you picked." : `Each point is a day in ${rangeHint.toLowerCase()}.`}
          </p>
          <div className="mt-4">
            <ProgressTrendChart data={trendData} />
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
          showWakeTrend
          defaultRange={range === "year" ? "year" : range === "month" ? "month" : "week"}
          selectedDate={selected}
          onPickDay={onSelectDate}
        />
      ) : null}

      {range !== "today" ? (
        <div>
          <h2 className="font-display text-2xl text-white">Strong vs weak days</h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            Combined habit + task score vs your average of {meanEffort}% in this
            window. Tap a day to open its ratios. Repeat the strong nights.
            Don’t add goals on the weak ones — just go to bed on time.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-dawn)]">
                Stronger than average
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {moreDays.slice(-5).reverse().map((d) => (
                  <li key={d.date}>
                    <button
                      type="button"
                      className="flex w-full justify-between text-left text-white"
                      onClick={() => onSelectDate?.(d.date)}
                    >
                      <span>{d.full}</span>
                      <span className="text-[var(--color-leaf)]">{d.effort}%</span>
                    </button>
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
                  <li key={d.date}>
                    <button
                      type="button"
                      className="flex w-full justify-between text-left text-white"
                      onClick={() => onSelectDate?.(d.date)}
                    >
                      <span>{d.full}</span>
                      <span className="text-[var(--color-ember)]">{d.effort}%</span>
                    </button>
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
