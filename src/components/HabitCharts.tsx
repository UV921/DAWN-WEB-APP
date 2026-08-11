"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  completedCount,
  isHabitDone,
  type HabitDef,
  type HabitLogLike,
} from "@/lib/habits";

type Props = {
  logs: HabitLogLike[];
  habits?: HabitDef[];
};

type Range = "month" | "year";

type Cell = {
  date: string;
  score: number;
  level: number;
  log: HabitLogLike | null;
};

function levelFromScore(score: number, maxHabits: number): 0 | 1 | 2 | 3 | 4 {
  if (score <= 0) return 0;
  const ratio = score / Math.max(maxHabits, 1);
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.85) return 3;
  return 4;
}

function formatKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function prettyDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildGrid(logs: HabitLogLike[], range: Range, habitKeys: string[]) {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const end = new Date();
  end.setHours(12, 0, 0, 0);

  const weeks = range === "month" ? 5 : 53;
  const start = new Date(end);
  if (range === "month") {
    start.setDate(1);
    start.setDate(start.getDate() - start.getDay());
  } else {
    start.setDate(start.getDate() - ((start.getDay() + 7) % 7) - (weeks - 1) * 7);
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
  const monthStart = range === "month" ? new Date(end.getFullYear(), end.getMonth(), 1) : null;
  const monthEnd =
    range === "month"
      ? new Date(end.getFullYear(), end.getMonth() + 1, 0, 23)
      : null;

  for (let w = 0; w < weekCount; w++) {
    const col: Cell[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + dow);
      const key = formatKey(d);
      const outOfMonth =
        monthStart && monthEnd && (d < monthStart || d > monthEnd);
      const future = d > end;
      if (future || outOfMonth) {
        col.push({ date: key, score: -1, level: -1, log: null });
        continue;
      }
      const log = byDate.get(key) || null;
      const score = log ? completedCount(log, habitKeys) : 0;
      col.push({
        date: key,
        score: log ? score : -1,
        level: log ? levelFromScore(score, habitKeys.length || 6) : 0,
        log,
      });
    }
    cells.push(col);
  }

  const monthLabels: { label: string; index: number }[] = [];
  let lastMonth = -1;
  cells.forEach((col, i) => {
    const first = col.find((c) => c.level >= 0);
    if (!first?.date) return;
    const m = new Date(first.date + "T12:00:00").getMonth();
    if (m !== lastMonth) {
      monthLabels.push({
        label: new Date(first.date + "T12:00:00").toLocaleString("en", {
          month: "short",
        }),
        index: i,
      });
      lastMonth = m;
    }
  });

  return { cells, monthLabels, weekCount };
}

export function HabitCharts({ logs, habits = [] }: Props) {
  const [range, setRange] = useState<Range>("year");
  const [hover, setHover] = useState<Cell | null>(null);
  const habitKeys = useMemo(() => habits.map((h) => h.key), [habits]);
  const habitKeysSig = habitKeys.join(",");
  const habitCount = Math.max(habitKeys.length, 1);

  const { cells, monthLabels, weekCount } = useMemo(
    () => buildGrid(logs, range, habitKeys),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, range, habitKeysSig]
  );

  const wakeData = useMemo(() => {
    const slice = range === "month" ? 31 : 90;
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

  const totalInView = cells
    .flat()
    .filter((c) => c.level > 0)
    .reduce((n, c) => n + Math.max(0, c.score), 0);

  return (
    <section className="animate-rise-delay space-y-10 pt-4">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-white">
              {totalInView} habits · {range === "month" ? "this month" : "this year"}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-mist)]">
              Hover a square for date, wake time, and habits.
            </p>
          </div>
          <div className="flex rounded-full border border-white/15 p-1">
            {(["month", "year"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-full px-4 py-1.5 text-sm capitalize ${
                  range === r
                    ? "bg-[var(--color-dawn)] font-semibold text-[var(--color-night)]"
                    : "text-[var(--color-mist)] hover:text-white"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {hover && hover.level >= 0 && (
            <div className="pointer-events-none absolute left-4 top-4 z-10 min-w-[200px] rounded-xl border border-white/15 bg-[#0d1b2a] p-3 text-sm shadow-xl">
              <p className="font-medium text-white">{prettyDate(hover.date)}</p>
              <p className="mt-1 text-[var(--color-mist)]">
                {hover.score < 0
                  ? "No check-in"
                  : `${hover.score}/${habitCount} habits`}
              </p>
              {hover.log && (
                <div className="mt-2 space-y-1 text-xs text-[var(--color-cloud)]">
                  <p>
                    Wake{" "}
                    <span className="font-mono text-[var(--color-dawn)]">
                      {hover.log.wakeTime || "—"}
                    </span>
                    {" · "}
                    Sleep{" "}
                    <span className="font-mono text-[var(--color-dawn)]">
                      {hover.log.bedtime || "—"}
                    </span>
                  </p>
                  <p className="text-[var(--color-mist)]">
                    {habits
                      .filter((h) => isHabitDone(hover.log!, h.key))
                      .map((h) => h.label)
                      .join(" · ") || "No habits marked"}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="inline-block min-w-max pt-2">
            <div
              className="mb-1 grid gap-[3px]"
              style={{
                gridTemplateColumns: `28px repeat(${weekCount}, 11px)`,
              }}
            >
              <div />
              {cells.map((_, i) => {
                const label = monthLabels.find((m) => m.index === i)?.label;
                return (
                  <div
                    key={i}
                    className="h-3 text-[9px] leading-none text-[var(--color-mist)]"
                  >
                    {label || ""}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[3px]" onMouseLeave={() => setHover(null)}>
              <div className="flex w-7 flex-col justify-around pr-1 text-[9px] text-[var(--color-mist)]">
                <span className="h-[11px]" />
                <span className="h-[11px] leading-[11px]">Mon</span>
                <span className="h-[11px]" />
                <span className="h-[11px] leading-[11px]">Wed</span>
                <span className="h-[11px]" />
                <span className="h-[11px] leading-[11px]">Fri</span>
                <span className="h-[11px]" />
              </div>
              {cells.map((col, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {col.map((cell, di) => {
                    if (cell.level < 0) {
                      return (
                        <div
                          key={di}
                          className="tile opacity-20"
                          style={{ background: "transparent" }}
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
                        className={`tile contrib-${cell.level} cursor-pointer transition hover:ring-1 hover:ring-white/50`}
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
      </div>

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
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={wakeData}>
                <defs>
                  <linearGradient id="wakeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f0b45a" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#f0b45a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#8ba3b8"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#8ba3b8"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(v) => {
                    const h = Math.floor(Number(v) / 60);
                    const m = Number(v) % 60;
                    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                  }}
                  domain={["dataMin - 30", "dataMax + 30"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0d1b2a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as
                      | { label?: string }
                      | undefined;
                    return p?.label || "";
                  }}
                  formatter={(value, _name, item) => {
                    const v = Number(value);
                    const h = Math.floor(v / 60);
                    const m = v % 60;
                    const row = item?.payload as {
                      bedtime?: string | null;
                      score?: number;
                    };
                    const wake = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                    return [
                      `${wake}${row?.bedtime ? ` · slept ${row.bedtime}` : ""}${
                        row?.score != null ? ` · ${row.score}/6` : ""
                      }`,
                      "Wake",
                    ];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  stroke="#f0b45a"
                  fill="url(#wakeFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}
