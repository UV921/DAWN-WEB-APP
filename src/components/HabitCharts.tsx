"use client";

import { useMemo, useState } from "react";
import {
  completedCount,
  isHabitDone,
  type HabitDef,
  type HabitLogLike,
} from "@/lib/habits";
import { formatStudyDuration } from "@/lib/study-time";
import { type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { EvilAreaChart } from "@/components/evilcharts/charts/recharts-area-chart";

type Range = "week" | "month" | "year";

type Props = {
  logs: HabitLogLike[];
  habits?: HabitDef[];
  todos?: { date: string; total: number; done: number }[];
  studyDays?: { date: string; minutes: number }[];
  showWakeTrend?: boolean;
  defaultRange?: Range;
};

type Cell = {
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

const RANGE_OPTS: { key: Range; label: string }[] = [
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "year", label: "Yearly" },
];

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function consistencyLevel(cell: Omit<Cell, "level" | "date">): number {
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

function formatKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function prettyDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function weekdayShort(iso: string) {
  return DOW[new Date(iso + "T12:00:00").getDay()];
}

function makeCell(
  date: Date,
  byDate: Map<string, HabitLogLike>,
  todoByDate: Map<string, { date: string; total: number; done: number }>,
  studyByDate: Map<string, number>,
  habitKeys: string[],
  empty: boolean
): Cell {
  const key = formatKey(date);
  const habitTotal = habitKeys.length || 6;
  if (empty) {
    return {
      date: key,
      level: -1,
      habitsDone: 0,
      habitsTotal: habitTotal,
      tasksDone: 0,
      tasksTotal: 0,
      studyMinutes: 0,
      wakeTime: null,
      wakeEarly: false,
      logged: false,
    };
  }
  const log = byDate.get(key) || null;
  const todo = todoByDate.get(key);
  const detail = {
    habitsDone: log ? completedCount(log, habitKeys) : 0,
    habitsTotal: habitTotal,
    tasksDone: todo?.done || 0,
    tasksTotal: todo?.total || 0,
    studyMinutes: studyByDate.get(key) || 0,
    wakeTime: log?.wakeTime || null,
    wakeEarly: log ? isHabitDone(log, "wakeEarly") : false,
    logged: Boolean(log),
  };
  return { date: key, level: consistencyLevel(detail), ...detail };
}

function buildGrid(
  logs: HabitLogLike[],
  todos: { date: string; total: number; done: number }[],
  studyDays: { date: string; minutes: number }[],
  range: Range,
  habitKeys: string[]
) {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const todoByDate = new Map(todos.map((t) => [t.date, t]));
  const studyByDate = new Map(studyDays.map((s) => [s.date, s.minutes]));
  const end = new Date();
  end.setHours(12, 0, 0, 0);

  if (range === "week") {
    const week: Cell[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      week.push(makeCell(d, byDate, todoByDate, studyByDate, habitKeys, false));
    }
    return { cells: [week], monthLabels: [], weekCount: 7, weekRow: week };
  }

  const weeks = range === "month" ? 6 : 53;
  const start = new Date(end);
  if (range === "month") {
    start.setDate(1);
    start.setDate(start.getDate() - start.getDay());
  } else {
    start.setDate(
      start.getDate() - ((start.getDay() + 7) % 7) - (weeks - 1) * 7
    );
  }

  const weekCount =
    range === "month"
      ? Math.ceil(
          (new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() +
            new Date(end.getFullYear(), end.getMonth(), 1).getDay()) /
            7
        )
      : weeks;

  const cells: Cell[][] = [];
  const monthStart =
    range === "month" ? new Date(end.getFullYear(), end.getMonth(), 1) : null;
  const monthEnd =
    range === "month"
      ? new Date(end.getFullYear(), end.getMonth() + 1, 0, 23)
      : null;

  for (let w = 0; w < weekCount; w++) {
    const col: Cell[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + dow);
      const outOfMonth =
        Boolean(monthStart && monthEnd && (d < monthStart || d > monthEnd));
      col.push(
        makeCell(
          d,
          byDate,
          todoByDate,
          studyByDate,
          habitKeys,
          d > end || outOfMonth
        )
      );
    }
    cells.push(col);
  }

  const rawLabels: { label: string; index: number }[] = [];
  let lastMonth = -1;
  cells.forEach((col, i) => {
    const first = col.find((c) => c.level >= 0);
    if (!first?.date) return;
    const m = new Date(first.date + "T12:00:00").getMonth();
    if (m !== lastMonth) {
      rawLabels.push({
        label: new Date(first.date + "T12:00:00").toLocaleString("en", {
          month: "short",
        }),
        index: i,
      });
      lastMonth = m;
    }
  });

  const monthLabels: { label: string; index: number }[] = [];
  for (const item of rawLabels) {
    const prev = monthLabels[monthLabels.length - 1];
    if (prev && item.index - prev.index < 3) continue;
    monthLabels.push(item);
  }

  return { cells, monthLabels, weekCount, weekRow: null as Cell[] | null };
}

function rangeCaption(range: Range) {
  if (range === "week") return "this week";
  if (range === "month") return "this month";
  return "this year";
}

function DayDetail({ cell }: { cell: Cell | null }) {
  if (!cell || cell.level < 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--color-mist)]">
        Hover or tap a square. You’ll see wake early, habits done, tasks done,
        and study hours for that day.
      </p>
    );
  }
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-white">{prettyDate(cell.date)}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
            Wake early
          </dt>
          <dd className="mt-0.5 truncate text-white">
            {cell.wakeEarly
              ? `Yes · ${cell.wakeTime}`
              : cell.wakeTime
                ? `No · ${cell.wakeTime}`
                : "Not logged"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
            Habits
          </dt>
          <dd className="mt-0.5 truncate text-white">
            {cell.logged
              ? `${cell.habitsDone} of ${cell.habitsTotal} done`
              : "No check-in"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
            Tasks
          </dt>
          <dd className="mt-0.5 truncate text-white">
            {cell.tasksTotal
              ? `${cell.tasksDone} of ${cell.tasksTotal} done`
              : "No list"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
            Study
          </dt>
          <dd className="mt-0.5 truncate text-white">
            {cell.studyMinutes > 0
              ? formatStudyDuration(cell.studyMinutes)
              : "0m"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function HabitCharts({
  logs,
  habits = [],
  todos = [],
  studyDays = [],
  showWakeTrend = true,
  defaultRange = "week",
}: Props) {
  const [range, setRange] = useState<Range>(defaultRange);
  const [hover, setHover] = useState<Cell | null>(null);
  const habitKeys = useMemo(() => habits.map((h) => h.key), [habits]);
  const habitKeysSig = habitKeys.join(",");

  const { cells, monthLabels, weekRow } = useMemo(
    () => buildGrid(logs, todos, studyDays, range, habitKeys),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, todos, studyDays, range, habitKeysSig]
  );

  const wakeData = useMemo(() => {
    const slice = range === "year" ? 90 : 31;
    return logs
      .filter((l) => l.wakeTime)
      .slice(-slice)
      .map((l) => {
        const [h, m] = (l.wakeTime as string).split(":").map(Number);
        return {
          fullDate: l.date,
          date: l.date.slice(5),
          label: prettyDate(l.date),
          minutes: h * 60 + m,
          wakeTime: l.wakeTime,
          bedtime: l.bedtime,
          score: completedCount(l, habitKeys),
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, range, habitKeysSig]);

  const activeDays = (weekRow || cells.flat()).filter((c) => c.level > 0).length;
  const shown = hover && hover.level >= 0 ? hover : null;

  const wakeConfig = {
    minutes: {
      label: "Wake",
      colors: { light: ["#f0b45a"], dark: ["#f0b45a"] },
    },
  } satisfies ChartConfig;

  return (
    <section className="animate-rise-delay space-y-10 pt-4">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-2xl text-white">
              {activeDays} consistent day{activeDays === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-mist)]">
              {rangeCaption(range)}. Greener means you showed up. Hover or tap a
              square for that day’s numbers.
            </p>
          </div>
          <div className="flex shrink-0 rounded-full border border-white/15 p-1">
            {RANGE_OPTS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  setRange(r.key);
                  setHover(null);
                }}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  range === r.key
                    ? "bg-[var(--color-dawn)] font-semibold text-[var(--color-night)]"
                    : "text-[var(--color-mist)] hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="contrib-grid mt-4 steel-plate rounded-2xl bg-white/[0.03] p-4"
          onMouseLeave={() => setHover(null)}
        >
          <div className="min-h-[6.5rem] steel-plate-sm rounded-xl bg-black/25 px-3 py-3">
            <DayDetail cell={shown} />
          </div>

          {weekRow ? (
            <div className="mt-5 grid grid-cols-7 gap-2">
              {weekRow.map((cell) => (
                <button
                  key={cell.date}
                  type="button"
                  onMouseEnter={() => setHover(cell)}
                  onFocus={() => setHover(cell)}
                  onClick={() => setHover(cell)}
                  className="min-w-0 text-left"
                >
                  <span className="block truncate text-center text-[11px] text-[var(--color-mist)]">
                    {weekdayShort(cell.date)}
                  </span>
                  <span
                    className={`contrib-${cell.level} mx-auto mt-1.5 block h-8 w-8 rounded-md outline outline-white/10 sm:h-9 sm:w-9 ${
                      shown?.date === cell.date ? "ring-1 ring-white/70" : ""
                    }`}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="relative mt-5 overflow-x-auto">
              <div className="inline-block min-w-max">
                {range === "year" ? (
                  <div className="relative mb-1 ml-8 h-4">
                    {monthLabels.map((m) => (
                      <span
                        key={`${m.label}-${m.index}`}
                        className="absolute top-0 whitespace-nowrap text-[10px] leading-none text-[var(--color-mist)]"
                        style={{
                          left: `calc(${m.index} * (var(--tile) + var(--tile-gap)))`,
                        }}
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mb-2 ml-8 text-[11px] text-[var(--color-mist)]">
                    {new Date().toLocaleString("en", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
                <div className="flex items-start gap-[var(--tile-gap)]">
                  <div className="flex w-7 shrink-0 flex-col gap-[var(--tile-gap)] pr-1 text-[10px] leading-none text-[var(--color-mist)]">
                    {DOW.map((name, i) => (
                      <span
                        key={name}
                        className="flex items-center"
                        style={{ height: "var(--tile)" }}
                      >
                        {i % 2 === 1 ? name.slice(0, 3) : ""}
                      </span>
                    ))}
                  </div>
                  {cells.map((col, wi) => (
                    <div
                      key={wi}
                      className="flex flex-col gap-[var(--tile-gap)]"
                    >
                      {col.map((cell, di) => {
                        if (cell.level < 0) {
                          return (
                            <div
                              key={di}
                              className="tile opacity-0"
                              aria-hidden
                            />
                          );
                        }
                        return (
                          <button
                            key={di}
                            type="button"
                            aria-label={prettyDate(cell.date)}
                            onMouseEnter={() => setHover(cell)}
                            onFocus={() => setHover(cell)}
                            onClick={() => setHover(cell)}
                            className={`tile contrib-${cell.level} cursor-pointer hover:ring-1 hover:ring-white/50 ${
                              shown?.date === cell.date
                                ? "ring-1 ring-white/70"
                                : ""
                            }`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-[var(--color-mist)]">
                  <span className="mr-1">Less</span>
                  <span className="tile contrib-0" />
                  <span className="tile contrib-1" />
                  <span className="tile contrib-2" />
                  <span className="tile contrib-3" />
                  <span className="tile contrib-4" />
                  <span className="ml-1">More</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showWakeTrend ? (
        <div>
          <h2 className="font-display text-2xl text-white">Wake-up trend</h2>
          <p className="mt-1 text-sm text-[var(--color-mist)]">
            Hover points for full date and times.
          </p>
          <div className="mt-6 h-64 w-full">
            {wakeData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[var(--color-mist)]">
                Enter your wake time above to fill this graph.
              </div>
            ) : (
              <EvilAreaChart
                data={wakeData}
                config={wakeConfig}
                className="h-full w-full aspect-auto p-1"
                xDataKey="date"
              >
                <EvilAreaChart.Grid />
                <EvilAreaChart.XAxis dataKey="date" />
                <EvilAreaChart.YAxis
                  domain={["dataMin - 30", "dataMax + 30"]}
                  tickFormatter={(v: number) => {
                    const h = Math.floor(Number(v) / 60);
                    const m = Number(v) % 60;
                    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                  }}
                />
                <EvilAreaChart.Tooltip />
                <EvilAreaChart.Area dataKey="minutes" variant="gradient">
                  <EvilAreaChart.Dot variant="border" />
                  <EvilAreaChart.ActiveDot variant="colored-border" />
                </EvilAreaChart.Area>
              </EvilAreaChart>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
